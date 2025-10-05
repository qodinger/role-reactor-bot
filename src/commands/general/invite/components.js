import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EMOJIS } from "../../../config/theme.js";
import config from "../../../config/config.js";

export function createInviteButtons(inviteLink) {
  const supportLink = config.externalLinks.support;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Invite me!")
      .setEmoji(EMOJIS.ACTIONS.INVITE)
      .setStyle(ButtonStyle.Link)
      .setURL(inviteLink),
    new ButtonBuilder()
      .setLabel("Support Server")
      .setEmoji(EMOJIS.ACTIONS.SUPPORT)
      .setStyle(ButtonStyle.Link)
      .setURL(supportLink),
  );
}
