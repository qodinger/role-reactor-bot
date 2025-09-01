import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../../config/theme.js";
import { formatDuration } from "../../../utils/discord/temporaryRoles.js";

/**
 * Create the temporary role assignment embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Role} targetRole
 * @param {Array} results
 * @param {string} durationStr
 * @param {Date} expiresAt
 * @param {string} reason
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createTempRoleEmbed(
  interaction,
  targetRole,
  results,
  durationStr,
  expiresAt,
  reason,
) {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Temporary Role Assignment")
    .setDescription(`Temporary role **${targetRole.name}** has been assigned`)
    .setColor(targetRole.color || THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add role information
  embed.addFields([
    {
      name: "🎭 Role",
      value: targetRole.toString(),
      inline: true,
    },
    {
      name: "⏰ Duration",
      value: formatDuration(durationStr),
      inline: true,
    },
    {
      name: "🕐 Expires At",
      value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>\n(<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)`,
      inline: true,
    },
    {
      name: "📝 Reason",
      value: reason,
      inline: false,
    },
    {
      name: "👮 Assigned By",
      value: `${interaction.user} (${interaction.user.tag})`,
      inline: false,
    },
  ]);

  // Add results if available
  if (results && results.length > 0) {
    const successCount = results.filter(r => r.status.includes("✅")).length;
    const warningCount = results.filter(r => r.status.includes("⚠️")).length;
    const errorCount = results.filter(r => r.status.includes("❌")).length;

    embed.addFields({
      name: "📊 Results Summary",
      value: `✅ **${successCount}** successful\n⚠️ **${warningCount}** warnings\n❌ **${errorCount}** failed`,
      inline: false,
    });

    // Add detailed results if there are any issues
    if (warningCount > 0 || errorCount > 0) {
      const issueResults = results.filter(
        r => r.status.includes("⚠️") || r.status.includes("❌"),
      );
      const issueText = issueResults
        .map(r => `<@${r.userId}>: ${r.status}`)
        .join("\n");

      embed.addFields({
        name: "⚠️ Issues Found",
        value: issueText,
        inline: false,
      });
    }
  }

  return embed;
}
