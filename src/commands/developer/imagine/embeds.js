import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

function truncatePrompt(prompt) {
  if (!prompt) return "No prompt provided.";
  return prompt.length > 200 ? `${prompt.slice(0, 197)}...` : prompt;
}

/**
 * Format date as "Today at HH:MM" or "Yesterday at HH:MM" or date format
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatFooterTimestamp(date = new Date()) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateToFormat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.floor((today - dateToFormat) / (1000 * 60 * 60 * 24));

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;

  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  } else {
    const month = date.toLocaleString("en-US", { month: "short" });
    const day = date.getDate();
    return `${month} ${day} at ${timeStr}`;
  }
}

export function createImagineProcessingEmbed({
  prompt,
  status = null,
  interaction = null,
}) {
  const embed = new EmbedBuilder()
    .setColor(THEME.INFO)
    .setTitle(`${EMOJIS.UI.LOADING} Generating your image`)
    .setDescription(`**Prompt**\n${truncatePrompt(prompt)}`);

  if (status) {
    embed.addFields([
      {
        name: "Status",
        value: status,
        inline: false,
      },
    ]);
  } else {
    embed.setDescription(
      `${embed.data.description}\n\nPlease hang tight while the model renders your artwork.`,
    );
  }

  // Always use consistent footer format matching avatar command
  const timestamp = formatFooterTimestamp();
  const username = interaction?.user?.username || "User";
  embed.setFooter({
    text: `Generated for ${username} • Image Generator • ${timestamp}`,
  });

  return embed;
}

export function createImagineResultEmbed({ prompt, interaction = null }) {
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.UI.IMAGE} Image ready`)
    .setDescription(`**Prompt**\n${truncatePrompt(prompt)}`);

  // Always use consistent footer format matching avatar command
  const timestamp = formatFooterTimestamp();
  const username = interaction?.user?.username || "User";
  embed.setFooter({
    text: `Generated for ${username} • Image Generator • ${timestamp}`,
  });

  return embed;
}

export function createImagineErrorEmbed({ prompt, error }) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Unable to generate image`)
    .setDescription(
      `**Prompt**\n${truncatePrompt(prompt)}\n\n**Details**\n${error}`,
    )
    .setFooter({
      text: "Try refining your prompt or retry later.",
    });
}

export function createImagineValidationEmbed(reason) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.STATUS.WARNING} Check your prompt`)
    .setDescription(reason)
    .setFooter({
      text: "Describe what you want to see (e.g., a futuristic city, a fantasy creature)",
    });
}
