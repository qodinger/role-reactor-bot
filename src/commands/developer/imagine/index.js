import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleImagineCommand } from "./handlers.js";

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
  name: "imagine",
  category: "developer",
  description: "Generate AI artwork from any text prompt",
  keywords: ["imagine", "generate", "art", "image", "ai", "artwork", "create"],
  emoji: "🖼️",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "**Basic usage:**",
        "```/imagine prompt:a futuristic city at sunset with flying cars```",
        "",
        "**With quality control:**",
        "```/imagine prompt:anime girl --hq``` (high quality, slower - 30-35 steps)",
        "```/imagine prompt:anime girl --fast``` (fast mode, default - 15-20 steps)",
        "",
        "**With models and quality:**",
        "```/imagine prompt:portrait --model animagine --hq``` (best quality)",
        "```/imagine prompt:scene --model anything --fast``` (quick generation)",
        "",
        "**Supported aspect ratios:**",
        "`1:1` (square), `4:5` (portrait), `2:3` (tall), `3:2` (wide), `5:4` (landscape), `16:9` (widescreen), `9:16` (phone)",
        "```/imagine prompt:portrait --ar 2:3``` (portrait)",
        "```/imagine prompt:square image --ar 1:1``` (square, default)",
        "",
        "**More examples:**",
        "```/imagine prompt:a fantasy dragon breathing fire in a magical forest```",
        "```/imagine prompt:cyberpunk street scene with neon lights and rain```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "**prompt** *(required)* - A text description of what you want to generate (max 2000 characters)",
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
        "AI-generated artwork based on your text prompt. The image is created using advanced AI image generation technology and will appear as a high-quality image result!",
      inline: false,
    },
    {
      name: `Tips for Better Results`,
      value: [
        "• Be specific and descriptive in your prompts",
        "• Include style keywords (e.g., 'photorealistic', 'anime style', 'oil painting')",
        "• Mention colors, lighting, and mood for better results",
        "• Combine multiple concepts for creative compositions",
        "• Use `--ar 1:1` for square (default), `--ar 16:9` for landscapes, `--ar 2:3` for portraits",
        "• Use `--model animagine` or `--model anything` to choose the AI model",
        "• Use `--hq` for high quality (slower, 30-35 steps) or `--fast` for fast mode (default, 15-20 steps)",
        "• Use `--nsfw` for mature content (requires age-restricted channel)",
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
  .setDescription(`🔒 [DEVELOPER ONLY] ${metadata.description}`)
  .addStringOption(option =>
    option
      .setName("prompt")
      .setDescription(
        "Describe what you want to see (e.g., a futuristic city, a fantasy creature)",
      )
      .setRequired(true)
      .setMaxLength(2000),
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
    await handleImagineCommand(interaction, client, deferred);
  } catch (error) {
    logger.error("Error in imagine command:", error);
    await handleCommandError(interaction, error);
  }
}

// ============================================================================
// INTERACTION MANAGEMENT
// ============================================================================

async function deferInteraction(interaction) {
  try {
    await interaction.deferReply();
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
              "An unexpected error occurred while generating your image.",
          }),
        ],
      });
    } else {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description:
              "An unexpected error occurred while generating your image.",
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
