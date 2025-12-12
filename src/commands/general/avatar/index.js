import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleAvatarGeneration } from "./handlers.js";

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Generate a unique anime-style avatar using AI")
  .addStringOption(option =>
    option
      .setName("prompt")
      .setDescription(
        "Describe the avatar (e.g., 'cyberpunk hacker with neon hair', 'kawaii girl with pink cat ears')",
      )
      .setRequired(true)
      .setMaxLength(500),
  )
  .addStringOption(option =>
    option
      .setName("art_style")
      .setDescription("Choose the artistic style for the avatar")
      .setRequired(false)
      .addChoices(
        { name: "Manga - Traditional Japanese comics", value: "manga" },
        { name: "Modern - Contemporary anime style", value: "modern" },
        { name: "Retro - 80s/90s vintage anime", value: "retro" },
        { name: "Realistic - Semi-realistic anime", value: "realistic" },
        { name: "Chibi - Super cute and deformed", value: "chibi" },
        { name: "Lo-fi - Chill and nostalgic aesthetic", value: "lofi" },
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Defer immediately to prevent timeout
    await interaction.deferReply();

    // Handle the avatar generation
    await handleAvatarGeneration(interaction, client);
  } catch (error) {
    logger.error("Error in avatar command:", error);

    if (interaction.deferred) {
      await interaction.editReply(
        errorEmbed({
          title: "Avatar Generation Failed",
          description:
            "An unexpected error occurred while generating your avatar.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } else {
      await interaction.reply(
        errorEmbed({
          title: "Avatar Generation Failed",
          description:
            "An unexpected error occurred while generating your avatar.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    }
  }
}
