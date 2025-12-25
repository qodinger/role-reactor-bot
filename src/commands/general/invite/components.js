import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import config from "../../../config/config.js";
import { BUTTON_STYLES } from "../../../config/theme.js";

export function createInviteButtons(inviteLink) {
  const supportLink = config.externalLinks.support;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Invite me!")
      .setStyle(BUTTON_STYLES.LINK)
      .setURL(inviteLink),
    new ButtonBuilder()
      .setLabel("Support Server")
      .setStyle(BUTTON_STYLES.LINK)
      .setURL(supportLink),
  );
}
