import { EventEmitter } from "events";
import { EmbedBuilder } from "discord.js";
import { getLogger } from "../../utils/logger.js";
import config from "../../config/config.js";
import { THEME, UI_COMPONENTS } from "../../config/theme.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";
import {
  DEFAULT_STREAM_CONFIG,
  upsertStreamConnection,
  removeStreamConnection,
  updateStreamConnectionSettings,
} from "./utils/streamConfig.js";
import {
  getStreamInfo,
  getChannelInfo,
  getFollowerCount,
  updateChannel,
  searchGame,
  getAppAccessToken,
} from "./utils/oauth.js";
import { GLOBAL_DEFAULT_TWITCH_COMMANDS } from "./utils/defaultCommands.js";
import { runFilters } from "./utils/twitchChatFilters.js";
import TwitchPlatform from "./platforms/TwitchPlatform.js";
import YouTubePlatform from "./platforms/YouTubePlatform.js";
import KickPlatform from "./platforms/KickPlatform.js";
import { EventSubClient } from "./EventSubClient.js";

const logger = getLogger();

/**
 * Format a duration (from a start date) as a human-readable uptime string.
 * @param {Date} start - Time the stream started
 * @returns {string}
 */
function formatUptime(start) {
  const ms = Math.max(0, Date.now() - start.getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Permission levels ordered from lowest to highest.
 * A user at a higher level can run commands at any lower level.
 */
export const USERLEVELS = [
  "everyone",
  "subscriber",
  "vip",
  "moderator",
  "owner",
];

/**
 * Check whether a chatter's badges satisfy a required userlevel.
 * @param {string} required - Minimum userlevel needed (e.g. "moderator")
 * @param {Object} message - Normalized chat message with badge flags
 * @returns {boolean}
 */
export function hasPermission(required, message) {
  const requiredIdx = USERLEVELS.indexOf(required);
  if (requiredIdx <= 0) return true; // "everyone" or unknown → always allowed

  // Broadcaster always has owner-level access
  if (message.isBroadcaster) return true;
  if (message.isMod) return USERLEVELS.indexOf("moderator") >= requiredIdx;
  if (message.isVip) return USERLEVELS.indexOf("vip") >= requiredIdx;
  if (message.isSubscriber)
    return USERLEVELS.indexOf("subscriber") >= requiredIdx;

  return requiredIdx <= 0; // falls back to "everyone"
}

/**
 * StreamingManager - Core singleton managing all streaming platform connections
 */
class StreamingManager extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.platforms = new Map(); // guildId -> Map<platform, TwitchPlatform>
    // Single shared EventSub WebSocket pool for ALL streamers (scales to many
    // concurrent streams instead of one socket per streamer).
    this.eventSubClient = new EventSubClient();
    this.isInitialized = false;
    this.connectionCheckInterval = null;
    this.timerCheckInterval = null;
    this.lastChatAt = null;
    this.lastCommandReplyAt = null;
    this.spamHistory = new Map(); // userId -> [{ text, time }] for Twitch spam detection
    this.liveStatusCache = new Map(); // `${guildId}:${platform}` -> { isLive, checkedAt }
  }

  /**
   * Initialize the streaming manager
   */
  async init() {
    if (this.isInitialized) {
      logger.warn("StreamingManager already initialized");
      return;
    }

    try {
      // Load all active stream connections and start platforms
      await this.loadActiveConnections();

      // Start periodic connection health check
      this.startHealthCheck();

      // Start Twitch chat timer checks (every 30 seconds)
      this.startTimerChecks();

      this.isInitialized = true;
      logger.info("✅ StreamingManager initialized");
    } catch (error) {
      logger.error("❌ Failed to initialize StreamingManager", error);
      throw error;
    }
  }

  /**
   * Load all active stream connections from database
   */
  async loadActiveConnections() {
    try {
      const storage = await getStorageManager();
      if (!storage.dbManager?.streamConnections) {
        logger.warn("Stream connections repository not available");
        return;
      }

      // Get all guilds the bot is in
      const guilds = this.client.guilds.cache;

      for (const [guildId] of guilds) {
        const connections =
          await storage.dbManager.streamConnections.getByGuild(guildId);

        for (const conn of connections) {
          if (conn.platform === "twitch" && conn.accessToken) {
            await this.startPlatformConnection(guildId, conn);
          }
        }
      }

      logger.info("Active stream connections loaded");
    } catch (error) {
      logger.error("Failed to load active connections", error);
    }
  }

  /**
   * Start a platform connection for a guild
   * @param {string} guildId - Discord guild ID
   * @param {Object} connection - Stream connection object
   */
  async startPlatformConnection(guildId, connection) {
    try {
      // Tear down any existing connection for this platform before replacing it,
      // otherwise the old EventSub socket lingers and duplicates events.
      const existing = this.platforms.get(guildId)?.get(connection.platform);
      if (existing) {
        try {
          await existing.disconnect();
        } catch (_) {}
      }

      let platformInstance;

      switch (connection.platform) {
        case "twitch":
          platformInstance = new TwitchPlatform(
            connection,
            this.eventSubClient,
          );
          await platformInstance.init();

          // Register EventSub subscriptions on the SHARED pool (chat + alerts).
          await platformInstance.subscribeToEvents();

          // Set up event handlers
          this.setupPlatformEventHandlers(
            guildId,
            platformInstance,
            connection,
          );
          break;

        case "youtube":
          platformInstance = new YouTubePlatform(connection);
          await platformInstance.init();
          await platformInstance.subscribeToEvents();
          this.setupPlatformEventHandlers(
            guildId,
            platformInstance,
            connection,
          );
          break;

        case "kick":
          platformInstance = new KickPlatform(connection);
          await platformInstance.init();
          await platformInstance.subscribeToEvents();
          this.setupPlatformEventHandlers(
            guildId,
            platformInstance,
            connection,
          );
          break;

        default:
          logger.warn(`Unknown platform: ${connection.platform}`);
          return;
      }

      if (!this.platforms.has(guildId)) {
        this.platforms.set(guildId, new Map());
      }

      this.platforms.get(guildId).set(connection.platform, platformInstance);

      logger.info(
        `Started ${connection.platform} connection for guild ${guildId} (${connection.platformLogin})`,
      );
    } catch (error) {
      logger.error(
        `Failed to start platform connection for guild ${guildId}`,
        error,
      );
    }
  }

  /**
   * Tear down and restart all active platform connections.
   * Used after bot account is linked or on manual reconnect.
   * @param {string} [platformFilter] - Optional: only reconnect this platform (e.g. "twitch")
   */
  async reconnectAllPlatforms(platformFilter = null) {
    const toRestart = [];
    for (const [guildId, platforms] of this.platforms) {
      for (const [platformName, platform] of platforms) {
        if (platformFilter && platformName !== platformFilter) continue;
        if (platform?.connection) {
          toRestart.push({ guildId, connection: platform.connection });
        }
      }
    }

    if (toRestart.length === 0) {
      logger.info(
        `No active ${platformFilter || "all"} connections to reconnect`,
      );
      return;
    }

    for (const { guildId, connection } of toRestart) {
      try {
        await this.startPlatformConnection(guildId, connection);
        logger.info(
          `Reconnected ${connection.platform} connection for guild ${guildId}`,
        );
      } catch (error) {
        logger.error(
          `Failed to reconnect ${connection.platform} for guild ${guildId}`,
          error,
        );
      }
    }
  }

  /**
   * Legacy method: reconnect only Twitch connections.
   */
  async reconnectAllTwitch() {
    return this.reconnectAllPlatforms("twitch");
  }

  /**
   * Set up event handlers for a platform instance
   */
  setupPlatformEventHandlers(guildId, platform, connection) {
    // Chat commands: Twitch chat → command handler
    platform.on("chatMessage", async message => {
      await this.handleChatMessage(guildId, platform, connection, message);
    });

    // EventSub events: follows, subs, raids, etc.
    platform.on("event", async event => {
      await this.handleStreamEvent(guildId, connection, event);
    });
  }

  /**
   * Handle incoming chat message from Twitch
   */
  async handleChatMessage(guildId, platform, connection, message) {
    this.lastChatAt = Date.now();

    // Run chat filters before command handling
    const filterResult = await this.runChatFilters(
      guildId,
      platform,
      connection,
      message,
    );
    if (filterResult.violated) return; // message blocked by filter

    if (connection.commandsEnabled) {
      await this.handleTwitchCommand(
        guildId,
        platform,
        connection,
        message,
      ).catch(e => logger.error("Failed to handle Twitch command", e));
    }
  }

  /**
   * Run Twitch chat filters against an incoming message.
   * @returns {{ violated: boolean }} true if the message should be blocked
   */
  async runChatFilters(guildId, platform, connection, message) {
    try {
      const storage = await getStorageManager();
      if (!storage.dbManager?.twitchChatFilters) return { violated: false };

      const settings =
        await storage.dbManager.twitchChatFilters.getByGuild(guildId);
      if (!settings || !settings.enabled) return { violated: false };

      const text = message.message || "";
      const result = runFilters(
        text,
        message.userId,
        settings,
        this.spamHistory,
      );

      if (result.violated) {
        logger.info(
          `Twitch chat filter triggered: ${result.type} for user ${message.userLogin} in guild ${guildId}`,
        );

        // Apply action: timeout if configured, otherwise just block the message
        if (settings.timeoutDuration && platform.connection) {
          const durationSec = settings.timeoutDuration * 60;
          await platform
            .timeoutUser(
              message.userId,
              durationSec,
              `Chat filter: ${result.type}`,
            )
            .catch(() => {});
        }

        return { violated: true };
      }
    } catch (error) {
      logger.error("Error running Twitch chat filters", error);
    }

    return { violated: false };
  }

  /**
   * Handle a Twitch chat command (prefixed message) and reply as the bot.
   * @param {string} guildId - Discord guild ID
   * @param {Object} platform - TwitchPlatform instance
   * @param {Object} connection - Stream connection
   * @param {Object} message - Normalized chat message
   */
  async handleTwitchCommand(guildId, platform, connection, message) {
    const prefix = connection.commandPrefix || "!";
    if (!message.message || !message.message.startsWith(prefix)) return;

    // Ignore bot messages (including our own replies) to avoid loops
    const isBot = (message.badges || []).some(b => b.set_id === "bot");
    if (isBot) return;

    const withoutPrefix = message.message.slice(prefix.length).trim();
    if (!withoutPrefix) return;
    const [name, ...args] = withoutPrefix.split(/\s+/);

    const storage = await getStorageManager();

    // ── Built-in commands with special logic (quote, so, poll) ──────────────
    if (name === "quote") {
      return await this.handleQuoteCommand(
        guildId,
        platform,
        message,
        args,
        storage,
      ).catch(e => logger.error("Failed to handle quote command", e));
    }
    if (name === "so") {
      return await this.handleShoutoutCommand(
        guildId,
        platform,
        connection,
        message,
        args,
      ).catch(e => logger.error("Failed to handle shoutout command", e));
    }
    if (name === "poll") {
      return await this.handlePollCommand(
        guildId,
        platform,
        connection,
        message,
        args,
      ).catch(e => logger.error("Failed to handle poll command", e));
    }
    if (name === "title") {
      return await this.handleSetTitleCommand(
        guildId,
        platform,
        connection,
        message,
        args,
      ).catch(e => logger.error("Failed to handle set-title command", e));
    }
    if (name === "game") {
      return await this.handleSetGameCommand(
        guildId,
        platform,
        connection,
        message,
        args,
      ).catch(e => logger.error("Failed to handle set-game command", e));
    }
    if (name === "timeout") {
      return await this.handleTimeoutCommand(
        guildId,
        platform,
        message,
        args,
      ).catch(e => logger.error("Failed to handle timeout command", e));
    }
    if (name === "untimeout") {
      return await this.handleUnTimeoutCommand(
        guildId,
        platform,
        message,
        args,
      ).catch(e => logger.error("Failed to handle untimeout command", e));
    }
    if (name === "ban") {
      return await this.handleBanCommand(
        guildId,
        platform,
        message,
        args,
      ).catch(e => logger.error("Failed to handle ban command", e));
    }

    if (!storage.dbManager?.twitchCommands) return;

    // Guild command first, then fall back to global defaults (available in every channel).
    let cmd = await storage.dbManager.twitchCommands.getByName(guildId, name);
    if (!cmd || !cmd.enabled) {
      cmd = GLOBAL_DEFAULT_TWITCH_COMMANDS.find(c => c.name === name);
    }
    if (!cmd) return;

    // Permission check: skip silently if chatter lacks the required userlevel
    const requiredLevel = cmd.userlevel || "everyone";
    if (!hasPermission(requiredLevel, message)) return;

    let response = (cmd.response || "")
      .replace(/\{user\}/gi, message.userLogin || message.username || "")
      .replace(/\{channel\}/gi, connection.platformLogin || "");

    // Expand {uptime}/{title}/{game} with live stream data for this broadcaster.
    if (
      response.includes("{uptime}") ||
      response.includes("{title}") ||
      response.includes("{game}")
    ) {
      const stream = await getStreamInfo(
        connection.accessToken,
        connection.platformUserId,
      ).catch(() => null);
      response = response
        .replace(
          /\{uptime\}/gi,
          stream
            ? formatUptime(new Date(stream.started_at))
            : "stream is offline",
        )
        .replace(
          /\{title\}/gi,
          stream ? stream.title || "untitled" : "stream is offline",
        )
        .replace(
          /\{game\}/gi,
          stream ? stream.game_name || "Just Chatting" : "stream is offline",
        );
    }

    // Expand {commands} into a Nightbot-style list: one chat message per
    // command so each appears on its own line (Twitch collapses newlines in a
    // single API-sent message).
    if (response.includes("{commands}")) {
      const entries = GLOBAL_DEFAULT_TWITCH_COMMANDS.map(c => ({
        name: c.name,
        description: c.description || c.name,
        userlevel: c.userlevel || "everyone",
      }));
      try {
        const guildCmds =
          await storage.dbManager.twitchCommands.listByGuild(guildId);
        for (const c of guildCmds) {
          if (c.enabled)
            entries.push({
              name: c.name,
              description: c.description || c.name,
              userlevel: c.userlevel || "everyone",
            });
        }
      } catch {
        // ignore — fall back to global entries only
      }
      // Only show commands the chatter can actually use
      const visible = entries.filter(e => hasPermission(e.userlevel, message));
      const list = visible
        .filter(e => e.name !== name)
        .sort((a, b) => a.name.localeCompare(b.name));
      const header = response.replace(/\{commands\}/gi, "").trim();
      if (header) {
        const sent = await platform.sendMessage(header, {
          replyParentMessageId: message.messageId,
        });
        if (sent) this.lastCommandReplyAt = Date.now();
      }
      for (const e of list) {
        const levelTag = e.userlevel !== "everyone" ? ` [${e.userlevel}]` : "";
        const line = `• ${prefix}${e.name} — ${e.description}${levelTag}`;
        const sent = await platform.sendMessage(line, {
          replyParentMessageId: message.messageId,
        });
        if (sent) this.lastCommandReplyAt = Date.now();
      }
      return;
    }

    const sent = await platform.sendMessage(response, {
      replyParentMessageId: message.messageId,
    });
    if (sent) this.lastCommandReplyAt = Date.now();
  }

  /**
   * Handle !quote command in Twitch chat.
   * Usage: !quote (random), !quote 123 (by ID), !quote add <text> (owner/mod only)
   */
  async handleQuoteCommand(guildId, platform, message, args, storage) {
    if (!storage.dbManager?.twitchQuotes) return;
    const quotes = storage.dbManager.twitchQuotes;

    // !quote add <text> — requires owner or mod
    if (args[0]?.toLowerCase() === "add") {
      if (!hasPermission("moderator", message)) return;
      const text = args.slice(1).join(" ").trim();
      if (!text) {
        await platform.sendMessage("Usage: !quote add <text>", {
          replyParentMessageId: message.messageId,
        });
        return;
      }
      const doc = await quotes.add(guildId, text, message.userLogin);
      await platform.sendMessage(`Quote #${doc.id} saved!`, {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    // !quote 123 — by ID
    if (args[0] && /^\d+$/.test(args[0])) {
      const id = parseInt(args[0], 10);
      const quote = await quotes.getById(guildId, id);
      if (!quote) {
        await platform.sendMessage(`Quote #${id} not found.`, {
          replyParentMessageId: message.messageId,
        });
        return;
      }
      await platform.sendMessage(`Quote #${quote.id}: ${quote.text}`, {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    // !quote — random
    const quote = await quotes.getRandom(guildId);
    if (!quote) {
      await platform.sendMessage("No quotes saved yet.", {
        replyParentMessageId: message.messageId,
      });
      return;
    }
    await platform.sendMessage(`Quote #${quote.id}: ${quote.text}`, {
      replyParentMessageId: message.messageId,
    });
  }

  /**
   * Handle !so (shoutout) command in Twitch chat.
   * Usage: !so <username> — mod/broadcaster only
   */
  async handleShoutoutCommand(guildId, platform, connection, message, args) {
    if (!hasPermission("moderator", message)) return;
    const targetLogin = args[0]?.toLowerCase()?.replace(/^@/, "");
    if (!targetLogin) {
      await platform.sendMessage("Usage: !so <username>", {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    const user = await getChannelInfo(
      connection.accessToken,
      targetLogin,
    ).catch(() => null);
    if (!user) {
      await platform.sendMessage(`User "${targetLogin}" not found.`, {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    const followers = await getFollowerCount(connection.accessToken, user.id);

    // Check if live
    const stream = await getStreamInfo(connection.accessToken, user.id).catch(
      () => null,
    );

    let reply = `Shoutout ${user.display_name}!`;
    if (user.description) reply += ` ${user.description.slice(0, 100)}`;
    reply += ` | ${followers} followers`;
    if (stream) {
      reply += ` | LIVE: ${stream.title || "untitled"} — ${stream.game_name || "No category"}`;
    } else {
      reply += ` | offline`;
    }

    await platform.sendMessage(reply, {
      replyParentMessageId: message.messageId,
    });
  }

  /**
   * Handle !poll command in Twitch chat.
   * Usage: !poll "Question" | "Option1" | "Option2" [duration_seconds]
   * Requires owner or moderator.
   */
  async handlePollCommand(guildId, platform, connection, message, args) {
    if (!hasPermission("moderator", message)) return;

    const raw = args.join(" ");
    const parts = raw.split("|").map(s => s.trim().replace(/^"|"$/g, ""));
    const title = parts[0];
    const choices = parts.slice(1).filter(Boolean);

    if (!title || choices.length < 2) {
      await platform.sendMessage(
        'Usage: !poll "Question" | "Option1" | "Option2" [seconds]',
        { replyParentMessageId: message.messageId },
      );
      return;
    }

    // Check for duration as last arg (only if there are enough choices left after popping)
    let duration = 120; // default 2 minutes
    if (parts.length >= 4) {
      const lastPart = choices[choices.length - 1];
      if (/^\d+$/.test(lastPart)) {
        // Only consume as duration if we still have at least 2 choices left
        const potentialChoices = choices.slice(0, -1);
        if (potentialChoices.length >= 2) {
          duration = parseInt(choices.pop(), 10);
        }
      }
    }

    try {
      const resp = await fetch("https://api.twitch.tv/helix/polls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Client-Id": config.twitch.clientId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          broadcaster_id: connection.platformUserId,
          title,
          choices: choices.map(c => ({ title: c.slice(0, 25) })),
          duration: Math.min(Math.max(duration, 15), 1800),
        }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        await platform.sendMessage(
          `Failed to create poll: ${data.message || "unknown error"}`,
          { replyParentMessageId: message.messageId },
        );
        return;
      }

      await platform.sendMessage(`Poll started: ${title} (${duration}s)`, {
        replyParentMessageId: message.messageId,
      });
    } catch (error) {
      logger.error("Failed to create Twitch poll", error);
      await platform.sendMessage("Failed to create poll.", {
        replyParentMessageId: message.messageId,
      });
    }
  }

  /**
   * Handle !title command. Without args: display current title. With args: set title (mod only).
   */
  async handleSetTitleCommand(guildId, platform, connection, message, args) {
    const hasArgs = args.length > 0;
    if (hasArgs && !hasPermission("moderator", message)) {
      await platform.sendMessage("Only moderators can change the title.", {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    if (!hasArgs) {
      // Display mode — fall through to normal variable expansion
      return;
    }

    const newTitle = args.join(" ");
    const ok = await updateChannel(
      connection.accessToken,
      connection.platformUserId,
      { title: newTitle },
    );
    if (ok) {
      await platform.sendMessage(`Title updated to: ${newTitle}`, {
        replyParentMessageId: message.messageId,
      });
    } else {
      await platform.sendMessage("Failed to update title.", {
        replyParentMessageId: message.messageId,
      });
    }
  }

  /**
   * Handle !game command. Without args: display current game. With args: set game (mod only).
   */
  async handleSetGameCommand(guildId, platform, connection, message, args) {
    const hasArgs = args.length > 0;
    if (hasArgs && !hasPermission("moderator", message)) {
      await platform.sendMessage("Only moderators can change the game.", {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    if (!hasArgs) {
      // Display mode — fall through to normal variable expansion
      return;
    }

    const gameName = args.join(" ");
    const appToken = await getAppAccessToken();
    const gameId = await searchGame(appToken, gameName);
    if (!gameId) {
      await platform.sendMessage(`Game "${gameName}" not found.`, {
        replyParentMessageId: message.messageId,
      });
      return;
    }
    const ok = await updateChannel(
      connection.accessToken,
      connection.platformUserId,
      { gameId },
    );
    if (ok) {
      await platform.sendMessage(`Game updated to: ${gameName}`, {
        replyParentMessageId: message.messageId,
      });
    } else {
      await platform.sendMessage("Failed to update game.", {
        replyParentMessageId: message.messageId,
      });
    }
  }

  /**
   * Handle !timeout <user> [duration] [reason] command (mod only).
   * Default duration: 600 seconds (10 minutes).
   */
  async handleTimeoutCommand(guildId, platform, message, args) {
    if (!hasPermission("moderator", message)) return;
    if (!args.length) {
      await platform.sendMessage(
        "Usage: !timeout <user> [duration_seconds] [reason]",
        { replyParentMessageId: message.messageId },
      );
      return;
    }

    const targetLogin = args[0].replace("@", "").toLowerCase();
    const duration = parseInt(args[1]) || 600;
    const reason = args.slice(2).join(" ") || "Timed out by moderator";

    // Look up the target user's ID
    const appToken = await getAppAccessToken();
    let targetId;
    try {
      const resp = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(targetLogin)}`,
        {
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
          },
        },
      );
      const data = await resp.json();
      targetId = data.data?.[0]?.id;
    } catch {
      targetId = null;
    }

    if (!targetId) {
      await platform.sendMessage(`User "${targetLogin}" not found.`, {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    const ok = await platform.timeoutUser(targetId, duration, reason);
    if (ok) {
      await platform.sendMessage(`Timed out ${targetLogin} for ${duration}s.`, {
        replyParentMessageId: message.messageId,
      });
    } else {
      await platform.sendMessage(`Failed to timeout ${targetLogin}.`, {
        replyParentMessageId: message.messageId,
      });
    }
  }

  /**
   * Handle !untimeout <user> command (mod only).
   */
  async handleUnTimeoutCommand(guildId, platform, message, args) {
    if (!hasPermission("moderator", message)) return;
    if (!args.length) {
      await platform.sendMessage("Usage: !untimeout <user>", {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    const targetLogin = args[0].replace("@", "").toLowerCase();

    // Look up the target user's ID
    const appToken = await getAppAccessToken();
    let targetId;
    try {
      const resp = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(targetLogin)}`,
        {
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
          },
        },
      );
      const data = await resp.json();
      targetId = data.data?.[0]?.id;
    } catch {
      targetId = null;
    }

    if (!targetId) {
      await platform.sendMessage(`User "${targetLogin}" not found.`, {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    // Unban removes timeout
    try {
      const resp = await fetch(
        "https://api.twitch.tv/helix/moderation/banned",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            broadcaster_id: platform.connection.platformUserId,
            moderator_id: platform.connection.platformUserId,
            user_id: targetId,
          }),
        },
      );
      if (resp.ok) {
        await platform.sendMessage(`Removed timeout for ${targetLogin}.`, {
          replyParentMessageId: message.messageId,
        });
      } else {
        await platform.sendMessage(
          `Failed to remove timeout for ${targetLogin}.`,
          { replyParentMessageId: message.messageId },
        );
      }
    } catch {
      await platform.sendMessage(
        `Failed to remove timeout for ${targetLogin}.`,
        { replyParentMessageId: message.messageId },
      );
    }
  }

  /**
   * Handle !ban <user> [reason] command (mod only).
   */
  async handleBanCommand(guildId, platform, message, args) {
    if (!hasPermission("moderator", message)) return;
    if (!args.length) {
      await platform.sendMessage("Usage: !ban <user> [reason]", {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    const targetLogin = args[0].replace("@", "").toLowerCase();
    const reason = args.slice(1).join(" ") || "Banned by moderator";

    const appToken = await getAppAccessToken();
    let targetId;
    try {
      const resp = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(targetLogin)}`,
        {
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
          },
        },
      );
      const data = await resp.json();
      targetId = data.data?.[0]?.id;
    } catch {
      targetId = null;
    }

    if (!targetId) {
      await platform.sendMessage(`User "${targetLogin}" not found.`, {
        replyParentMessageId: message.messageId,
      });
      return;
    }

    const ok = await platform.banUser(targetId, reason);
    if (ok) {
      await platform.sendMessage(`Banned ${targetLogin}.`, {
        replyParentMessageId: message.messageId,
      });
    } else {
      await platform.sendMessage(`Failed to ban ${targetLogin}.`, {
        replyParentMessageId: message.messageId,
      });
    }
  }

  /**
   * Handle stream events (follows, subs, raids, etc.)
   */
  async handleStreamEvent(guildId, connection, event) {
    if (!connection.alertsEnabled || !connection.alertChannelId) {
      return;
    }

    try {
      const channel = this.client.channels.cache.get(connection.alertChannelId);
      if (!channel) {
        logger.warn(`Alert channel ${connection.alertChannelId} not found`);
        return;
      }

      // Check if this alert type is enabled
      const alertTypeMap = {
        "stream.online": "goLive",
        "stream.offline": "offline",
        "channel.follow": "follow",
        "channel.subscribe": "subscribe",
        "channel.subscription.gift": "giftSub",
        "channel.subscription.message": "resub",
        "channel.raid": "raid",
      };

      const alertType = alertTypeMap[event.subscription?.type];
      if (!alertType || !connection.alertTypes?.[alertType]) {
        return;
      }

      let embed;

      switch (event.subscription?.type) {
        case "stream.online": {
          const stream = await getStreamInfo(
            connection.accessToken,
            connection.platformUserId,
          ).catch(() => null);
          embed = this.createGoLiveEmbed(event.event, stream);
          break;
        }
        case "channel.follow":
          embed = this.createFollowEmbed(event.event);
          break;
        case "channel.subscribe":
          embed = this.createSubscribeEmbed(event.event);
          break;
        case "channel.subscription.gift":
          embed = this.createGiftSubEmbed(event.event);
          break;
        case "channel.subscription.message":
          embed = this.createResubEmbed(event.event);
          break;
        case "channel.raid":
          embed = this.createRaidEmbed(event.event);
          break;
        case "stream.offline":
          embed = this.createOfflineEmbed(event.event);
          break;
        default:
          return;
      }

      if (embed) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.error("Failed to send stream alert to Discord", error);
    }
  }

  /**
   * Create go-live alert embed. `stream` (from Helix /streams) supplies the
   * category, title, viewer count and thumbnail that the EventSub
   * `stream.online` payload lacks.
   */
  createGoLiveEmbed(event, stream) {
    const login = event.broadcaster_user_login;
    const name = event.broadcaster_user_name;
    const title = stream?.title || "Just went live!";
    const category = stream?.game_name || "Unknown";
    const viewers = stream?.viewer_count?.toString() || "0";
    const thumb = stream?.thumbnail_url || event.thumbnail_url;

    const embed = new EmbedBuilder()
      .setTitle(`🔴 ${title}`)
      .setDescription(`**${name}** is now live on Twitch!`)
      .addFields(
        { name: "Category", value: category, inline: true },
        { name: "Viewers", value: viewers, inline: true },
      )
      .setURL(`https://twitch.tv/${login}`)
      .setColor(THEME.TWITCH)
      .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
      .setTimestamp();

    if (thumb) {
      embed.setImage(
        thumb.replace("{width}", "1920").replace("{height}", "1080"),
      );
    }

    return embed;
  }

  /**
   * Create follow alert embed
   */
  createFollowEmbed(event) {
    return new EmbedBuilder()
      .setTitle("👋 New Follower!")
      .setDescription(`${event.user_name} just followed!`)
      .setColor(THEME.TWITCH_GREEN)
      .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
      .setTimestamp();
  }

  /**
   * Create subscribe alert embed
   */
  createSubscribeEmbed(event) {
    const tierNames = {
      1000: "Tier 1",
      2000: "Tier 2",
      3000: "Tier 3",
    };

    return new EmbedBuilder()
      .setTitle("⭐ New Subscriber!")
      .setDescription(
        `${event.user_name} subscribed at ${tierNames[event.tier] || event.tier}!`,
      )
      .setColor(THEME.TWITCH_PINK)
      .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
      .setTimestamp();
  }

  /**
   * Create gift sub alert embed
   */
  createGiftSubEmbed(event) {
    return new EmbedBuilder()
      .setTitle("🎁 Gift Sub!")
      .setDescription(
        `${event.user_name} gifted ${event.total || 1} sub${event.total > 1 ? "s" : ""}!`,
      )
      .setColor(THEME.TWITCH_GOLD)
      .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
      .setTimestamp();
  }

  /**
   * Create resub alert embed
   */
  createResubEmbed(event) {
    return new EmbedBuilder()
      .setTitle("⭐ Resub!")
      .setDescription(
        `${event.user_name} resubscribed for ${event.cumulative_months} months!`,
      )
      .addFields({
        name: "Message",
        value: event.message?.text || "—",
        inline: false,
      })
      .setColor(THEME.TWITCH_PINK)
      .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
      .setTimestamp();
  }

  /**
   * Create raid alert embed
   */
  createRaidEmbed(event) {
    return new EmbedBuilder()
      .setTitle("⚡ Raid!")
      .setDescription(
        `${event.from_broadcaster_user_name} is raiding with ${event.viewers} viewers!`,
      )
      .setURL(`https://twitch.tv/${event.from_broadcaster_user_login}`)
      .setColor(THEME.TWITCH_RED)
      .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
      .setTimestamp();
  }

  /**
   * Create offline alert embed
   */
  createOfflineEmbed(event) {
    return new EmbedBuilder()
      .setTitle("⚫ Stream Ended")
      .setDescription(`**${event.broadcaster_user_name}** is now offline.`)
      .setColor(THEME.TWITCH)
      .setFooter(UI_COMPONENTS.createFooter("Stream Alerts"))
      .setTimestamp();
  }

  /**
   * Connect a new stream account
   * @param {string} guildId - Discord guild ID
   * @param {string} discordUserId - Discord user ID
   * @param {string} platform - Platform name
   * @param {Object} tokens - OAuth tokens
   * @param {Object} userInfo - Platform user info
   * @param {Object} config - Connection config
   */
  async connectAccount(
    guildId,
    discordUserId,
    platform,
    tokens,
    userInfo,
    config = {},
  ) {
    const connection = {
      ...DEFAULT_STREAM_CONFIG,
      discordUserId,
      guildId,
      platform,
      platformUserId: userInfo.id,
      platformLogin: userInfo.login || userInfo.display_name,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      ...config,
    };

    await upsertStreamConnection(connection);

    // Start the platform connection
    await this.startPlatformConnection(guildId, connection);

    return connection;
  }

  /**
   * Disconnect a stream account
   * @param {string} guildId - Discord guild ID
   * @param {string} discordUserId - Discord user ID
   * @param {string} platform - Platform name
   */
  async disconnectAccount(guildId, discordUserId, platform) {
    const guildPlatforms = this.platforms.get(guildId);
    if (guildPlatforms) {
      const platformInstance = guildPlatforms.get(platform);
      if (platformInstance) {
        await platformInstance.disconnect();
        guildPlatforms.delete(platform);
      }
    }

    await removeStreamConnection(discordUserId, platform);

    logger.info(`Disconnected ${platform} account for guild ${guildId}`);
  }

  /**
   * Update stream connection settings
   * @param {string} guildId - Discord guild ID
   * @param {string} discordUserId - Discord user ID
   * @param {string} platform - Platform name
   * @param {Object} settings - Settings to update
   */
  async updateSettings(guildId, discordUserId, platform, settings) {
    await updateStreamConnectionSettings(discordUserId, platform, settings);

    // Update live connection if exists
    const guildPlatforms = this.platforms.get(guildId);
    if (guildPlatforms) {
      const platformInstance = guildPlatforms.get(platform);
      if (platformInstance) {
        platformInstance.connection = {
          ...platformInstance.connection,
          ...settings,
        };
      }
    }
  }

  /**
   * Get connection status for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Array} Connection statuses
   */
  getConnectionStatus(guildId) {
    const statuses = [];
    const guildPlatforms = this.platforms.get(guildId);

    if (guildPlatforms) {
      for (const [platform, instance] of guildPlatforms) {
        statuses.push({
          platform,
          platformLogin: instance.connection?.platformLogin,
          isConnected: instance.isConnected,
          eventSubConnected:
            this.eventSubClient?.sessions?.some(s => s.ready) ?? false,
        });
      }
    }

    return statuses;
  }

  /**
   * Start periodic connection health check.
   * Also cleans up stale spam history entries.
   */
  startHealthCheck() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    // Check every 5 minutes
    this.connectionCheckInterval = setInterval(
      async () => {
        for (const [guildId, guildPlatforms] of this.platforms) {
          for (const [platform, instance] of guildPlatforms) {
            if (!instance.isConnected) {
              logger.warn(
                `Platform ${platform} for guild ${guildId} appears disconnected`,
              );
            }
          }
        }

        // Clean up stale spam history entries (older than 5 minutes)
        const cutoff = Date.now() - 5 * 60 * 1000;
        for (const [userId, msgs] of this.spamHistory) {
          const recent = msgs.filter(m => m.time >= cutoff);
          if (recent.length === 0) {
            this.spamHistory.delete(userId);
          } else {
            this.spamHistory.set(userId, recent);
          }
        }
      },
      5 * 60 * 1000,
    ).unref();
  }

  /**
   * Start periodic timer checks for Twitch chat auto-messages.
   * Checks every 30 seconds and sends messages when timers are due.
   */
  startTimerChecks() {
    if (this.timerCheckInterval) {
      clearInterval(this.timerCheckInterval);
    }

    this.timerCheckInterval = setInterval(async () => {
      await this.checkTimers().catch(e =>
        logger.error("Timer check failed", e),
      );
    }, 30 * 1000).unref();
  }

  /**
   * Check all enabled timers and send messages for any that are due.
   * Only sends if the stream is live (cached for 60 seconds to avoid
   * redundant Helix API calls when a guild has multiple timers).
   */
  async checkTimers() {
    const storage = await getStorageManager();
    if (!storage.dbManager?.twitchTimers) return;

    const LIVE_CACHE_TTL = 60 * 1000; // 60 seconds

    for (const [guildId, guildPlatforms] of this.platforms) {
      for (const [platform, instance] of guildPlatforms) {
        if (platform !== "twitch" || !instance.isConnected) continue;

        const timers = await storage.dbManager.twitchTimers.getEnabled(guildId);
        const now = Date.now();

        // Check live status once per platform, cache for 60 seconds
        const cacheKey = `${guildId}:${platform}`;
        let liveEntry = this.liveStatusCache.get(cacheKey);
        if (!liveEntry || now - liveEntry.checkedAt > LIVE_CACHE_TTL) {
          const isLive = await instance.isLive().catch(() => false);
          liveEntry = { isLive, checkedAt: now };
          this.liveStatusCache.set(cacheKey, liveEntry);
        }

        if (!liveEntry.isLive) continue;

        for (const timer of timers) {
          const lastSent = timer.lastSentAt?.getTime?.() || 0;
          if (now - lastSent < timer.intervalMs) continue;

          const sent = await instance.sendMessage(timer.message);
          if (sent) {
            await storage.dbManager.twitchTimers.updateLastSent(
              guildId,
              timer.name,
            );
          }
        }
      }
    }
  }

  /**
   * Shutdown the streaming manager
   */
  async shutdown() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    if (this.timerCheckInterval) {
      clearInterval(this.timerCheckInterval);
    }

    for (const [guildId, guildPlatforms] of this.platforms) {
      for (const [platform, instance] of guildPlatforms) {
        try {
          await instance.disconnect();
        } catch (error) {
          logger.error(
            `Error shutting down ${platform} for guild ${guildId}`,
            error,
          );
        }
      }
    }

    this.platforms.clear();
    this.liveStatusCache.clear();
    this.spamHistory.clear();
    this.isInitialized = false;
    logger.info("StreamingManager shutdown complete");
  }
}

// Singleton instance
let streamingManager = null;

/**
 * Get the StreamingManager singleton instance
 * @param {Client} client - Discord client (required on first call)
 * @returns {StreamingManager} Singleton instance
 */
export function getStreamingManager(client) {
  if (!streamingManager) {
    if (!client) {
      throw new Error("Discord client required for first initialization");
    }
    streamingManager = new StreamingManager(client);
  }
  return streamingManager;
}

/**
 * Reset the singleton (for testing)
 */
export function resetStreamingManager() {
  streamingManager = null;
}
