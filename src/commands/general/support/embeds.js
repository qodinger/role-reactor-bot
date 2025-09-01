import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createSupportEmbed(user) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.INFO} Support`)
    .setDescription("This command has been refactored to modular structure.")
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Requested by ${user.username}`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Sorry, an error occurred.");
}
