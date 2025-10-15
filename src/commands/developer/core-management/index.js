import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleCoreManagement } from "./handlers.js";
import { config } from "../../../config/config.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

// Generate tier choices dynamically from config
function getTierChoices() {
  const choices = [{ name: "None (Remove Core status)", value: "none" }];

  // Add tiers from config
  Object.entries(config.corePricing.subscriptions).forEach(
    ([tierName, tierData]) => {
      choices.push({
        name: `${tierName} - $${tierData.price}/month (${tierData.cores} Cores)`,
        value: tierName,
      });
    },
  );

  return choices;
}

export const data = new SlashCommandBuilder()
  .setName("core-management")
  .setDescription("🔒 [DEVELOPER ONLY] Manage user Core credits (add/remove)")
  .addSubcommand(subcommand =>
    subcommand
      .setName("add")
      .setDescription("🔒 [DEVELOPER ONLY] Add Core credits to a user")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to add Core credits to")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of Core credits to add")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for adding Core credits")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("remove")
      .setDescription("🔒 [DEVELOPER ONLY] Remove Core credits from a user")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to remove Core credits from")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of Core credits to remove")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for removing Core credits")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("set")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Set a user's Core credits to a specific amount",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to set Core credits for")
          .setRequired(true),
      )
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Amount of Core credits to set")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(10000),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for setting Core credits")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("tier")
      .setDescription("🔒 [DEVELOPER ONLY] Set a user's Core membership tier")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to set Core tier for")
          .setRequired(true),
      )
      .addStringOption(option => {
        const tierChoices = getTierChoices();
        const stringOption = option
          .setName("tier")
          .setDescription("Core membership tier")
          .setRequired(true);

        // Add choices dynamically
        tierChoices.forEach(choice => {
          stringOption.addChoices(choice);
        });

        return stringOption;
      })
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for setting Core tier")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("remove-tier")
      .setDescription(
        "🔒 [DEVELOPER ONLY] Remove a user's Core tier (subscription cancelled)",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to remove Core tier from")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for removing Core tier")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("view")
      .setDescription(
        "🔒 [DEVELOPER ONLY] View a user's Core credit information",
      )
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to view Core credits for")
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
