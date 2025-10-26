import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import config from "../../../config/config.js";

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
        .setStyle(ButtonStyle.Link),
    );
  }

  // GitHub Repository button for bug reports
  if (links.github) {
    buttons.push(
      new ButtonBuilder()
        .setLabel("GitHub Repository")
        .setURL(links.github)
        .setStyle(ButtonStyle.Link),
    );
  }

  // Add buttons to row if any exist
  if (buttons.length > 0) {
    row.addComponents(...buttons);
  }

  return row;
}
