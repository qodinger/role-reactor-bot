import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createAvatarEmbed(
  user,
  globalAvatar,
  serverAvatar,
  hasServerAvatar,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.IMAGE} ${user.username}'s Avatar`)
    .setDescription(
      `**${user.tag}** • ${user.avatar ? "Custom Avatar" : "Default Avatar"}`,
    )
    .setImage(globalAvatar)
    .setThumbnail(user.displayAvatarURL({ size: 128, dynamic: true }))
    .addFields({
      name: `${EMOJIS.UI.INFO} Avatar Details`,
      value: [
        `**Format**: ${globalAvatar.includes(".gif") ? "🎬 Animated GIF" : "🖼️ Static Image"}`,
        `**Quality**: High Definition`,
        `**Type**: ${user.avatar ? "Custom Avatar" : "Default Discord Avatar"}`,
      ].join("\n"),
      inline: false,
    });

  if (hasServerAvatar) {
    embed.addFields({
      name: `${EMOJIS.UI.STAR} Server Avatar Available`,
      value: `🎭 This user has a **custom server avatar**! Use the buttons below to switch between global and server avatars.`,
      inline: false,
    });
  }

  embed
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Requested by ${user.username} • Use buttons to switch views`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();

  return embed;
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Sorry, I couldn't load the avatar right now.");
}
