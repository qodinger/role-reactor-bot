import { getLogger } from "../../../utils/logger.js";
import {
  errorEmbed,
  successEmbed,
} from "../../../utils/discord/responseMessages.js";

const logger = getLogger();

export async function handleSet(interaction) {
  const channel = interaction.options.getChannel("channel");
  const status = interaction.options.getString("status");

  if (channel.type !== 2 && channel.type !== 13) {
    return interaction.reply(
      errorEmbed({
        title: "Invalid Channel",
        description: "Please select a voice channel.",
      }),
    );
  }

  if (status.length > 500) {
    return interaction.reply(
      errorEmbed({
        title: "Status Too Long",
        description: "Status must be 500 characters or less.",
      }),
    );
  }

  try {
    await channel.setVoiceStatus(status);

    return interaction.reply(
      successEmbed({
        title: "Voice Status Set",
        description: `Status set to: "${status}" for ${channel.name}`,
      }),
    );
  } catch (error) {
    logger.error("Error setting voice status:", error);
    return interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to set voice channel status.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

export async function handleClear(interaction) {
  const channel = interaction.options.getChannel("channel");

  if (channel.type !== 2 && channel.type !== 13) {
    return interaction.reply(
      errorEmbed({
        title: "Invalid Channel",
        description: "Please select a voice channel.",
      }),
    );
  }

  try {
    await channel.setVoiceStatus("");

    return interaction.reply(
      successEmbed({
        title: "Voice Status Cleared",
        description: `Status removed from ${channel.name}`,
      }),
    );
  } catch (error) {
    logger.error("Error clearing voice status:", error);
    return interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to clear voice channel status.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

export async function handleVoiceStatusCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "set":
      return handleSet(interaction);
    case "clear":
      return handleClear(interaction);
    default:
      return interaction.reply(
        errorEmbed({
          title: "Unknown Subcommand",
          description: `The subcommand "${subcommand}" is not recognized.`,
          solution: "Please use a valid subcommand.",
        }),
      );
  }
}
