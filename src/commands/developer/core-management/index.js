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
  description: "Manage user bonus Cores (donation Cores only)",
  keywords: [
    "core-management",
    "core",
    "credits",
    "manage",
    "donation",
    "bonus",
  ],
  emoji: "⚙️",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/core-management add user:@username amount:10 reason:Donation bonus```",
        "```/core-management remove user:@username amount:5 reason:Refund```",
        "```/core-management set user:@username amount:100 reason:Reset balance```",
        "```/core-management view user:@username```",
        "```/core-management add-donation user:@username amount:5.00 ko-fi-url:https://ko-fi.com/...```",
        "```/core-management cancel-subscription user:@username reason:User request```",
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
        "**add-donation** - **user** *(required)*, **amount** *(required)*, **ko-fi-url** *(optional)*, **reason** *(optional)*",
        "**cancel-subscription** - **user** *(required)*, **reason** *(optional)*",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**add** - Add bonus Cores (donation Cores only) to a user's account",
        "**remove** - Remove bonus Cores (donation Cores only) from a user's account",
        "**set** - Set a user's bonus Core balance to a specific amount (donation Cores only, not subscription Cores)",
        "**view** - View a user's Core information and breakdown",
        "**add-donation** - Verify a Ko-fi donation and grant bonus Cores",
        "**cancel-subscription** - Manually cancel a user's Core subscription",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Options`,
      value: [
        "**user** *(required)* - The user to manage Cores for",
        "**amount** *(required)* - Amount of Cores to add/remove/set (1-10000 for add/remove, 0-10000 for set)",
        "**reason** *(optional)* - Reason for the Core management action",
        "**ko-fi-url** *(optional for add-donation)* - Ko-fi donation URL for verification",
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
      .setDescription(
        "🔒 [DEVELOPER ONLY] Add bonus Cores (donation Cores only)",
      )
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
      .setDescription(
        "🔒 [DEVELOPER ONLY] Remove bonus Cores (donation Cores only)",
      )
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
        "🔒 [DEVELOPER ONLY] Set bonus Cores (donation Cores only, not subscription Cores)",
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
  .addSubcommand(subcommand =>
    subcommand
      .setName("add-donation")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Verify a Ko-fi donation and grant bonus Cores",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to grant bonus Cores to")
          .setRequired(true),
      )
      .addNumberOption(option =>
        option
          .setName("amount")
          .setDescription("Donation amount in USD")
          .setRequired(true)
          .setMinValue(0.01)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("ko-fi-url")
          .setDescription("Ko-fi donation URL (optional)")
          .setRequired(false),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for verification (optional)")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("cancel-subscription")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Manually cancel a user's Core subscription",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to cancel Core subscription for")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for cancellation (optional)")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list-pending")
      .setDescription(
        "🔒 [DEVELOPER ONLY] List all pending Buy Me a Coffee payments",
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("process-pending")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Process a pending Buy Me a Coffee payment",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The Discord user to link the payment to")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("transaction-id")
          .setDescription("Transaction ID of the pending payment")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for processing (optional)")
          .setRequired(false)
          .setMaxLength(200),
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
