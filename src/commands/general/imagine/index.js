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
  category: "general",
  description: "Generate professional AI artwork from text or images",
  keywords: [
    "imagine",
    "generate",
    "art",
    "image",
    "ai",
    "artwork",
    "create",
    "anime",
    "model",
  ],
  emoji: "✨",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "**Basic usage:**",
        "```/imagine prompt:a futuristic city at sunset```",
        "",
        "**With specific model:**",
        "Select from the **model** dropdown to change the AI engine (Animagine, Anything).",
        "",
        "**Aspect Ratios:**",
        "Use the **aspect_ratio** option to choose between Square, Widescreen, or Portrait.",
        "",
        "**Image-to-Image (Anime-ify):**",
        "Upload an image in the **image** option and provide a prompt to transform it into the selected style.",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Parameters`,
      value: [
        "• **prompt** - Describe what you want to see",
        "• **model** - Choose a specific AI model",
        "• **aspect_ratio** - Choose the image shape",
        "• **image** - (Optional) Transform an existing photo",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Pro Tips`,
      value: [
        "• Use specific descriptive keywords for better results",
        "• Use `--hq` in your prompt for maximum quality (slower)",
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
  .setDescription(metadata.description)
  .addStringOption(option =>
    option
      .setName("prompt")
      .setDescription("Describe what you want to see")
      .setRequired(true)
      .setMaxLength(2000),
  )
  .addStringOption(option =>
    option
      .setName("model")
      .setDescription("Choose the AI model (Default: Anime XL)")
      .addChoices(
        { name: "🎌 Anime (Animagine XL 4.0)", value: "animagine" },
        { name: "🎨 Manga/Artistic (Anything XL)", value: "anything" },
      ),
  )
  .addStringOption(option =>
    option
      .setName("aspect_ratio")
      .setDescription("Image orientation (Default: 1:1)")
      .addChoices(
        { name: "Square (1:1)", value: "1:1" },
        { name: "Widescreen (16:9)", value: "16:9" },
        { name: "Portrait (2:3)", value: "2:3" },
        { name: "Landscape (3:2)", value: "3:2" },
        { name: "Phone (9:16)", value: "9:16" },
      ),
  )
  .addAttachmentOption(option =>
    option
      .setName("image")
      .setDescription("Upload a photo to transform (Image-to-Image)"),
  )
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
