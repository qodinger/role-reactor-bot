import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

function truncatePrompt(prompt) {
  if (!prompt) return "No prompt provided.";
  return prompt.length > 200 ? `${prompt.slice(0, 197)}...` : prompt;
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

  // Always use consistent footer format matching ask command
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

  return embed;
}

export function createImagineResultEmbed({ prompt, interaction = null }) {
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.UI.IMAGE} Image ready`)
    .setDescription(`**Prompt**\n${truncatePrompt(prompt)}`);

  // Always use consistent footer format matching ask command
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

  return embed;
}

export function createImagineErrorEmbed({ prompt, error, interaction = null }) {
  const embed = new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Unable to generate image`)
    .setDescription(
      `**Prompt**\n${truncatePrompt(prompt)}\n\n**Details**\n${error}`,
    );

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
