import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

function truncatePrompt(prompt) {
  if (!prompt) return "No prompt provided.";
  return prompt.length > 200 ? `${prompt.slice(0, 197)}...` : prompt;
}

export function createImagineProcessingEmbed({ prompt, status = null }) {
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
    embed.setFooter({
      text: `Image Generator • ${status}`,
    });
  } else {
    embed.setDescription(
      `${embed.data.description}\n\nPlease hang tight while the model renders your artwork.`,
    );
    embed.setFooter({
      text: "Image Generator • This may take 30-60 seconds",
    });
  }

  embed.setTimestamp();

  return embed;
}

export function createImagineResultEmbed({ prompt, interaction = null }) {
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.UI.IMAGE} Image ready`)
    .setDescription(`**Prompt**\n${truncatePrompt(prompt)}`);

  if (interaction) {
    embed.setFooter({
      text: `Generated for ${interaction.user.username} • Image Generator`,
    });
  }

  embed.setTimestamp();

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
