import { Events, InteractionType } from "discord.js";
import { getLogger } from "../utils/logger.js";
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
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    // Check if already replied to prevent double responses
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Unknown command.",
        flags: 64,
      });
    }
    return;
  }

  try {
    await command.execute(interaction, client);
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
