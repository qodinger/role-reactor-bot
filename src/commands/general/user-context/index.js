import { ApplicationCommandType, EmbedBuilder } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { THEME } from "../../../config/theme.js";

export const metadata = {
  name: "User Info",
  category: "general",
  description: "View user information",
  keywords: ["user", "info", "member", "profile"],
  emoji: "👤",
};

export const data = {
  type: ApplicationCommandType.User,
  name: metadata.name,
};

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const targetUser = interaction.targetUser;
    const targetMember = interaction.targetMember;

    const createdAt = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedAt = targetMember
      ? Math.floor(targetMember.joinedTimestamp / 1000)
      : null;

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor(THEME.INFO)
      .addFields(
        {
          name: "User ID",
          value: `\`${targetUser.id}\``,
          inline: true,
        },
        {
          name: "Account Created",
          value: `<t:${createdAt}>`,
          inline: true,
        },
        {
          name: "Bot?",
          value: targetUser.bot ? "🤖 Yes" : "❌ No",
          inline: true,
        },
      );

    if (targetMember) {
      embed.addFields(
        {
          name: "Joined Server",
          value: `<t:${joinedAt}>`,
          inline: true,
        },
        {
          name: "Roles",
          value:
            targetMember.roles.cache.size > 0
              ? targetMember.roles.cache
                  .slice(0, 5)
                  .map(r => r.name)
                  .join(", ") +
                (targetMember.roles.cache.size > 5
                  ? ` +${targetMember.roles.cache.size - 5} more`
                  : "")
              : "None",
          inline: false,
        },
      );

      if (targetMember.nickname) {
        embed.addFields({
          name: "Nickname",
          value: targetMember.nickname,
          inline: true,
        });
      }
    }

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error in user context command:", error);
    return interaction.reply({
      content: "An error occurred while getting user info.",
      ephemeral: true,
    });
  }
}
