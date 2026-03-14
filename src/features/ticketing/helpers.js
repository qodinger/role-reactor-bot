import { getTicketManager } from "./TicketManager.js";

/**
 * Check whether the interaction author has the configured staff role
 * (or a permission that counts as staff).
 * Works with both ChatInputCommandInteraction and ButtonInteraction.
 * @param {import('discord.js').Interaction} interaction
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
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
  return `${diffMins}m`;
}

/**
 * Get configured staff roles for a guild.
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<Array>} List of staff roles
 */
export async function getStaffRoles(guild) {
  const roles = [];

  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guild.id);
    const staffRoleId = settings?.ticketSettings?.staffRoleId;
    if (staffRoleId && guild.roles.cache.has(staffRoleId)) {
      const customRole = guild.roles.cache.get(staffRoleId);
      roles.push(customRole);
    }
  } catch {}

  return roles;
}

/**
 * Get staff notification channel (for Quiet Claim alerts).
 * Priority: notificationChannelId > transcriptChannelId > #staff-pings
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
export async function getStaffNotificationChannel(guild) {
  const { ChannelType } = await import("discord.js");

  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guild.id);

    // 1. Try configured notification channel (Quiet Claim channel)
    const notifyChannelId = settings?.ticketSettings?.notificationChannelId;
    if (notifyChannelId) {
      const channel = await guild.channels.fetch(notifyChannelId).catch(() => null);
      if (channel && channel.type === ChannelType.GuildText) {
        return /** @type {import('discord.js').TextChannel} */ (channel);
      }
    }

    // 2. Fallback to transcript channel
    const logChannelId = settings?.ticketSettings?.transcriptChannelId;
    if (logChannelId) {
      const channel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (channel && channel.type === ChannelType.GuildText) {
        return /** @type {import('discord.js').TextChannel} */ (channel);
      }
    }

    // 3. Try to find staff-pings channel as fallback
    const fallbackChannel = guild.channels.cache.find(
      c => c.name === "staff-pings" && c.type === ChannelType.GuildText,
    );
    return /** @type {import('discord.js').TextChannel} */ (fallbackChannel) || null;
  } catch {
    return null;
  }
}
