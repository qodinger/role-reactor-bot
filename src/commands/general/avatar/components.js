import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function createAvatarButtons(user) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setURL(user.displayAvatarURL({ size: 1024, extension: "png" }))
      .setLabel("📥 PNG")
      .setStyle(ButtonStyle.Link),
    new ButtonBuilder()
      .setURL(user.displayAvatarURL({ size: 1024, extension: "jpg" }))
      .setLabel("📥 JPG")
      .setStyle(ButtonStyle.Link),
    new ButtonBuilder()
      .setURL(user.displayAvatarURL({ size: 1024, extension: "webp" }))
      .setLabel("📥 WebP")
      .setStyle(ButtonStyle.Link),
  );
}
