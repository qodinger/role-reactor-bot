import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { EMOJIS } from "../../../config/theme.js";
import config from "../../../config/config.js";

/**
 * Create interactive buttons for sponsor command
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createSponsorButtons() {
  const row = new ActionRowBuilder();
  const links = config.externalLinks;

  const buttons = [];

  // Sponsor/Donation button
  if (links.sponsor) {
    buttons.push(
      new ButtonBuilder()
        .setLabel("Become a Sponsor")
        .setURL(links.sponsor)
        .setEmoji(EMOJIS.ACTIONS.HEART)
        .setStyle(ButtonStyle.Link),
    );
  }

  // Add buttons to row if any exist
  if (buttons.length > 0) {
    row.addComponents(...buttons);
  }

  return row;
}
