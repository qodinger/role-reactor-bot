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
  premium: false, // Main command is free, only domains subcommand group is premium
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/automod toggle enabled:true```",
        "```/automod status```",
        "```/automod badwords toggle enabled:true```",
        "```/automod badwords words word1,word2,word3```",
        "```/automod links toggle enabled:true```",
        "```/automod spam toggle enabled:true```",
        "```/automod domains add discord.com,youtube.com```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands (Free)`,
      value: [
        "**toggle** - Enable or disable all auto-moderation",
        "**status** - Show current automod settings",
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
        "**domains add** - Allowlist domains (links from these domains are allowed)",
        "**domains remove** - Remove domains from allowlist",
        "**domains clear** - Clear all allowed domains",
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
          ),
      ),
  )
  .addSubcommandGroup(group =>
    group
      .setName("domains")
      .setDescription("Domain allowlist settings (Pro Engine)")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription("Add domains to allowlist (comma separated)")
          .addStringOption(opt =>
            opt
              .setName("domains")
              .setDescription(
                "Domains to allow (e.g., discord.com, youtube.com)",
              )
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove domains from allowlist (comma separated)")
          .addStringOption(opt =>
            opt
              .setName("domains")
              .setDescription("Domains to remove")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub.setName("clear").setDescription("Clear all allowed domains"),
      )
      .addSubcommand(sub =>
        sub.setName("list").setDescription("Show allowed domains"),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("toggle")
      .setDescription("Enable or disable all auto-moderation")
      .addBooleanOption(opt =>
        opt
          .setName("enabled")
          .setDescription("Enable automod?")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub.setName("status").setDescription("Show current automod settings"),
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
