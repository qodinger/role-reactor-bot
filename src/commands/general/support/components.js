import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { BUTTON_STYLES } from "../../../config/theme.js";

/**
 * Create interactive buttons for support command
 * @returns {Promise<import('discord.js').ActionRowBuilder>}
 */
export async function createSupportButtons() {
  // Load config with fallback
  let links = {
    support: process.env.SUPPORT_SERVER_URL || "https://discord.gg/example",
    github: process.env.GITHUB_REPO_URL || "https://github.com/example",
  };

  try {
    const configModule = await import("../../../config/config.js");
    const config =
      configModule?.config || configModule?.default || configModule || {};
    links = config.externalLinks || links;
  } catch {
    // Use environment variables or defaults
  }

  const row = new ActionRowBuilder();

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
