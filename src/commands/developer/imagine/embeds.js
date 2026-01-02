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
    embed.addFields([
      {
        name: "Status",
        value: status,
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
}) {
  const preview = getPromptPreview(prompt);
  const description = `**Prompt Preview**\n${preview}`;
  const fields = [];

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
