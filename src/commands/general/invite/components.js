import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import config from "../../../config/config.js";

export function createInviteButtons(inviteLink) {
  const supportLink = config.externalLinks.support;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Invite me!")
      .setStyle(ButtonStyle.Link)
      .setURL(inviteLink),
    new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle(ButtonStyle.Link)
      .setURL(supportLink),
  );
}
