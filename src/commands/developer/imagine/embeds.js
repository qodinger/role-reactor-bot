import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Get truncated preview of prompt for description
 * @param {string} prompt - The prompt to truncate
 * @returns {string} Truncated prompt with ellipsis (max 300 characters)
 */
function getPromptPreview(prompt) {
  if (!prompt) return "No prompt provided.";

  const maxLength = 300;
  if (prompt.length <= maxLength) return prompt;

  const truncated = prompt.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const cutPoint =
    lastSpace >= 0 && lastSpace <= maxLength - 20 ? lastSpace : maxLength;

  return `${prompt.slice(0, cutPoint)}...`;
}

/**
 * Set footer for embed
 * @param {EmbedBuilder} embed - The embed to set footer on
 * @param {Object} interaction - Discord interaction object
 */
function setEmbedFooter(embed, interaction) {
  if (interaction?.user) {
    embed
      .setFooter({
        text: `Generated for ${interaction.user.tag} • Role Reactor`,
      })
      .setTimestamp();
  } else {
    embed
      .setFooter({
        text: "Image Generator • Role Reactor",
      })
      .setTimestamp();
  }
}

export function createImagineProcessingEmbed({
  prompt,
  status = null,
  interaction = null,
}) {
  const preview = getPromptPreview(prompt);

  const baseDescription = `**Prompt Preview**\n${preview}`;
  const description = status
    ? baseDescription
    : `${baseDescription}\n\nPlease hang tight while the model renders your artwork.`;

  const embed = new EmbedBuilder()
    .setColor(THEME.INFO)
    .setTitle(`${EMOJIS.UI.LOADING} Generating your image`)
    .setDescription(description);

  if (status) {
    // Format status with emoji for better visual appeal
    let formattedStatus = status;

    // Only add emoji if status doesn't already have one
    if (
      !/^[\u{1F000}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u.test(
        status,
      )
    ) {
      // Add appropriate emojis based on status content
      if (status.includes("Loading") || status.includes("loading")) {
        formattedStatus = `🔄 ${status}`;
      } else if (
        status.includes("Processing") ||
        status.includes("processing")
      ) {
        formattedStatus = `⚙️ ${status}`;
      } else if (
        status.includes("Generating") ||
        status.includes("generating")
      ) {
        formattedStatus = `🎨 ${status}`;
      } else if (status.includes("Preparing") || status.includes("preparing")) {
        formattedStatus = `📋 ${status}`;
      } else if (status.includes("Decoding") || status.includes("decoding")) {
        formattedStatus = `🔍 ${status}`;
      } else if (
        status.includes("Finalizing") ||
        status.includes("finalizing")
      ) {
        formattedStatus = `✨ ${status}`;
      } else if (status.includes("queued") || status.includes("Queued")) {
        formattedStatus = `⏳ ${status}`;
      } else if (status.includes("%")) {
        formattedStatus = `📊 ${status}`;
      } else {
        // Add a generic processing emoji for other statuses
        formattedStatus = `⚙️ ${status}`;
      }
    }

    embed.addFields([
      {
        name: "Status",
        value: formattedStatus,
        inline: false,
      },
    ]);
  }

  setEmbedFooter(embed, interaction);

  return embed;
}

export function createImagineResultEmbed({
  prompt,
  interaction = null,
  seed = null,
  aspectRatio = null,
  model = null,
  nsfw = false,
  suggestions = null,
}) {
  const preview = getPromptPreview(prompt);
  let description = `**Prompt Preview**\n${preview}`;

  // Add suggestions if provided and not too many
  if (suggestions && suggestions.length > 0 && suggestions.length <= 2) {
    const suggestionText = suggestions.map(s => `• ${s.message}`).join("\n");
    description += `\n\n**💡 Tips for next time**\n${suggestionText}`;
  }

  const fields = [];

  // First row of parameters
  if (seed !== null) {
    fields.push({
      name: "Seed",
      value: `\`${seed}\``,
      inline: true,
    });
  }
  if (aspectRatio !== null) {
    fields.push({
      name: "Aspect Ratio",
      value: `\`${aspectRatio}\``,
      inline: true,
    });
  }
  if (model !== null) {
    fields.push({
      name: "Model",
      value: `\`${model}\``,
      inline: true,
    });
  }

  // Second row of parameters
  if (nsfw) {
    fields.push({
      name: "Content Type",
      value: "`NSFW`",
      inline: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.UI.IMAGE} Image ready`)
    .setDescription(description);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  setEmbedFooter(embed, interaction);

  return embed;
}

export function createRegenerateButton(aspectRatio) {
  const button = new ButtonBuilder()
    .setCustomId(`imagine_regenerate_${aspectRatio || "1:1"}`)
    .setLabel("🔄 Regenerate")
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(button);
}

export function createImagineErrorEmbed({ prompt, error, interaction = null }) {
  const preview = getPromptPreview(prompt);
  const errorMessage = error || "An unknown error occurred.";
  const description = `**Prompt Preview**\n${preview}\n\n**Details**\n${errorMessage}`;

  const embed = new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Unable to generate image`)
    .setDescription(description);

  setEmbedFooter(embed, interaction);

  return embed;
}

export function createImagineValidationEmbed(reason) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.STATUS.WARNING} Check your prompt`)
    .setDescription(reason)
    .setFooter({
      text: "Image Generator • Role Reactor",
    })
    .setTimestamp();
}

export function createNSFWValidationEmbed(reason) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} NSFW Content Restriction`)
    .setDescription(reason)
    .addFields([
      {
        name: "💡 How to generate NSFW content",
        value:
          "NSFW image generation is only allowed in channels marked as NSFW (18+). Ask a server admin to mark this channel as NSFW, or use an existing NSFW channel.",
        inline: false,
      },
    ])
    .setFooter({
      text: "Image Generator • Role Reactor",
    })
    .setTimestamp();
}

export function createPromptSuggestionsEmbed({
  prompt,
  suggestions,
  model,
  interaction = null,
}) {
  const preview = getPromptPreview(prompt);
  let description = `**Your Prompt**\n${preview}`;

  if (suggestions && suggestions.length > 0) {
    description += `\n\n**💡 Suggestions to improve your results:**`;
    suggestions.forEach((suggestion, index) => {
      description += `\n\n**${index + 1}. ${suggestion.message}**`;
      if (suggestion.example) {
        description += `\n*Example: ${suggestion.example}*`;
      }
    });
  }

  if (model) {
    description += `\n\n**🎨 ${model === "animagine" ? "Animagine XL 4.0" : "Anything XL"} Tips:**`;
    if (model === "animagine") {
      description += `\n• Excels at character design and facial expressions`;
      description += `\n• Use detailed character descriptions for best results`;
      description += `\n• Add emotion keywords like "happy expression"`;
    } else {
      description += `\n• Versatile model that works well with various styles`;
      description += `\n• Use quality keywords like "masterpiece"`;
      description += `\n• Specify lighting conditions for better results`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(THEME.INFO)
    .setTitle(`${EMOJIS.UI.LIGHTBULB} Prompt Enhancement Tips`)
    .setDescription(description);

  setEmbedFooter(embed, interaction);

  return embed;
}
