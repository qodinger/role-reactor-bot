import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EMOJIS } from "../../../config/theme.js";
import config from "../../../config/config.js";

export function createInviteButtons(inviteLink) {
  const supportLink = config.externalLinks.support;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Invite me!")
      .setEmoji(EMOJIS.ACTIONS.LINK)
      .setStyle(ButtonStyle.Link)
      .setURL(inviteLink),
    new ButtonBuilder()
      .setLabel("Support Server")
      .setEmoji("🆘")
      .setStyle(ButtonStyle.Link)
      .setURL(supportLink),
  );
}
