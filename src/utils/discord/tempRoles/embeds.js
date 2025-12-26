import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
import { formatDurationMs } from "./utils.js";

/**
 * Send DM notification to user about role assignment
 * @param {import("discord.js").GuildMember} member - The guild member
 * @param {import("discord.js").Role} role - The role that was assigned
 * @param {Date} expiresAt - When the role expires
 * @param {import("discord.js").Guild} guild - The guild where the role was assigned
 */
export async function sendAssignmentNotification(
  member,
  role,
  expiresAt,
  guild,
) {
  const embed = new EmbedBuilder()
    .setColor(role.color || THEME.SUCCESS)
    .setTitle("Role Assignment Notification")
    .setDescription(
      `You have been assigned the **${role.name}** role in **${guild.name}**`,
    )
    .addFields([
      {
        name: "Duration",
        value: `${formatDurationMs(expiresAt.getTime() - Date.now())} • Expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
        inline: false,
      },
    ])
    .setFooter({
      text: `Role Reactor • ${guild.name}`,
    })
    .setTimestamp();

  try {
    await member.user.send({ embeds: [embed] });
  } catch (error) {
    // Log but don't throw - DM failures shouldn't break the assignment process
    const { getLogger } = await import("../../logger.js");
    const logger = getLogger();
    logger.warn(
      `Failed to send assignment notification to user ${member.id}:`,
      error.message,
    );
    // Don't throw - let caller handle gracefully
  }
}

/**
 * Send DM notification to user about role removal
 * @param {import("discord.js").GuildMember} member - The guild member
 * @param {import("discord.js").Role} role - The role that was removed
 * @param {import("discord.js").Guild} guild - The guild where the role was removed
 * @param {string} reason - Reason for removal
 * @param {import("discord.js").User} removedBy - User who removed the role
 */
export async function sendRemovalNotification(
  member,
  role,
  guild,
  reason,
  removedBy,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle("Role Removal Notification")
    .setDescription(
      `Your **${role.name}** role has been removed from **${guild.name}**`,
    )
    .addFields([
      {
        name: "Removed by",
        value: `${removedBy.username}`,
        inline: true,
      },
      {
        name: "Reason",
        value: reason || "No reason provided",
        inline: true,
      },
      {
        name: "Timestamp",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    ])
    .setFooter({
      text: `Role Reactor • ${guild.name}`,
    })
    .setTimestamp();

  try {
    await member.user.send({ embeds: [embed] });
  } catch (error) {
    // Log but don't throw - DM failures shouldn't break the removal process
    const { getLogger } = await import("../../logger.js");
    const logger = getLogger();
    logger.warn(
      `Failed to send removal notification to user ${member.id}:`,
      error,
    );
  }
}
