import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { BUTTON_STYLES } from "../../../config/theme.js";

export async function createInviteButtons(inviteLink) {
  // Load config with fallback
  let supportLink =
    process.env.SUPPORT_SERVER_URL || "https://discord.gg/example";
  try {
    const configModule = await import("../../../config/config.js");
    const config =
      configModule?.config || configModule?.default || configModule || {};
    supportLink = config.externalLinks?.support || supportLink;
  } catch {
    // Use environment variable or default
  }

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
