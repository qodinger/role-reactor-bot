import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleCoreManagement } from "./handlers.js";

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
  name: "core-management",
  category: "developer",
  description: "Manage user bonus Cores",
  keywords: ["core-management", "core", "credits", "manage", "bonus"],
  emoji: "⚙️",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/core-management add user:@username amount:10 reason:Bonus credits```",
        "```/core-management remove user:@username amount:5 reason:Refund```",
        "```/core-management set user:@username amount:100 reason:Reset balance```",
        "```/core-management view user:@username```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `What You Need`,
      value: [
        "**add** - **user** *(required)*, **amount** *(required)*, **reason** *(optional)*",
        "**remove** - **user** *(required)*, **amount** *(required)*, **reason** *(optional)*",
        "**set** - **user** *(required)*, **amount** *(required)*, **reason** *(optional)*",
        "**view** - **user** *(required)*",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**add** - Add bonus Cores to a user's account",
        "**remove** - Remove bonus Cores from a user's account",
        "**set** - Set a user's bonus Core balance to a specific amount (not subscription Cores)",
        "**view** - View a user's Core information and breakdown",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Options`,
      value: [
        "**user** *(required)* - The user to manage Cores for",
        "**amount** *(required)* - Amount of Cores to add/remove/set (1-10000 for add/remove, 0-10000 for set)",
        "**reason** *(optional)* - Reason for the Core management action",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Developer** access required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Complete Core credit and tier management system for developers to add, remove, set, and monitor user Core balances and membership tiers across the entire bot!",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(`🔒 [DEVELOPER ONLY] ${metadata.description}`)
  .addSubcommand(subcommand =>
    subcommand
      .setName("add")
      .setDescription("🔒 [DEVELOPER ONLY] Add bonus Cores")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to add bonus Cores to")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of bonus Cores to add")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for adding bonus Cores")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("remove")
      .setDescription("🔒 [DEVELOPER ONLY] Remove bonus Cores")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to remove bonus Cores from")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of bonus Cores to remove")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for removing bonus Cores")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("set")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Set bonus Cores (not subscription Cores)",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to set bonus Cores for")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of bonus Cores to set")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for setting bonus Cores")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("view")
      .setDescription(
        "🔒 [DEVELOPER ONLY] View a user's Core information and breakdown",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to view Cores for")
          .setRequired(true),
      ),
  )
  .setDefaultMemberPermissions(0n) // Visible to all, but restricted by isDeveloper() check
  .setDMPermission(false);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    const deferred = await deferInteraction(interaction);
    await handleCoreManagement(interaction, client, deferred);
  } catch (error) {
    logger.error("Error in core-management command:", error);
    await handleCommandError(interaction, error);
  }
}

// ============================================================================
// INTERACTION MANAGEMENT
// ============================================================================

async function deferInteraction(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true; // Successfully deferred
  } catch (deferError) {
    if (
      deferError.message !== "Interaction has already been acknowledged." &&
      deferError.message !== "Unknown interaction"
    ) {
      const logger = getLogger();
      logger.error("Failed to defer reply:", deferError);
    }
    return false; // Failed to defer
  }
}

async function handleCommandError(interaction, _error) {
  try {
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description:
              "An unexpected error occurred while managing Core credits.",
          }),
        ],
      });
    } else {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description:
              "An unexpected error occurred while managing Core credits.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    const logger = getLogger();
    logger.error("Failed to send error response:", replyError);
  }
}
