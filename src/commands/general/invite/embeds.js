import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createInviteEmbed(botName, botAvatar, userName, inviteLink) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setAuthor(UI_COMPONENTS.createAuthor(`${botName} - Invite me!`, botAvatar))
    .setDescription(
      `Hey ${userName}!\n\n` +
        `**${botName}** helps your server members get roles instantly with simple reactions.`,
    )
    .addFields({
      name: "Invite Link",
      value: `[Add ${botName} to your server](${inviteLink})`,
      inline: false,
    })
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Thank you for choosing Role Reactor!",
        botAvatar,
      ),
    )
    .setTimestamp();
}
