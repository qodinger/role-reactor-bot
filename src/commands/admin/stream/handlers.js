import { EmbedBuilder } from "discord.js";
import { config } from "../../../config/config.js";
import { THEME } from "../../../config/theme.js";
import { GLOBAL_DEFAULT_TWITCH_COMMANDS } from "../../../features/streaming/utils/defaultCommands.js";
import { buildAlertTestEmbed } from "./embeds.js";
import {
  getGuildTwitchConnection,
  getBuiltInTwitchCommand,
  prefixForConnection,
} from "./utils.js";

// ============================================================================
// CONNECTION HANDLERS
// ============================================================================

export async function handleConnect(
  interaction,
  streamingManager,
  userId,
  guildId,
) {
  if (!config.twitch.enabled) {
    return interaction.editReply({
      content: "❌ Twitch streaming integration is not enabled on this bot.",
      ephemeral: true,
    });
  }

  const { generateAuthUrl, generateState } = await import(
    "../../../features/streaming/utils/oauth.js"
  );

  const state = generateState();
  if (!global.twitchOAuthStates) {
    global.twitchOAuthStates = new Map();
  }
  global.twitchOAuthStates.set(state, {
    userId,
    guildId,
    timestamp: Date.now(),
  });

  const authUrl = generateAuthUrl(state);

  const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = await import(
    "discord.js"
  );
  const embed = new EmbedBuilder()
    .setTitle("🔗 Connect Twitch Account")
    .setDescription(
      "Click the button below to authorize the bot to access your Twitch account.\n\n" +
        "**Required permissions:**\n" +
        "• Read your channel info\n" +
        "• Read chat messages\n" +
        "• Send chat messages (as you)\n" +
        "• Manage stream info (title, game)\n" +
        "• Read follows, subs, raids\n\n" +
        "This will allow the bot to send alerts and run stream commands from Discord.",
    )
    .setColor(THEME.TWITCH)
    .setFooter({
      text: "You will be redirected back to Discord after authorization",
    });

  const authorizeButton = new ButtonBuilder()
    .setLabel("Authorize on Twitch")
    .setStyle(ButtonStyle.Link)
    .setURL(authUrl)
    .setEmoji("🔗");

  const row = new ActionRowBuilder().addComponents(authorizeButton);

  try {
    await interaction.user.send({ embeds: [embed], components: [row] });
    await interaction.editReply({
      content:
        "📬 I've sent you a DM with the authorization link. Check your DMs!",
    });
  } catch (_error) {
    await interaction.editReply({
      content: `⚠️ I couldn't DM you. Please click this link to authorize:\n${authUrl}`,
    });
  }
}

export async function handleBotConnect(
  interaction,
  _streamingManager,
  _userId,
  _guildId,
) {
  if (interaction.guild.ownerId !== interaction.user.id) {
    return interaction.editReply({
      content: "❌ Only the server owner can connect the bot's Twitch account.",
    });
  }

  if (!config.twitch.enabled) {
    return interaction.editReply({
      content: "❌ Twitch streaming integration is not enabled on this bot.",
    });
  }

  const { generateBotAuthUrl, generateState } = await import(
    "../../../features/streaming/utils/oauth.js"
  );

  const state = generateState();
  if (!global.twitchBotOAuthStates) {
    global.twitchBotOAuthStates = new Map();
  }
  global.twitchBotOAuthStates.set(state, { timestamp: Date.now() });

  const authUrl = generateBotAuthUrl(state);

  const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = await import(
    "discord.js"
  );
  const embed = new EmbedBuilder()
    .setTitle("🔗 Connect RoleReactor Bot Account")
    .setDescription(
      "Authorize the **RoleReactor** Twitch account so the bot can send chat as itself " +
        "(e.g. `twitch.tv/rolereactor`).\n\n" +
        "**Requirements:**\n" +
        "• A dedicated Twitch account for the bot, **separate from your broadcaster**\n" +
        "• Log in as that bot account, then approve the `user:bot` scope\n\n" +
        "No Verified Bot Program enrollment is needed. Once authorized, chat replies post " +
        "under the bot account (not your broadcaster). This is a one-time, global setup.",
    )
    .setColor(THEME.TWITCH)
    .setFooter({ text: "You will be redirected back after authorization" });

  const authorizeButton = new ButtonBuilder()
    .setLabel("Authorize Bot Account")
    .setStyle(ButtonStyle.Link)
    .setURL(authUrl)
    .setEmoji("🤖");

  const row = new ActionRowBuilder().addComponents(authorizeButton);

  try {
    await interaction.user.send({ embeds: [embed], components: [row] });
    await interaction.editReply({
      content:
        "📬 I've sent you a DM with the authorization link for the bot account. Check your DMs!",
    });
  } catch (_error) {
    await interaction.editReply({
      content: `⚠️ I couldn't DM you. Please click this link to authorize:\n${authUrl}`,
    });
  }
}

export async function handleDisconnect(
  interaction,
  streamingManager,
  userId,
  guildId,
) {
  const { getStreamConnection } = await import(
    "../../../features/streaming/utils/streamConfig.js"
  );
  const connection = await getStreamConnection(userId, "twitch");

  if (!connection) {
    return interaction.editReply({
      content: "❌ You don't have a connected Twitch account.",
      ephemeral: true,
    });
  }

  await streamingManager.disconnectAccount(guildId, userId, "twitch");

  await interaction.editReply({
    content: "✅ Twitch account disconnected successfully.",
    ephemeral: true,
  });
}

// ============================================================================
// CONFIG / STATUS HANDLERS
// ============================================================================

export async function handleConfig(
  interaction,
  streamingManager,
  _userId,
  guildId,
) {
  const connection = await getGuildTwitchConnection(guildId);

  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const alertChannel = interaction.options.getChannel("alert_channel");
  const alertsEnabled = interaction.options.getBoolean("alerts_enabled");
  const commandsEnabled = interaction.options.getBoolean("commands_enabled");
  const commandPrefix = interaction.options.getString("command_prefix");
  const alertType = interaction.options.getString("alert_type");
  const alertTypeEnabled = interaction.options.getBoolean("alert_type_enabled");

  const settings = {};
  if (alertChannel) settings.alertChannelId = alertChannel.id;
  if (alertsEnabled !== null) settings.alertsEnabled = alertsEnabled;
  if (commandsEnabled !== null) settings.commandsEnabled = commandsEnabled;
  if (commandPrefix !== null) settings.commandPrefix = commandPrefix;
  if (alertType && alertTypeEnabled !== null) {
    settings.alertTypes = {
      ...connection.alertTypes,
      [alertType]: alertTypeEnabled,
    };
  }

  if (Object.keys(settings).length === 0) {
    return interaction.editReply({
      content: [
        `📺 **Twitch settings for ${connection.platformLogin}**`,
        `Alerts: ${connection.alertsEnabled ? "enabled" : "disabled"}${connection.alertChannelId ? ` in <#${connection.alertChannelId}>` : ""}`,
        `Chat commands: ${connection.commandsEnabled ? "enabled" : "disabled"} (prefix: \`${connection.commandPrefix || "!"}\`)`,
        "",
        "**Alert types:**",
        ...Object.entries(connection.alertTypes || {}).map(
          ([type, enabled]) => `${enabled ? "✅" : "❌"} ${type}`,
        ),
        "",
        "Use an option above to change a setting.",
      ].join("\n"),
      ephemeral: true,
    });
  }

  await streamingManager.updateSettings(
    guildId,
    connection.discordUserId,
    "twitch",
    settings,
  );

  const embed = new EmbedBuilder()
    .setTitle("✅ Stream Settings Updated")
    .setColor(THEME.TWITCH_GREEN)
    .setTimestamp();

  if (alertChannel)
    embed.addFields({
      name: "Alert Channel",
      value: `<#${alertChannel.id}>`,
      inline: true,
    });
  if (alertsEnabled !== null)
    embed.addFields({
      name: "Stream Alerts",
      value: alertsEnabled ? "Enabled" : "Disabled",
      inline: true,
    });
  if (commandsEnabled !== null)
    embed.addFields({
      name: "Chat Commands",
      value: commandsEnabled ? "Enabled" : "Disabled",
      inline: true,
    });
  if (commandPrefix !== null)
    embed.addFields({
      name: "Command Prefix",
      value: `\`${commandPrefix}\``,
      inline: true,
    });
  if (alertType && alertTypeEnabled !== null) {
    embed.addFields({
      name: `Alert: ${alertType}`,
      value: alertTypeEnabled ? "Enabled" : "Disabled",
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

export async function handleStatus(interaction, streamingManager, guildId) {
  const { getStreamConnections } = await import(
    "../../../features/streaming/utils/streamConfig.js"
  );
  const connections = await getStreamConnections(guildId);
  const platformStatuses = streamingManager.getConnectionStatus(guildId);

  const embed = new EmbedBuilder()
    .setTitle("📊 Stream Integration Status")
    .setColor(THEME.TWITCH)
    .setTimestamp();

  if (connections.length === 0) {
    embed.setDescription(
      "No stream accounts connected. Use `/stream connect` to link your Twitch account.",
    );
  } else {
    for (const conn of connections) {
      const status = platformStatuses.find(
        s =>
          s.platform === conn.platform &&
          s.platformLogin === conn.platformLogin,
      );

      let statusText = "";
      if (status) {
        statusText = [
          status.isConnected ? "✅ Twitch" : "❌ Twitch",
          status.eventSubConnected ? "✅ EventSub" : "❌ EventSub",
        ].join(" | ");
      } else {
        statusText = "⚠️ Not connected";
      }

      embed.addFields({
        name: `${conn.platform.toUpperCase()} — ${conn.platformLogin}`,
        value: `**Status:** ${statusText}\n**Alerts:** ${conn.alertsEnabled ? "✅" : "❌"} ${conn.alertChannelId ? `<#${conn.alertChannelId}>` : "Not set"}\n**Chat Commands:** ${conn.commandsEnabled ? "✅" : "❌"} (prefix \`${conn.commandPrefix || "!"}\`)`,
        inline: false,
      });
    }
  }

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

// ============================================================================
// ALERT TEST HANDLER
// ============================================================================

export async function handleAlertTest(interaction, streamingManager, guildId) {
  const alertType = interaction.options.getString("type") || "goLive";

  const embed = buildAlertTestEmbed(alertType);
  if (!embed) {
    return interaction.editReply({
      content: "Unknown alert type",
      ephemeral: true,
    });
  }

  const { getStreamConnections } = await import(
    "../../../features/streaming/utils/streamConfig.js"
  );
  const connections = await getStreamConnections(guildId);

  if (connections.length > 0 && connections[0].alertChannelId) {
    const channel = interaction.client.channels.cache.get(
      connections[0].alertChannelId,
    );
    if (channel) {
      await channel.send({ embeds: [embed] });
      return interaction.editReply({
        content: "✅ Test alert sent to alert channel!",
        ephemeral: true,
      });
    }
  }

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

// ============================================================================
// CHAT COMMAND MANAGEMENT HANDLERS
// ============================================================================

export async function handleCommandAdd(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const name = interaction.options.getString("name").toLowerCase();
  const response = interaction.options.getString("response");
  const description = interaction.options.getString("description") || null;
  const userlevel = interaction.options.getString("userlevel") || "everyone";

  if (!/^[a-z0-9_-]+$/i.test(name)) {
    return interaction.editReply({
      content:
        "❌ Command name must be alphanumeric (dashes/underscores allowed).",
      ephemeral: true,
    });
  }

  if (getBuiltInTwitchCommand(name)) {
    return interaction.editReply({
      content: `❌ \`${prefixForConnection(connection)}${name}\` is built in and cannot be replaced. Choose another name.`,
      ephemeral: true,
    });
  }

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchCommands) {
    return interaction.editReply({
      content: "❌ Commands repository unavailable.",
      ephemeral: true,
    });
  }

  const existing = await storage.dbManager.twitchCommands.getByName(
    guildId,
    name,
  );
  if (existing) {
    return interaction.editReply({
      content: `❌ Command \`${name}\` already exists. Use \`/stream command-edit\`.`,
      ephemeral: true,
    });
  }

  await storage.dbManager.twitchCommands.create(guildId, {
    name,
    response,
    description,
    userlevel,
    createdBy: interaction.user.id,
  });

  const prefix = connection.commandPrefix || "!";
  await interaction.editReply({
    content: `✅ Added command \`${prefix}${name}\`.\n**Response:** ${response}\n**Permission:** ${userlevel}`,
    ephemeral: true,
  });
}

export async function handleCommandRemove(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const name = interaction.options.getString("name").toLowerCase();

  if (getBuiltInTwitchCommand(name)) {
    return interaction.editReply({
      content: `ℹ️ \`${prefixForConnection(connection)}${name}\` is a built-in command and cannot be removed.`,
      ephemeral: true,
    });
  }

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchCommands) {
    return interaction.editReply({
      content: "❌ Commands repository unavailable.",
      ephemeral: true,
    });
  }

  const result = await storage.dbManager.twitchCommands.remove(guildId, name);
  if (result.deletedCount === 0) {
    return interaction.editReply({
      content: `❌ Command \`${name}\` not found.`,
      ephemeral: true,
    });
  }

  await interaction.editReply({
    content: `✅ Removed command \`${name}\`.`,
    ephemeral: true,
  });
}

export async function handleCommandList(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchCommands) {
    return interaction.editReply({
      content: "❌ Commands repository unavailable.",
      ephemeral: true,
    });
  }

  const commands = await storage.dbManager.twitchCommands.listByGuild(guildId);
  const prefix = connection.commandPrefix || "!";

  const embed = new EmbedBuilder()
    .setTitle(`🔧 Twitch Chat Commands (${prefix})`)
    .setColor(THEME.TWITCH)
    .setTimestamp();

  const customNames = new Set(commands.map(command => command.name));
  const builtIns = GLOBAL_DEFAULT_TWITCH_COMMANDS.filter(
    command => !customNames.has(command.name),
  );

  embed.addFields({
    name: "Built-in commands",
    value: builtIns.length
      ? builtIns
          .map(command => {
            const level = command.userlevel || "everyone";
            const tag = level !== "everyone" ? ` [${level}]` : "";
            return `\`${prefix}${command.name}\`${tag} — ${command.description}`;
          })
          .join("\n")
      : "None",
    inline: false,
  });

  embed.addFields({
    name: "Custom commands",
    value: commands.length
      ? commands
          .map(command => {
            const level = command.userlevel || "everyone";
            const tag = level !== "everyone" ? ` [${level}]` : "";
            return `\`${prefix}${command.name}\`${command.enabled ? "" : " _(disabled)_"}${tag} — ${command.description || command.response}`;
          })
          .join("\n")
      : "None yet. Add one with `/stream command-add`.",
    inline: false,
  });

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

export async function handleCommandEdit(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const name = interaction.options.getString("name").toLowerCase();
  const response = interaction.options.getString("response");
  const description = interaction.options.getString("description");
  const enabled = interaction.options.getBoolean("enabled");
  const userlevel = interaction.options.getString("userlevel");

  if (getBuiltInTwitchCommand(name)) {
    return interaction.editReply({
      content: `ℹ️ \`${prefixForConnection(connection)}${name}\` is built in and cannot be edited.`,
      ephemeral: true,
    });
  }

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchCommands) {
    return interaction.editReply({
      content: "❌ Commands repository unavailable.",
      ephemeral: true,
    });
  }

  const existing = await storage.dbManager.twitchCommands.getByName(
    guildId,
    name,
  );
  if (!existing) {
    return interaction.editReply({
      content: `❌ Command \`${name}\` not found.`,
      ephemeral: true,
    });
  }

  if (
    response === null &&
    description === null &&
    enabled === null &&
    userlevel === null
  ) {
    return interaction.editReply({
      content:
        "❌ Choose at least one field to update: `response`, `description`, `enabled`, or `userlevel`.",
      ephemeral: true,
    });
  }

  const updates = {};
  if (response !== null) updates.response = response;
  if (description !== null) updates.description = description;
  if (enabled !== null) updates.enabled = enabled;
  if (userlevel !== null) updates.userlevel = userlevel;

  await storage.dbManager.twitchCommands.update(guildId, name, updates);

  const embed = new EmbedBuilder()
    .setTitle(`✅ Updated command \`${name}\``)
    .setColor(THEME.TWITCH_GREEN)
    .setTimestamp();
  if (response !== null)
    embed.addFields({ name: "Response", value: response, inline: false });
  if (enabled !== null)
    embed.addFields({
      name: "Enabled",
      value: enabled ? "Yes" : "No",
      inline: true,
    });
  if (userlevel !== null)
    embed.addFields({ name: "Permission", value: userlevel, inline: true });

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

// ============================================================================
// FILTER HANDLERS
// ============================================================================

export async function handleFilterToggle(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const filter = interaction.options.getString("filter");
  const enabled = interaction.options.getBoolean("enabled");

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchChatFilters) {
    return interaction.editReply({
      content: "❌ Filters repository unavailable.",
      ephemeral: true,
    });
  }

  if (filter === "all") {
    await storage.dbManager.twitchChatFilters.setEnabled(guildId, enabled);
    return interaction.editReply({
      content: enabled
        ? "✅ Twitch chat filters **enabled**. Configure individual filters with `/stream filter-config`."
        : "✅ Twitch chat filters **disabled**.",
      ephemeral: true,
    });
  }

  const settings =
    await storage.dbManager.twitchChatFilters.getByGuild(guildId);
  settings[filter] = { ...settings[filter], enabled };
  await storage.dbManager.twitchChatFilters.set(guildId, settings);

  const filterNames = {
    caps: "Caps lock",
    links: "Links",
    spam: "Spam",
    badWords: "Bad words",
  };
  await interaction.editReply({
    content: `${enabled ? "✅" : "❌"} **${filterNames[filter]}** filter ${enabled ? "enabled" : "disabled"}.`,
    ephemeral: true,
  });
}

export async function handleFilterConfig(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const filter = interaction.options.getString("filter");
  const threshold = interaction.options.getInteger("threshold");
  const minLength = interaction.options.getInteger("min_length");
  const repeatedMessages = interaction.options.getInteger("repeated_messages");
  const rateThreshold = interaction.options.getInteger("rate_threshold");
  const addWords = interaction.options.getString("add_words");
  const removeWords = interaction.options.getString("remove_words");
  const timeoutDuration = interaction.options.getInteger("timeout_duration");

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchChatFilters) {
    return interaction.editReply({
      content: "❌ Filters repository unavailable.",
      ephemeral: true,
    });
  }

  const settings =
    await storage.dbManager.twitchChatFilters.getByGuild(guildId);
  const updates = {};

  if (filter === "caps") {
    if (threshold !== null) updates.threshold = threshold;
    if (minLength !== null) updates.minLength = minLength;
    settings.caps = { ...settings.caps, ...updates };
  } else if (filter === "spam") {
    if (repeatedMessages !== null) updates.repeatedMessages = repeatedMessages;
    if (rateThreshold !== null) updates.rateThreshold = rateThreshold;
    settings.spam = { ...settings.spam, ...updates };
  } else if (filter === "badWords") {
    const currentWords = settings.badWords?.words || [];
    if (addWords) {
      const newWords = addWords
        .split(",")
        .map(w => w.trim())
        .filter(Boolean);
      settings.badWords = {
        ...settings.badWords,
        words: [...new Set([...currentWords, ...newWords])],
      };
    }
    if (removeWords) {
      const toRemove = removeWords.split(",").map(w => w.trim().toLowerCase());
      settings.badWords = {
        ...settings.badWords,
        words: currentWords.filter(w => !toRemove.includes(w.toLowerCase())),
      };
    }
  }

  if (timeoutDuration !== null) settings.timeoutDuration = timeoutDuration;

  await storage.dbManager.twitchChatFilters.set(guildId, settings);

  const embed = new EmbedBuilder()
    .setTitle(`✅ Filter Configured: ${filter}`)
    .setColor(THEME.TWITCH_GREEN)
    .setTimestamp();

  if (filter === "caps") {
    embed.addFields(
      {
        name: "Threshold",
        value: `${settings.caps?.threshold || 70}%`,
        inline: true,
      },
      {
        name: "Min Length",
        value: `${settings.caps?.minLength || 10}`,
        inline: true,
      },
    );
  } else if (filter === "spam") {
    embed.addFields(
      {
        name: "Repeated Messages",
        value: `${settings.spam?.repeatedMessages || 3}`,
        inline: true,
      },
      {
        name: "Rate Threshold",
        value: `${settings.spam?.rateThreshold || 5}/5s`,
        inline: true,
      },
    );
  } else if (filter === "badWords") {
    const words = settings.badWords?.words || [];
    embed.addFields({
      name: "Words",
      value: words.length ? words.join(", ") : "None",
      inline: false,
    });
  }
  embed.addFields({
    name: "Timeout",
    value: `${settings.timeoutDuration || 5} min`,
    inline: true,
  });

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

export async function handleFilterStatus(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchChatFilters) {
    return interaction.editReply({
      content: "❌ Filters repository unavailable.",
      ephemeral: true,
    });
  }

  const settings =
    await storage.dbManager.twitchChatFilters.getByGuild(guildId);
  const embed = new EmbedBuilder()
    .setTitle("🛡️ Twitch Chat Filters")
    .setColor(THEME.TWITCH)
    .setTimestamp();

  const filters = [
    {
      name: "Caps Lock",
      data: settings.caps,
      detail: `threshold: ${settings.caps?.threshold || 70}%, min: ${settings.caps?.minLength || 10}`,
    },
    { name: "Links", data: settings.links, detail: "blocks all URLs" },
    {
      name: "Spam",
      data: settings.spam,
      detail: `repeat: ${settings.spam?.repeatedMessages || 3}, rate: ${settings.spam?.rateThreshold || 5}/5s`,
    },
    {
      name: "Bad Words",
      data: settings.badWords,
      detail: `${(settings.badWords?.words || []).length} words`,
    },
  ];

  embed.addFields({
    name: "Status",
    value: settings.enabled
      ? "✅ All filters enabled"
      : "❌ All filters disabled",
    inline: false,
  });

  for (const f of filters) {
    const status = f.data?.enabled ? "✅" : "❌";
    embed.addFields({
      name: `${status} ${f.name}`,
      value: f.detail,
      inline: true,
    });
  }

  embed.addFields({
    name: "Timeout Duration",
    value: `${settings.timeoutDuration || 5} minutes`,
    inline: true,
  });

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

// ============================================================================
// QUOTE HANDLERS
// ============================================================================

export async function handleQuoteAdd(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const text = interaction.options.getString("text");
  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchQuotes) {
    return interaction.editReply({
      content: "❌ Quotes repository unavailable.",
      ephemeral: true,
    });
  }

  const doc = await storage.dbManager.twitchQuotes.add(
    guildId,
    text,
    interaction.user.tag,
  );
  const prefix = connection.commandPrefix || "!";
  await interaction.editReply({
    content: `✅ Quote #${doc.id} added. Twitch chat: \`${prefix}quote ${doc.id}\``,
    ephemeral: true,
  });
}

export async function handleQuoteRemove(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const id = interaction.options.getInteger("id");
  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchQuotes) {
    return interaction.editReply({
      content: "❌ Quotes repository unavailable.",
      ephemeral: true,
    });
  }

  const existing = await storage.dbManager.twitchQuotes.getById(guildId, id);
  if (!existing) {
    return interaction.editReply({
      content: `❌ Quote #${id} not found.`,
      ephemeral: true,
    });
  }

  await storage.dbManager.twitchQuotes.remove(guildId, id);
  await interaction.editReply({
    content: `✅ Quote #${id} removed.`,
    ephemeral: true,
  });
}

export async function handleQuoteList(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchQuotes) {
    return interaction.editReply({
      content: "❌ Quotes repository unavailable.",
      ephemeral: true,
    });
  }

  const quotes = await storage.dbManager.twitchQuotes.list(guildId);

  const embed = new EmbedBuilder()
    .setTitle(`📝 Twitch Quotes (${quotes.length})`)
    .setColor(THEME.TWITCH)
    .setTimestamp();

  if (quotes.length === 0) {
    embed.setDescription(
      "No quotes yet. Add one with `/stream quote-add` or `!quote add <text>` in Twitch chat.",
    );
  } else {
    const lines = quotes.map(
      q =>
        `**#${q.id}**: ${q.text.slice(0, 100)}${q.text.length > 100 ? "..." : ""}`,
    );
    embed.setDescription(lines.join("\n"));
  }

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

// ============================================================================
// TIMER HANDLERS
// ============================================================================

export async function handleTimerAdd(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const name = interaction.options.getString("name").toLowerCase();
  const message = interaction.options.getString("message");
  const interval = interaction.options.getInteger("interval") || 300;

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchTimers) {
    return interaction.editReply({
      content: "❌ Timers repository unavailable.",
      ephemeral: true,
    });
  }

  const existing = await storage.dbManager.twitchTimers.getByName(
    guildId,
    name,
  );
  if (existing) {
    return interaction.editReply({
      content: `❌ Timer \`${name}\` already exists. Use a different name or remove it first.`,
      ephemeral: true,
    });
  }

  await storage.dbManager.twitchTimers.create(guildId, {
    name,
    message,
    intervalMs: interval * 1000,
    createdBy: interaction.user.id,
  });

  await interaction.editReply({
    content: `✅ Timer \`${name}\` created. Sends every ${interval}s when stream is live.`,
    ephemeral: true,
  });
}

export async function handleTimerRemove(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const name = interaction.options.getString("name").toLowerCase();
  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchTimers) {
    return interaction.editReply({
      content: "❌ Timers repository unavailable.",
      ephemeral: true,
    });
  }

  const existing = await storage.dbManager.twitchTimers.getByName(
    guildId,
    name,
  );
  if (!existing) {
    return interaction.editReply({
      content: `❌ Timer \`${name}\` not found.`,
      ephemeral: true,
    });
  }

  await storage.dbManager.twitchTimers.remove(guildId, name);
  await interaction.editReply({
    content: `✅ Timer \`${name}\` removed.`,
    ephemeral: true,
  });
}

export async function handleTimerList(interaction, guildId) {
  const connection = await getGuildTwitchConnection(guildId);
  if (!connection) {
    return interaction.editReply({
      content:
        "❌ This server has no Twitch channel connected. Start with `/stream connect`.",
      ephemeral: true,
    });
  }

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  if (!storage.dbManager?.twitchTimers) {
    return interaction.editReply({
      content: "❌ Timers repository unavailable.",
      ephemeral: true,
    });
  }

  const timers = await storage.dbManager.twitchTimers.listByGuild(guildId);

  const embed = new EmbedBuilder()
    .setTitle(`⏰ Twitch Timers (${timers.length})`)
    .setColor(THEME.TWITCH)
    .setTimestamp();

  if (timers.length === 0) {
    embed.setDescription("No timers yet. Add one with `/stream timer-add`.");
  } else {
    const lines = timers.map(t => {
      const intervalSec = Math.round(t.intervalMs / 1000);
      const status = t.enabled ? "✅" : "❌";
      return `${status} **${t.name}** — every ${intervalSec}s — "${t.message.slice(0, 50)}${t.message.length > 50 ? "..." : ""}"`;
    });
    embed.setDescription(lines.join("\n"));
  }

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

// ============================================================================
// DIAGNOSTICS HANDLER
// ============================================================================

export async function handleDiag(interaction, streamingManager, guildId) {
  const { getStreamConnections } = await import(
    "../../../features/streaming/utils/streamConfig.js"
  );
  const connections = await getStreamConnections(guildId);

  const { getStreamBotAccount } = await import(
    "../../../features/streaming/utils/streamBotAccount.js"
  );
  const bot = await getStreamBotAccount().catch(() => null);

  const { getStorageManager } = await import(
    "../../../utils/storage/storageManager.js"
  );
  const storage = await getStorageManager();
  let cmdCount = 0;
  if (storage.dbManager?.twitchCommands) {
    cmdCount = (await storage.dbManager.twitchCommands.listByGuild(guildId))
      .length;
  }

  const eventSubOpen =
    streamingManager.eventSubClient?.sessions?.some(s => s.ready) ?? false;

  const embed = new EmbedBuilder()
    .setTitle("🔍 Stream Diagnostics")
    .setColor(THEME.TWITCH)
    .setTimestamp();

  if (connections.length === 0) {
    embed.addFields({
      name: "Twitch Connection",
      value: "❌ None connected. Run `/stream connect`.",
      inline: false,
    });
  } else {
    const conn = connections[0];
    embed.addFields({
      name: `Twitch Connection (${conn.platformLogin})`,
      value: [
        `**EventSub:** ${eventSubOpen ? "✅ Connected" : "❌ Not connected"}`,
        `**Sessions:** ${streamingManager.eventSubClient?.sessions?.length ?? 0} pooled`,
        `**Alerts:** ${conn.alertsEnabled ? "✅" : "❌"} ${conn.alertChannelId ? `<#${conn.alertChannelId}>` : "not set"}`,
        `**Commands:** ${conn.commandsEnabled ? "✅" : "❌"} (prefix \`${conn.commandPrefix || "!"}\`, ${cmdCount} defined)`,
      ].join("\n"),
      inline: false,
    });
  }

  if (bot && bot.botUserId) {
    const sourceTxt =
      bot.source === "env" ? "env (TWITCH_BOT_*)" : "db (/stream bot-connect)";
    const tokenTxt =
      bot.source === "env"
        ? "n/a (App token used to send)"
        : bot.accessToken &&
            (!bot.tokenExpiresAt ||
              new Date(bot.tokenExpiresAt).getTime() > Date.now())
          ? "✅ valid"
          : "⚠️ expired — re-run /stream bot-connect";
    embed.addFields({
      name: "Bot Account (chat sender)",
      value: `✅ **${bot.login || bot.botUserId}** (\`${bot.botUserId}\`)\nSource: ${sourceTxt}\nToken: ${tokenTxt}`,
      inline: false,
    });
  } else {
    embed.addFields({
      name: "Bot Account (chat sender)",
      value:
        "❌ Not linked. Set TWITCH_BOT_USER_ID (env) or run `/stream bot-connect` (required to send replies).",
      inline: true,
    });
  }

  const conn = connections[0];
  const channelBotGranted = !!(conn && conn.accessToken);
  embed.addFields({
    name: "Channel:bot grant (per broadcaster)",
    value: channelBotGranted
      ? `✅ granted via '/stream connect' (broadcaster ${conn?.platformLogin || "?"})`
      : "❌ broadcaster not connected (`/stream connect`)",
    inline: false,
  });

  const fmt = ts => (ts ? `<t:${Math.floor(ts / 1000)}:R>` : "never");
  embed.addFields({
    name: "Recent Activity",
    value: `**Last chat received:** ${fmt(streamingManager.lastChatAt)}\n**Last command reply:** ${fmt(streamingManager.lastCommandReplyAt)}`,
    inline: false,
  });

  await interaction.editReply({ embeds: [embed] });
}
