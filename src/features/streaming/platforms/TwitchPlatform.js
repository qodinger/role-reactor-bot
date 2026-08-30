import WebSocket from "ws";
import { config } from "../../../config/config.js";
import { getLogger } from "../../../utils/logger.js";
import {
  refreshAccessToken,
  getChannelInfo,
  getAppAccessToken,
} from "../utils/oauth.js";
import Platform from "./Platform.js";

const logger = getLogger();

/**
 * TwitchPlatform handles all Twitch interactions for a single connected
 * streamer account:
 * - EventSub subscriptions are registered with the SHARED EventSubClient
 *   (one pooled WebSocket set across all streamers, for scale)
 * - Chat messages are sent as the dedicated bot account using an App Access
 *   Token, so the Chat Bot Badge renders
 * - A Twitch chat (IRC) WebSocket JOINs the channel so the bot can receive
 *   chat (required for channel.chat.message EventSub)
 */
class TwitchPlatform extends Platform {
  constructor(connection, eventSubClient) {
    super(connection);
    this.eventSubClient = eventSubClient;
    this.tokenRefreshInterval = null;
    this.chatWs = null;
    this.chatConnected = false;
    this._chatShouldReconnect = true;
    this._chatIdentity = null;
  }

  /**
   * Platform identifier
   * @returns {string}
   */
  get platformId() {
    return "twitch";
  }

  /**
   * Initialize the platform (start token refresh loop)
   */
  async init() {
    this.startTokenRefresh();
    // Refresh immediately so we don't subscribe EventSub with a stale token if
    // the bot was offline past the token's expiry.
    try {
      await this.refreshTokensIfNeeded();
    } catch (error) {
      logger.error("Initial token refresh failed", error);
    }
    logger.info("TwitchPlatform initialized");
  }

  /**
   * Start automatic token refresh
   */
  startTokenRefresh() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    // Refresh token every 45 minutes (tokens last ~60 minutes)
    this.tokenRefreshInterval = setInterval(
      async () => {
        try {
          await this.refreshTokensIfNeeded();
        } catch (error) {
          logger.error("Token refresh failed", error);
        }
      },
      45 * 60 * 1000,
    ).unref();
  }

  /**
   * Refresh tokens if they're about to expire
   */
  async refreshTokensIfNeeded() {
    if (!this.connection.refreshToken) return;

    const expiresAt = new Date(this.connection.tokenExpiresAt);
    const now = new Date();
    const minutesUntilExpiry =
      (expiresAt.getTime() - now.getTime()) / (1000 * 60);

    // Refresh if less than 10 minutes remaining (or expiry unknown/missing).
    if (minutesUntilExpiry < 10 || Number.isNaN(minutesUntilExpiry)) {
      logger.info("Refreshing Twitch access token");
      const tokens = await refreshAccessToken(this.connection.refreshToken);

      this.connection.accessToken = tokens.accessToken;
      this.connection.refreshToken = tokens.refreshToken;
      this.connection.tokenExpiresAt = new Date(
        Date.now() + tokens.expiresIn * 1000,
      );

      // Keep the live chat session's token current if we joined as the broadcaster.
      if (this._chatIdentity && !this._chatIdentity.isBot) {
        this._chatIdentity.token = tokens.accessToken;
      }

      // Update in database
      const { upsertStreamConnection } = await import(
        "../utils/streamConfig.js"
      );
      await upsertStreamConnection(this.connection);

      // EventSub subscriptions are re-created with the live token on the next
      // socket reconnect; nudge a re-subscribe for this broadcaster now.
      if (this.eventSubClient) {
        await this.eventSubClient.resubscribeBroadcaster(
          this.connection.platformUserId,
        );
      }
    }
  }

  /**
   * Subscribe to all EventSub events for this streamer via the shared pool.
   */
  async subscribeToEvents() {
    // Ensure a fresh token before creating subscriptions — at startup the stored
    // access token may already be expired (the 45-min refresh loop hasn't fired
    // yet), and EventSub rejects expired tokens with 401.
    try {
      await this.refreshTokensIfNeeded();
    } catch (error) {
      logger.error("Token refresh before EventSub subscribe failed", error);
    }

    const events = [
      {
        type: "channel.follow",
        version: "2",
        condition: {
          broadcaster_user_id: this.connection.platformUserId,
          moderator_user_id: this.connection.platformUserId,
        },
      },
      {
        type: "channel.subscribe",
        version: "1",
        condition: { broadcaster_user_id: this.connection.platformUserId },
      },
      {
        type: "channel.subscription.gift",
        version: "1",
        condition: { broadcaster_user_id: this.connection.platformUserId },
      },
      {
        type: "channel.subscription.message",
        version: "1",
        condition: { broadcaster_user_id: this.connection.platformUserId },
      },
      {
        type: "channel.raid",
        version: "1",
        condition: { to_broadcaster_user_id: this.connection.platformUserId },
      },
      {
        type: "stream.online",
        version: "1",
        condition: { broadcaster_user_id: this.connection.platformUserId },
      },
      {
        type: "stream.offline",
        version: "1",
        condition: { broadcaster_user_id: this.connection.platformUserId },
      },
    ];

    for (const event of events) {
      await this.eventSubClient.subscribe(
        {
          type: event.type,
          version: event.version,
          condition: event.condition,
        },
        () => this.connection.accessToken,
        { onChat: () => {}, onEvent: ev => this.emit("event", ev) },
      );
    }

    await this.subscribeChatAsBot();
    this.isConnected = true;
  }

  /**
   * Resolve the chat identity used to JOIN the channel and own the
   * channel.chat.message subscription. This MUST be the broadcaster: the
   * subscription requires `user:read:chat` (granted at `/stream connect`),
   * which the dedicated bot token does not have. The bot account is still used
   * for SENDING replies (via an App Access Token), so receiving as the
   * broadcaster has no functional downside.
   * @returns {{userId: string, login: string, token: string, isBot: boolean}}
   */
  getChatIdentity() {
    return {
      userId: this.connection.platformUserId,
      login: this.connection.platformLogin,
      token: this.connection.accessToken,
      isBot: false,
    };
  }

  /**
   * Connect to Twitch chat (IRC over WebSocket) and JOIN the broadcaster's
   * channel. Twitch requires the `user_id` in a `channel.chat.message`
   * EventSub subscription to be an active chat participant, so this must run
   * before subscribing. The connection is kept alive (PING/PONG + reconnect).
   */
  async connectChat() {
    const identity = this.getChatIdentity();
    await new Promise(resolve => {
      this._openChatSocket(identity, resolve);
    });
  }

  _openChatSocket(identity, onReady) {
    if (this.chatWs) {
      try {
        this.chatWs.onclose = null;
        this.chatWs.close();
      } catch (_) {}
    }

    const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    this.chatWs = ws;
    this._chatIdentity = identity;

    let ready = false;
    const markReady = () => {
      if (!ready) {
        ready = true;
        if (onReady) onReady();
      }
    };

    ws.onopen = () => {
      ws.send(
        "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership\r\n",
      );
      ws.send(`PASS oauth:${identity.token}\r\n`);
      ws.send(`NICK ${identity.login.toLowerCase()}\r\n`);
      ws.send(`JOIN #${this.connection.platformLogin.toLowerCase()}\r\n`);
      this.chatConnected = true;
      // Give Twitch a moment to process the JOIN before we subscribe.
      setTimeout(markReady, 1500);
    };

    ws.onmessage = event => {
      const text = String(event.data);
      const pingMatch = text.match(/PING\s+:?(\S+)/);
      if (pingMatch) {
        try {
          ws.send(`PONG :${pingMatch[1]}\r\n`);
        } catch (_) {}
      }
    };

    ws.onerror = error => {
      logger.error("Twitch chat socket error", error.message || error);
      this.chatConnected = false;
    };

    ws.onclose = () => {
      this.chatConnected = false;
      if (this._chatShouldReconnect) {
        setTimeout(() => {
          if (this._chatShouldReconnect)
            this._openChatSocket(this._chatIdentity, markReady);
        }, 5000);
      }
    };

    // Resolve regardless so the EventSub subscription is still attempted.
    setTimeout(markReady, 6000);
  }

  /**
   * Parse an incoming channel.chat.message EventSub event and emit a
   * normalized chatMessage for the command handler.
   * @param {Object} event - EventSub channel.chat.message event
   */
  handleChatEvent(event) {
    const badges = event.badges || [];
    this.emit("chatMessage", {
      username: event.chatter_user_name,
      userLogin: event.chatter_user_login,
      message: event.message?.text ?? "",
      color: event.color,
      badges,
      userId: event.chatter_user_id,
      isBroadcaster: badges.some(b => b.set_id === "broadcaster"),
      isMod: badges.some(b => b.set_id === "moderator"),
      isSubscriber: badges.some(b => b.set_id === "subscriber"),
      isVip: badges.some(b => b.set_id === "vip"),
      messageId: event.message_id,
    });
  }

  /**
   * Subscribe to channel.chat.message. The chat user (broadcaster) must have
   * joined the channel first (Twitch auth requirement), so we connect to chat
   * and JOIN before creating the subscription.
   */
  async subscribeChatAsBot() {
    await this.connectChat();

    logger.info(
      `Subscribing channel.chat.message as broadcaster (user_id=${this.connection.platformUserId})`,
    );

    await this.eventSubClient.subscribe(
      {
        type: "channel.chat.message",
        version: "1",
        condition: {
          broadcaster_user_id: this.connection.platformUserId,
          user_id: this.connection.platformUserId,
        },
      },
      () => this.connection.accessToken,
      { onChat: ev => this.handleChatEvent(ev), onEvent: () => {} },
    );
  }

  /**
   * Send a message to Twitch chat as the dedicated RoleReactor bot account so
   * its Chat Bot Badge appears. Per Twitch docs, the badge only renders when
   * the message is sent with an **App Access Token** (not a user token),
   * provided the bot user granted `user:bot`+`user:write:chat` and the
   * broadcaster granted `channel:bot`.
   * @param {string} message - Message to send
   * @param {Object} [options] - Send options
   * @param {string} [options.replyParentMessageId] - Message ID to reply to
   * @returns {Promise<boolean>} Success
   */
  async sendMessage(message, options = {}) {
    const { getStreamBotAccount } = await import(
      "../utils/streamBotAccount.js"
    );

    const bot = await getStreamBotAccount();
    if (!bot || !bot.botUserId) {
      logger.warn("No Twitch bot account configured; cannot send chat as bot");
      return false;
    }

    try {
      const appToken = await getAppAccessToken();

      const body = {
        broadcaster_id: this.connection.platformUserId,
        sender_id: bot.botUserId,
        message,
      };
      if (options.replyParentMessageId) {
        body.reply_parent_message_id = options.replyParentMessageId;
      }

      const response = await fetch(
        "https://api.twitch.tv/helix/chat/messages",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        logger.error("Failed to send Twitch chat message as bot", data);
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Failed to send message to Twitch as bot", error);
      return false;
    }
  }

  /**
   * Timeout a user in Twitch chat (requires moderator:manage:banned_users scope
   * and bot must be a channel moderator).
   * @param {string} userId - Twitch user ID to timeout
   * @param {number} duration - Duration in seconds (1-1209600)
   * @param {string} [reason] - Optional reason
   * @returns {Promise<boolean>}
   */
  async timeoutUser(userId, duration, reason = "") {
    try {
      const appToken = await getAppAccessToken();
      const response = await fetch(
        "https://api.twitch.tv/helix/moderation/banned",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            broadcaster_id: this.connection.platformUserId,
            moderator_id: this.connection.platformUserId,
            user_id: userId,
            duration,
            reason,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        logger.warn("Twitch timeout failed", data);
        return false;
      }
      return true;
    } catch (error) {
      logger.error("Twitch timeout request failed", error);
      return false;
    }
  }

  /**
   * Ban a user from Twitch chat (requires moderator:manage:banned_users scope).
   * @param {string} userId - Twitch user ID to ban
   * @param {string} [reason] - Optional reason
   * @returns {Promise<boolean>}
   */
  async banUser(userId, reason = "") {
    try {
      const appToken = await getAppAccessToken();
      const response = await fetch(
        "https://api.twitch.tv/helix/moderation/banned",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            broadcaster_id: this.connection.platformUserId,
            moderator_id: this.connection.platformUserId,
            user_id: userId,
            reason,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        logger.warn("Twitch ban failed", data);
        return false;
      }
      return true;
    } catch (error) {
      logger.error("Twitch ban request failed", error);
      return false;
    }
  }

  /**
   * Get list of chatters currently in the channel.
   * Requires moderator:read:chatters scope.
   * @returns {Promise<Array<{user_id: string, user_login: string, user_name: string}>>}
   */
  async getChannelChatters() {
    try {
      const appToken = await getAppAccessToken();
      const response = await fetch(
        `https://api.twitch.tv/helix/channels/chatters?broadcaster_id=${this.connection.platformUserId}&moderator_id=${this.connection.platformUserId}`,
        {
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Client-Id": config.twitch.clientId,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        logger.warn("Failed to get Twitch chatters", data);
        return [];
      }

      return data.data || [];
    } catch (error) {
      logger.error("Failed to get Twitch chatters", error);
      return [];
    }
  }

  /**
   * Get channel info via Helix API
   * @returns {Promise<Object|null>} Channel info
   */
  async getChannelInfo() {
    try {
      return await getChannelInfo(
        this.connection.accessToken,
        this.connection.platformLogin,
      );
    } catch (error) {
      logger.error("Failed to get channel info", error);
      return null;
    }
  }

  /**
   * Check if streamer is live
   * @returns {Promise<boolean>} True if live
   */
  async isLive() {
    const channel = await this.getChannelInfo();
    return channel?.is_live === true;
  }

  /**
   * Disconnect: remove this streamer's EventSub subscriptions (leaving the
   * shared pool intact) and close the chat socket.
   */
  async disconnect() {
    this.isConnected = false;
    this._chatShouldReconnect = false;

    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    if (this.eventSubClient) {
      await this.eventSubClient.unsubscribeBroadcaster(
        this.connection.platformUserId,
      );
    }

    if (this.chatWs) {
      try {
        this.chatWs.onclose = null;
        this.chatWs.close();
      } catch (_) {}
      this.chatWs = null;
    }

    logger.info("TwitchPlatform disconnected");
  }
}

export default TwitchPlatform;
