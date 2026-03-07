import { getTicketManager } from "../../../features/ticketing/TicketManager.js";

/**
 * Check whether the interaction author has the configured staff role
 * (or a permission that counts as staff).
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {Promise<boolean>}
 */
export async function checkStaffRole(interaction) {
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return await checkStaffRoleForMember(member, interaction.guild.id);
  } catch {
    return false;
  }
}

/**
 * Check whether a guild member has the configured staff role.
 * @param {import('discord.js').GuildMember} member
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function checkStaffRoleForMember(member, guildId) {
  const hasManagePerms =
    member.permissions.has("ManageMessages") ||
    member.permissions.has("ManageGuild");

  if (hasManagePerms) return true;

  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    const staffRoleId = settings?.ticketSettings?.staffRoleId;
    if (staffRoleId && member.roles.cache.has(staffRoleId)) {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Get the configured staff role ID for a guild.
 * @param {string} guildId
 * @returns {Promise<string|null>}
 */
export async function getStaffRoleId(guildId) {
  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    return settings?.ticketSettings?.staffRoleId || null;
  } catch {
    return null;
  }
}

/**
 * Format the duration between two dates into a human-readable string.
 * @param {Date} start
 * @param {Date} end
 * @returns {string}
 */
export function formatDuration(start, end) {
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
  return `${diffMins}m`;
}
