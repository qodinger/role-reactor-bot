import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleAutomodCommand } from "./handlers.js";
import { CORE_STATUS } from "../../../features/premium/config.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "automod",
  category: "admin",
  description: "Configure auto-moderation settings",
  keywords: ["automod", "auto-mod", "moderation", "spam", "filter", "badwords"],
  emoji: "🛡️",
  createdAt: "2026-04-23",
  premium: false, // Has free tier + premium features
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/automod settings```",
        "```/automod enable```",
        "```/automod disable```",
        "```/automod badwords toggle enabled:true```",
        "```/automod badwords words word1,word2,word3```",
        "```/automod badwords mode:wildcard words:spam*,f*ll*w*rs``` (Pro)",
        "```/automod badwords mode:regex words:\\d{3}-\\d{4}``` (Pro)",
        "```/automod links toggle enabled:true```",
        "```/automod spam toggle enabled:true```",
        "```/automod domains add discord.com,youtube.com```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands (Free)`,
      value: [
        "**settings** - Interactive settings panel",
        "**enable** - Enable all configured filters",
        "**disable** - Disable all filters",
        "**badwords toggle** - Enable or disable bad words filter",
        "**badwords words** - Set bad words list (comma separated)",
        "**links toggle** - Enable or disable link filter",
        "**spam toggle** - Enable or disable spam detection",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands (${CORE_STATUS.PRO.emoji} Pro Engine)`,
      value: [
        "**domains add** - Allowlist domains",
        "**caps-lock toggle** - Block CAPS messages",
        "**badwords mode:wildcard** - Words with * (spam*, *bad)",
        "**badwords mode:regex** - Regex patterns (\\d{3}-\\d{4})",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Server** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: [
        "Auto-moderation helps keep your server safe by automatically:",
        "• Filtering bad words in messages",
        "• Blocking suspicious links",
        "• Detecting spam (repeated messages)",
        "• Allowlisting trusted domains (Pro)",
      ].join("\n"),
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommandGroup(group =>
    group
      .setName("badwords")
      .setDescription("Bad words filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable bad words filter")
          .addBooleanOption(opt =>
            opt
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addStringOption(opt =>
            opt
              .setName("action")
              .setDescription("Action when bad word detected")
              .setChoices(
                { name: "Delete message only", value: "delete" },
                { name: "Delete + Timeout", value: "timeout" },
              )
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60)
              .setRequired(false),
          )
          .addBooleanOption(opt =>
            opt
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)")
              .setRequired(false),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("words")
          .setDescription("Set bad words list (comma separated)")
          .addStringOption(opt =>
            opt
              .setName("words")
              .setDescription("Words to filter")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("links")
      .setDescription("Link filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable link filter")
          .addBooleanOption(opt =>
            opt
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addStringOption(opt =>
            opt
              .setName("action")
              .setDescription("Action when link detected")
              .setChoices(
                { name: "Delete message only", value: "delete" },
                { name: "Delete + Timeout", value: "timeout" },
              )
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60)
              .setRequired(false),
          )
          .addBooleanOption(opt =>
            opt
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)")
              .setRequired(false),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("spam")
      .setDescription("Spam detection settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable spam detection")
          .addBooleanOption(opt =>
            opt
              .setName("enabled")
              .setDescription("Enable detection?")
              .setRequired(true),
          )
          .addIntegerOption(opt =>
            opt
              .setName("threshold")
              .setDescription("Repeated messages to trigger (3-10)")
              .setMinValue(2)
              .setMaxValue(10)
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("rate-threshold")
              .setDescription("Messages per 5s to trigger spam (3-10)")
              .setMinValue(3)
              .setMaxValue(10)
              .setRequired(false),
          )
          .addStringOption(opt =>
            opt
              .setName("action")
              .setDescription("Action when spam detected")
              .setChoices(
                { name: "Delete message only", value: "delete" },
                { name: "Delete + Timeout", value: "timeout" },
              )
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60)
              .setRequired(false),
          )
          .addBooleanOption(opt =>
            opt
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)")
              .setRequired(false),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("domains")
      .setDescription("Domain allowlist settings (Pro)")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription("Add domains to allowlist (Pro)")
          .addStringOption(opt =>
            opt
              .setName("domains")
              .setDescription(
                "Domains to allow, comma separated (e.g., discord.com, youtube.com)",
              )
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove domains from allowlist (Pro)")
          .addStringOption(opt =>
            opt
              .setName("domains")
              .setDescription("Domains to remove, comma separated")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub.setName("clear").setDescription("Clear all allowed domains (Pro)"),
      )
      .addSubcommand(sub =>
        sub.setName("list").setDescription("Show allowed domains (Pro)"),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("mention-spam")
      .setDescription("Mention spam filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable mention spam filter")
          .addBooleanOption(opt =>
            opt
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addIntegerOption(opt =>
            opt
              .setName("mention-count")
              .setDescription("Number of mentions to trigger (3-10)")
              .setMinValue(3)
              .setMaxValue(10)
              .setRequired(false),
          )
          .addStringOption(opt =>
            opt
              .setName("action")
              .setDescription("Action when spam detected")
              .setChoices(
                { name: "Delete message only", value: "delete" },
                { name: "Delete + Timeout", value: "timeout" },
              )
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60)
              .setRequired(false),
          )
          .addBooleanOption(opt =>
            opt
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)")
              .setRequired(false),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("invite")
      .setDescription("Invite link filter settings")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable invite link filter")
          .addBooleanOption(opt =>
            opt
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addStringOption(opt =>
            opt
              .setName("action")
              .setDescription("Action when invite detected")
              .setChoices(
                { name: "Delete message only", value: "delete" },
                { name: "Delete + Timeout", value: "timeout" },
              )
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60)
              .setRequired(false),
          )
          .addBooleanOption(opt =>
            opt
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)")
              .setRequired(false),
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("caps-lock")
      .setDescription("Caps lock filter (Pro)")
      .addSubcommand(sub =>
        sub
          .setName("toggle")
          .setDescription("Enable or disable caps lock filter (Pro)")
          .addBooleanOption(opt =>
            opt
              .setName("enabled")
              .setDescription("Enable filter?")
              .setRequired(true),
          )
          .addIntegerOption(opt =>
            opt
              .setName("threshold")
              .setDescription("Percentage of caps required (50-100)")
              .setMinValue(50)
              .setMaxValue(100)
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("min-length")
              .setDescription("Minimum message length to check")
              .setMinValue(5)
              .setMaxValue(50)
              .setRequired(false),
          )
          .addStringOption(opt =>
            opt
              .setName("action")
              .setDescription("Action when detected")
              .setChoices(
                { name: "Delete message only", value: "delete" },
                { name: "Delete + Timeout", value: "timeout" },
              )
              .setRequired(false),
          )
          .addIntegerOption(opt =>
            opt
              .setName("timeout-duration")
              .setDescription("Timeout duration in minutes (1-60)")
              .setMinValue(1)
              .setMaxValue(60)
              .setRequired(false),
          )
          .addBooleanOption(opt =>
            opt
              .setName("ignore-admins")
              .setDescription("Ignore admins/mods (don't timeout)")
              .setRequired(false),
          ),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("badwords")
      .setDescription("Advanced bad words settings (Pro)")
      .addStringOption(opt =>
        opt
          .setName("mode")
          .setDescription("Matching mode")
          .setChoices(
            { name: "Simple (exact words)", value: "simple" },
            { name: "Wildcards (* matches any)", value: "wildcard" },
            { name: "Regex (advanced patterns)", value: "regex" },
          )
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("words")
          .setDescription(
            "Words/patterns separated by commas. Wildcard: spam*, Regex: \\d{3}-\\d{4}",
          )
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("action")
          .setDescription("Action when detected")
          .setChoices(
            { name: "Delete message only", value: "delete" },
            { name: "Delete + Timeout", value: "timeout" },
          )
          .setRequired(false),
      )
      .addIntegerOption(opt =>
        opt
          .setName("timeout-duration")
          .setDescription("Timeout duration in minutes (1-60)")
          .setMinValue(1)
          .setMaxValue(60)
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("enable")
      .setDescription("Enable all configured auto-mod filters"),
  )
  .addSubcommand(sub =>
    sub.setName("disable").setDescription("Disable all auto-mod filters"),
  )
  .addSubcommandGroup(group =>
    group
      .setName("channel")
      .setDescription("Per-channel filtering (Pro)")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription("Add filter to a channel (Pro)")
          .addChannelOption(opt =>
            opt
              .setName("channel")
              .setDescription("Channel to add filter to")
              .setRequired(true),
          )
          .addStringOption(opt =>
            opt
              .setName("filter")
              .setDescription("Filter type to enable")
              .setChoices(
                { name: "All Filters", value: "all" },
                { name: "Bad Words", value: "badWords" },
                { name: "Links", value: "links" },
                { name: "Spam", value: "spam" },
                { name: "Mention Spam", value: "mentionSpam" },
                { name: "Invite Links", value: "inviteLink" },
                { name: "Caps Lock", value: "capsLock" },
              )
              .setRequired(false),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove filter from a channel")
          .addChannelOption(opt =>
            opt
              .setName("channel")
              .setDescription("Channel to remove filter from")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub.setName("list").setDescription("List all channel filters"),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("stats")
      .setDescription("Auto-mod statistics (Pro)")
      .addSubcommand(sub =>
        sub.setName("show").setDescription("Show violation statistics"),
      )
      .addSubcommand(sub =>
        sub.setName("export").setDescription("Export moderation logs as CSV"),
      )
      .addSubcommand(sub =>
        sub.setName("clear").setDescription("Clear all statistics and logs"),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("enable")
      .setDescription("Enable all configured auto-mod filters"),
  )
  .addSubcommand(sub =>
    sub.setName("disable").setDescription("Disable all auto-mod filters"),
  )
  .addSubcommand(sub =>
    sub.setName("settings").setDescription("Interactive settings panel"),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to configure the auto-moderation system.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    await handleAutomodCommand(interaction);
  } catch (error) {
    logger.error("Error in automod command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process automod command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
