import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../../config/theme.js";

/**
 * Create the temporary role removed embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').User} targetUser
 * @param {import('discord.js').Role} targetRole
 * @param {string} reason
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRoleRemovedEmbed(
  interaction,
  targetUser,
  targetRole,
  reason,
) {
  return new EmbedBuilder()
    .setTitle("✅ Temporary Role Removed")
    .setDescription(
      `Successfully removed the **${targetRole.name}** role from **${targetUser.username}**.`,
    )
    .setColor(THEME_COLOR)
    .addFields(
      {
        name: "👤 User",
        value: `${targetUser.username} (${targetUser.id})`,
        inline: true,
      },
      {
        name: "🎭 Role",
        value: `${targetRole.name} (${targetRole.id})`,
        inline: true,
      },
      {
        name: "📝 Reason",
        value: reason,
        inline: true,
      },
      {
        name: "⏰ Removed At",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      },
    )
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTimestamp();
}
