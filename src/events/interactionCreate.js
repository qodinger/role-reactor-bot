import { Events, InteractionType } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getCommandHandler } from "../utils/core/commandHandler.js";
import {
  handleExportData,
  handleCleanupTempRoles,
  handleTestAutoCleanup,
} from "../commands/developer/storage.js";

export const name = Events.InteractionCreate;

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Diagnostic: log interaction age
    const now = Date.now();
    const created =
      interaction.createdTimestamp || interaction.createdAt?.getTime() || now;
    const age = now - created;
    logger.debug(
      `[InteractionCreate] Received interaction: ${interaction.commandName || interaction.type} | Age: ${age}ms`,
    );

    // Validate inputs
    if (!interaction || !client) {
      throw new Error("Missing required parameters");
    }

    // Handle different interaction types
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        await handleCommandInteraction(interaction, client);
        break;
      case InteractionType.ApplicationCommandAutocomplete:
        await handleAutocompleteInteraction(interaction, client);
        break;
      case InteractionType.MessageComponent:
        await handleButtonInteraction(interaction, client);
        break;
      default:
        // Unknown interaction type, ignore
        break;
    }
  } catch (error) {
    logger.error("Error handling interaction", error);

    // Try to reply with error message only if not already handled
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          flags: 64, // ephemeral flag
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ An error occurred while processing your request.",
          flags: 64,
        });
      }
    } catch (replyError) {
      logger.error("Error sending error reply", replyError);
    }
  }
}

// Handle command interactions
const handleCommandInteraction = async (interaction, client) => {
  const logger = getLogger();
  const commandHandler = getCommandHandler();

  try {
    await commandHandler.executeCommand(interaction, client);
    logger.info(
      `Command executed: ${interaction.commandName} by ${interaction.user.tag}`,
    );
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}`, error);

    // Only try to reply if we haven't already and the command didn't handle it
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error executing command.",
          flags: 64,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ Error executing command.",
          flags: 64,
        });
      }
    } catch (replyError) {
      logger.error("Failed to send error response", replyError);
    }
  }
};

// Handle autocomplete interactions
const handleAutocompleteInteraction = async (interaction, client) => {
  const logger = getLogger();
  const command = client.commands.get(interaction.commandName);

  if (command && command.autocomplete) {
    try {
      await command.autocomplete(interaction, client);
    } catch (error) {
      logger.error(
        `Error in autocomplete for ${interaction.commandName}`,
        error,
      );
      await interaction.respond([]);
    }
  } else {
    await interaction.respond([]);
  }
};

// Handle button interactions
const handleButtonInteraction = async (interaction, _client) => {
  const logger = getLogger();

  try {
    // Handle leaderboard time filter buttons
    if (interaction.customId.startsWith("leaderboard_")) {
      await handleLeaderboardButton(interaction);
      return;
    }

    switch (interaction.customId) {
      // Storage command buttons (developer only)
      case "export_data":
        await handleExportData(interaction);
        break;
      case "cleanup_temp_roles":
        await handleCleanupTempRoles(interaction);
        break;
      case "test_auto_cleanup":
        await handleTestAutoCleanup(interaction);
        break;

      default:
        logger.debug(`Unknown button interaction: ${interaction.customId}`);
        break;
    }
  } catch (error) {
    logger.error(
      `Error handling button interaction ${interaction.customId}`,
      error,
    );
    await interaction.reply({
      content: "❌ An error occurred while processing your request.",
      flags: 64,
    });
  }
};

// Handle leaderboard button interactions
const handleLeaderboardButton = async interaction => {
  const logger = getLogger();

  try {
    // Parse the button customId: leaderboard_timeframe_userId
    const parts = interaction.customId.split("_");
    if (parts.length !== 3) {
      logger.error(
        `Invalid leaderboard button format: ${interaction.customId}`,
      );
      return;
    }

    const timeframe = parts[1];
    const userId = parts[2];

    // Check if the button was clicked by the same user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You can only use your own leaderboard buttons.",
        flags: 64,
      });
      return;
    }

    // Import the leaderboard command and execute it with the new timeframe
    const { execute } = await import("../commands/general/leaderboard.js");

    // Temporarily set the timeframe option
    interaction.options = {
      getString: () => timeframe,
    };

    await execute(interaction, null);
  } catch (error) {
    logger.error("Error handling leaderboard button", error);
    await interaction.reply({
      content: "❌ An error occurred while updating the leaderboard.",
      flags: 64,
    });
  }
};
