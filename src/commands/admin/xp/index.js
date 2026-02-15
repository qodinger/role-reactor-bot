import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleXpCommand } from "./handlers.js";

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
  name: "xp",
  category: "admin",
  description:
    "Manage the XP system settings, level rewards, and configuration",
  keywords: [
    "xp",
    "experience",
    "level",
    "settings",
    "config",
    "points",
    "rewards",
    "roles",
  ],
  emoji: "📈",
  helpFields: [
    {
      name: `How to Use`,
      value:
        "```/xp settings\n/xp rewards add\n/xp rewards remove\n/xp rewards list\n/xp rewards mode```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "No parameters needed for settings - just run the subcommand to access the XP system settings!",
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**settings** - View and configure XP system settings",
        "**rewards add** - Add a role reward for reaching a level",
        "**rewards remove** - Remove a level reward",
        "**rewards list** - View all configured level rewards",
        "**rewards mode** - Set reward mode (stack or replace)",
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
        "Interactive XP system management interface with buttons to:",
        "• Toggle the entire XP system on/off",
        "• Enable/disable message XP, command XP, role XP, and voice XP individually",
        "• View current XP amounts, cooldowns, and settings",
        "• Access configuration help and reset options",
        "• Configure level-based role rewards",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Quick Actions`,
      value: [
        "Use the buttons to quickly toggle features on/off",
        "All changes are applied immediately",
        "Settings use optimized default values",
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
  .addSubcommand(subcommand =>
    subcommand
      .setName("settings")
      .setDescription("View and configure XP system settings"),
  )
  .addSubcommandGroup(group =>
    group
      .setName("rewards")
      .setDescription("Manage level-based role rewards")
      .addSubcommand(sub =>
        sub
          .setName("add")
          .setDescription("Add a role reward for reaching a specific level")
          .addIntegerOption(option =>
            option
              .setName("level")
              .setDescription("The level required to earn this role")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(100),
          )
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role to award")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove")
          .setDescription("Remove a level reward")
          .addIntegerOption(option =>
            option
              .setName("level")
              .setDescription("The level of the reward to remove")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(100),
          )
          .addRoleOption(option =>
            option
              .setName("role")
              .setDescription("The role to remove from rewards")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub.setName("list").setDescription("View all configured level rewards"),
      )
      .addSubcommand(sub =>
        sub
          .setName("mode")
          .setDescription(
            "Set reward mode: stack (keep all) or replace (highest only)",
          )
          .addStringOption(option =>
            option
              .setName("mode")
              .setDescription("The reward mode")
              .setRequired(true)
              .addChoices(
                { name: "Stack — Keep all earned roles", value: "stack" },
                {
                  name: "Replace — Only keep the highest role (Pro)",
                  value: "replace",
                },
              ),
          ),
      ),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Validate user permissions first
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Manage Server permissions to configure the XP system.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === "rewards") {
      const { handleRewardsCommand } = await import("./handlers.js");
      return await handleRewardsCommand(interaction, subcommand, client);
    }

    switch (subcommand) {
      case "settings":
        await handleXpCommand(interaction, client);
        break;
      default:
        await interaction.reply(
          errorEmbed({
            title: "Unknown Subcommand",
            description: "The requested subcommand is not available.",
            solution: "Please use a valid subcommand.",
          }),
        );
    }
  } catch (error) {
    logger.error("Error in xp command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process XP command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
