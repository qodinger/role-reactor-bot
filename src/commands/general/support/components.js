import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import config from "../../../config/config.js";
import { BUTTON_STYLES } from "../../../config/theme.js";

/**
 * Create interactive buttons for support command
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createSupportButtons() {
  const row = new ActionRowBuilder();
  const links = config.externalLinks;

  const buttons = [];

  // Discord Support Server button
  if (links.support) {
    buttons.push(
      new ButtonBuilder()
        .setLabel("Support Server")
        .setURL(links.support)
        .setStyle(BUTTON_STYLES.LINK),
    );
  }

  // GitHub Repository button for bug reports
  if (links.github) {
    buttons.push(
      new ButtonBuilder()
        .setLabel("GitHub Repository")
        .setURL(links.github)
        .setStyle(BUTTON_STYLES.LINK),
    );
  }

  // Add buttons to row if any exist
  if (buttons.length > 0) {
    row.addComponents(...buttons);
  }

  return row;
}
