import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import config from "../../../config/config.js";
import { BUTTON_STYLES } from "../../../config/theme.js";

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
        .setStyle(BUTTON_STYLES.LINK),
    );
  }

  // Add buttons to row if any exist
  if (buttons.length > 0) {
    row.addComponents(...buttons);
  }

  return row;
}
