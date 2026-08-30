import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import {
  handleConnect,
  handleBotConnect,
  handleDisconnect,
  handleConfig,
  handleStatus,
  handleAlertTest,
  handleCommandAdd,
  handleCommandRemove,
  handleCommandList,
  handleCommandEdit,
  handleFilterToggle,
  handleFilterConfig,
  handleFilterStatus,
  handleQuoteAdd,
  handleQuoteRemove,
  handleQuoteList,
  handleTimerAdd,
  handleTimerRemove,
  handleTimerList,
  handleDiag,
} from "./handlers.js";

const logger = getLogger();

// ============================================================================
// COMMAND METADATA
// ============================================================================

export const metadata = {
  name: "stream",
  category: "admin",
  description: "Manage Twitch streaming integration",
  keywords: [
    "stream",
    "twitch",
    "live",
    "alerts",
    "chat",
    "filters",
    "moderation",
  ],
  emoji: "🔴",
  premium: false,
  helpFields: [
    {
      name: "How to Use",
      value: [
        "`/stream connect` — Connect the server's Twitch channel",
        "`/stream config` — Set alert and chat-command options",
        "`/stream status` — See whether Twitch features are running",
        "`/stream command-list` — View built-in and custom chat commands",
        "`/stream command-add` — Add a custom chat command",
        "`/stream command-edit` — Change a custom command",
        "`/stream command-remove` — Delete a custom command",
        "`/stream filter-toggle` — Enable/disable chat filters",
        "`/stream filter-config` — Configure filter thresholds and bad words",
        "`/stream filter-status` — Show current filter settings",
        "`/stream quote-add` — Add a quote for Twitch chat",
        "`/stream quote-remove` — Remove a Twitch chat quote",
        "`/stream quote-list` — List all Twitch chat quotes",
        "`/stream timer-add` — Add a periodic auto-message (when live)",
        "`/stream timer-remove` — Remove a timer",
        "`/stream timer-list` — List all timers",
        "`/stream alert-test` — Preview a stream alert in Discord",
        "`/stream bot-connect` — One-time global bot-account setup (server owner)",
        "`/stream diag` — Show detailed troubleshooting information",
      ].join("\n"),
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DATA
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("stream")
  .setDescription("Manage Twitch streaming integration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub
      .setName("connect")
      .setDescription("Connect the server's Twitch channel via OAuth"),
  )
  .addSubcommand(sub =>
    sub
      .setName("disconnect")
      .setDescription("Disconnect the server's Twitch channel"),
  )
  .addSubcommand(sub =>
    sub
      .setName("config")
      .setDescription("Set alert and chat-command options")
      .addChannelOption(opt =>
        opt
          .setName("alert_channel")
          .setDescription("Discord channel for stream alerts")
          .addChannelTypes(ChannelType.GuildText),
      )
      .addBooleanOption(opt =>
        opt
          .setName("alerts_enabled")
          .setDescription("Enable stream alerts in Discord"),
      )
      .addBooleanOption(opt =>
        opt
          .setName("commands_enabled")
          .setDescription("Enable Twitch chat commands"),
      )
      .addStringOption(opt =>
        opt
          .setName("command_prefix")
          .setDescription("One-character prefix for chat commands (usually !)")
          .setMinLength(1)
          .setMaxLength(1)
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("alert_type")
          .setDescription("Toggle a specific alert type")
          .addChoices(
            { name: "Go Live", value: "goLive" },
            { name: "Offline", value: "offline" },
            { name: "Follow", value: "follow" },
            { name: "Subscribe", value: "subscribe" },
            { name: "Gift Sub", value: "giftSub" },
            { name: "Raid", value: "raid" },
            { name: "Resub", value: "resub" },
          )
          .setRequired(false),
      )
      .addBooleanOption(opt =>
        opt
          .setName("alert_type_enabled")
          .setDescription("Enable or disable the selected alert type")
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("status")
      .setDescription("See whether Twitch features are running"),
  )
  .addSubcommand(sub =>
    sub
      .setName("alert-test")
      .setDescription("Preview a stream alert in the alert channel")
      .addStringOption(opt =>
        opt
          .setName("type")
          .setDescription("Type of test alert")
          .setRequired(false)
          .addChoices(
            { name: "Go Live", value: "goLive" },
            { name: "Offline", value: "offline" },
            { name: "Follow", value: "follow" },
            { name: "Subscribe", value: "subscribe" },
            { name: "Gift Sub", value: "giftSub" },
            { name: "Raid", value: "raid" },
            { name: "Resub", value: "resub" },
          ),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("bot-connect")
      .setDescription(
        "Connect the RoleReactor bot Twitch account (guild owner only)",
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("command-add")
      .setDescription("Add a custom Twitch chat command")
      .addStringOption(opt =>
        opt
          .setName("name")
          .setDescription("Name without the prefix, e.g. discord")
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("response")
          .setDescription(
            "Reply text; supports {user}, {channel}, {title}, and {uptime}",
          )
          .setMinLength(1)
          .setMaxLength(500)
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("description")
          .setDescription("Short help text shown by the chat command list")
          .setMaxLength(100)
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("userlevel")
          .setDescription(
            "Minimum permission to use this command (default: everyone)",
          )
          .addChoices(
            { name: "everyone", value: "everyone" },
            { name: "subscriber", value: "subscriber" },
            { name: "vip", value: "vip" },
            { name: "moderator", value: "moderator" },
            { name: "owner", value: "owner" },
          )
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("command-remove")
      .setDescription("Delete a custom Twitch chat command")
      .addStringOption(opt =>
        opt
          .setName("name")
          .setDescription("Name without the prefix, e.g. discord")
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("command-list")
      .setDescription("List built-in and custom Twitch chat commands"),
  )
  .addSubcommand(sub =>
    sub
      .setName("command-edit")
      .setDescription("Change a custom Twitch chat command")
      .addStringOption(opt =>
        opt
          .setName("name")
          .setDescription("Name without the prefix, e.g. discord")
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("response")
          .setDescription("New reply text")
          .setMinLength(1)
          .setMaxLength(500)
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("description")
          .setDescription("New help text")
          .setMaxLength(100)
          .setRequired(false),
      )
      .addBooleanOption(opt =>
        opt
          .setName("enabled")
          .setDescription("Enable or disable the command")
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("userlevel")
          .setDescription("Minimum permission to use this command")
          .addChoices(
            { name: "everyone", value: "everyone" },
            { name: "subscriber", value: "subscriber" },
            { name: "vip", value: "vip" },
            { name: "moderator", value: "moderator" },
            { name: "owner", value: "owner" },
          )
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("filter-toggle")
      .setDescription("Enable or disable a Twitch chat filter")
      .addStringOption(opt =>
        opt
          .setName("filter")
          .setDescription("Which filter to toggle")
          .addChoices(
            { name: "All filters", value: "all" },
            { name: "Caps lock", value: "caps" },
            { name: "Links", value: "links" },
            { name: "Spam (repeated/rapid messages)", value: "spam" },
            { name: "Bad words", value: "badWords" },
          )
          .setRequired(true),
      )
      .addBooleanOption(opt =>
        opt
          .setName("enabled")
          .setDescription("Enable or disable the filter")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("filter-config")
      .setDescription("Configure a Twitch chat filter")
      .addStringOption(opt =>
        opt
          .setName("filter")
          .setDescription("Which filter to configure")
          .addChoices(
            { name: "Caps lock", value: "caps" },
            { name: "Spam", value: "spam" },
            { name: "Bad words", value: "badWords" },
          )
          .setRequired(true),
      )
      .addIntegerOption(opt =>
        opt
          .setName("threshold")
          .setDescription(
            "Caps: uppercase percentage threshold (50-100, default 70)",
          )
          .setMinValue(50)
          .setMaxValue(100)
          .setRequired(false),
      )
      .addIntegerOption(opt =>
        opt
          .setName("min_length")
          .setDescription("Caps: minimum message length to check (default 10)")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(false),
      )
      .addIntegerOption(opt =>
        opt
          .setName("repeated_messages")
          .setDescription("Spam: repeated message count to trigger (default 3)")
          .setMinValue(2)
          .setMaxValue(10)
          .setRequired(false),
      )
      .addIntegerOption(opt =>
        opt
          .setName("rate_threshold")
          .setDescription("Spam: messages per 5s to trigger (default 5)")
          .setMinValue(2)
          .setMaxValue(20)
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("add_words")
          .setDescription("Bad words: comma-separated words to add")
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("remove_words")
          .setDescription("Bad words: comma-separated words to remove")
          .setRequired(false),
      )
      .addIntegerOption(opt =>
        opt
          .setName("timeout_duration")
          .setDescription(
            "Timeout duration in minutes for all filters (default 5)",
          )
          .setMinValue(1)
          .setMaxValue(1440)
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("filter-status")
      .setDescription("Show current Twitch chat filter settings"),
  )
  .addSubcommand(sub =>
    sub
      .setName("quote-add")
      .setDescription("Add a quote for Twitch chat (!quote)")
      .addStringOption(opt =>
        opt
          .setName("text")
          .setDescription("Quote text")
          .setMaxLength(500)
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("quote-remove")
      .setDescription("Remove a Twitch chat quote")
      .addIntegerOption(opt =>
        opt
          .setName("id")
          .setDescription("Quote number to remove")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub.setName("quote-list").setDescription("List all Twitch chat quotes"),
  )
  .addSubcommand(sub =>
    sub
      .setName("timer-add")
      .setDescription("Add a periodic auto-message for Twitch chat (when live)")
      .addStringOption(opt =>
        opt
          .setName("name")
          .setDescription("Timer name (unique)")
          .setMinLength(1)
          .setMaxLength(32)
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("message")
          .setDescription("Message to send")
          .setMinLength(1)
          .setMaxLength(500)
          .setRequired(true),
      )
      .addIntegerOption(opt =>
        opt
          .setName("interval")
          .setDescription("Interval in seconds (default 300 = 5 min)")
          .setMinValue(30)
          .setMaxValue(3600)
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("timer-remove")
      .setDescription("Remove a Twitch chat timer")
      .addStringOption(opt =>
        opt
          .setName("name")
          .setDescription("Timer name to remove")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub.setName("timer-list").setDescription("List all Twitch chat timers"),
  )
  .addSubcommand(sub =>
    sub
      .setName("diag")
      .setDescription("Show detailed Twitch troubleshooting information"),
  );

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const { getStreamingManager } = await import(
      "../../../features/streaming/StreamingManager.js"
    );
    const streamingManager = getStreamingManager(client);

    switch (subcommand) {
      case "connect":
        await handleConnect(interaction, streamingManager, userId, guildId);
        break;
      case "disconnect":
        await handleDisconnect(interaction, streamingManager, userId, guildId);
        break;
      case "config":
        await handleConfig(interaction, streamingManager, userId, guildId);
        break;
      case "status":
        await handleStatus(interaction, streamingManager, guildId);
        break;
      case "alert-test":
        await handleAlertTest(interaction, streamingManager, guildId);
        break;
      case "bot-connect":
        await handleBotConnect(interaction, streamingManager, userId, guildId);
        break;
      case "command-add":
        await handleCommandAdd(interaction, guildId);
        break;
      case "command-remove":
        await handleCommandRemove(interaction, guildId);
        break;
      case "command-list":
        await handleCommandList(interaction, guildId);
        break;
      case "command-edit":
        await handleCommandEdit(interaction, guildId);
        break;
      case "filter-toggle":
        await handleFilterToggle(interaction, guildId);
        break;
      case "filter-config":
        await handleFilterConfig(interaction, guildId);
        break;
      case "filter-status":
        await handleFilterStatus(interaction, guildId);
        break;
      case "quote-add":
        await handleQuoteAdd(interaction, guildId);
        break;
      case "quote-remove":
        await handleQuoteRemove(interaction, guildId);
        break;
      case "quote-list":
        await handleQuoteList(interaction, guildId);
        break;
      case "timer-add":
        await handleTimerAdd(interaction, guildId);
        break;
      case "timer-remove":
        await handleTimerRemove(interaction, guildId);
        break;
      case "timer-list":
        await handleTimerList(interaction, guildId);
        break;
      case "diag":
        await handleDiag(interaction, streamingManager, guildId);
        break;
      default:
        await interaction.editReply({
          content: "Unknown subcommand",
          ephemeral: true,
        });
    }
  } catch (error) {
    logger.error("Stream command error", error);
    if (interaction.replied || interaction.deferred) {
      try {
        await interaction.editReply({ content: "❌ An error occurred" });
      } catch {
        /* interaction may have already expired */
      }
    } else {
      await interaction.editReply({
        content: "❌ An error occurred",
        ephemeral: true,
      });
    }
  }
}
