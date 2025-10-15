import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleGeneralHelp as handleGeneralHelpHandler,
  handleSpecificCommandHelp as handleSpecificCommandHelpHandler,
} from "./handlers.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription(`Get help and information about bot commands`)
  .addStringOption(option =>
    option
      .setName("command")
      .setDescription("Get detailed help for a specific command")
      .setRequired(false)
      .setAutocomplete(true),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction) {
  const logger = getLogger();

  try {
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    const deferred = await deferInteraction(interaction);
    await routeHelpCommand(interaction, deferred);
  } catch (error) {
    logger.error("Error in help command:", error);
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

async function routeHelpCommand(interaction, deferred) {
  const commandName = interaction.options.getString("command");

  if (commandName) {
    await handleSpecificCommandHelp(interaction, commandName, deferred);
  } else {
    await handleGeneralHelp(interaction, deferred);
  }
}

async function handleSpecificCommandHelp(interaction, commandName, deferred) {
  await handleSpecificCommandHelpHandler(interaction, commandName, deferred);
}

async function handleGeneralHelp(interaction, deferred) {
  await handleGeneralHelpHandler(interaction, deferred);
}

async function handleCommandError(interaction, _error) {
  try {
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description: "An unexpected error occurred. Please try again.",
          }),
        ],
      });
    } else {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description: "An unexpected error occurred. Please try again.",
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

// ============================================================================
// AUTOCOMPLETE HANDLER
// ============================================================================

export async function autocomplete(interaction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const commands = Array.from(interaction.client.commands.keys());

  // Filter out developer commands if user is not a developer
  const developerCommands = [
    "health",
    "performance",
    "storage",
    "avatar-debug",
    "core-management",
    "verify",
  ];

  const userIsDeveloper = isDeveloper(interaction.user.id);

  const filtered = commands
    .filter(choice => {
      // Filter by search term
      if (!choice.toLowerCase().includes(focusedValue)) {
        return false;
      }

      // Filter out developer commands if user is not a developer
      if (developerCommands.includes(choice) && !userIsDeveloper) {
        return false;
      }

      return true;
    })
    .slice(0, 25);

  await interaction.respond(
    filtered.map(choice => ({ name: `/${choice}`, value: choice })),
  );
}
