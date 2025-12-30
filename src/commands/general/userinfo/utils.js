import { ActivityType } from "discord.js";

/**
 * Format user flags into readable badges
 * @param {import('discord.js').UserFlagsBitField} flags - User flags
 * @returns {string[]} Array of badge strings
 */
export function formatUserFlags(flags) {
  if (!flags || flags.bitfield === 0) return ["None"];

  // Map of valid Discord.js UserFlags to human-readable labels
  const flagMap = {
    Staff: "Discord Staff",
    Partner: "Partnered Server Owner",
    Hypesquad: "HypeSquad Events",
    BugHunterLevel1: "Bug Hunter",
    BugHunterLevel2: "Bug Hunter Gold",
    PremiumEarlySupporter: "Early Supporter",
    TeamPseudoUser: "Team User",
    VerifiedBot: "Verified Bot",
    VerifiedDeveloper: "Early Verified Bot Developer",
    CertifiedModerator: "Discord Certified Moderator",
    BotHTTPInteractions: "Bot",
    ActiveDeveloper: "Active Developer",
    Quarantined: "Quarantined",
    // We'll check them safely
  };

  const badges = [];
  for (const [flag, label] of Object.entries(flagMap)) {
    try {
      if (flags.has(flag)) {
        badges.push(label);
      }
    } catch (_error) {
      // Skip invalid flags silently
      // Some flags may not be available in all Discord.js versions
      continue;
    }
  }

  return badges.length > 0 ? badges : ["None"];
}

/**
 * Format permissions into readable list
 * @param {import('discord.js').PermissionsBitField} permissions - Permissions
 * @param {number} limit - Maximum number of permissions to show
 * @returns {string} Formatted permissions string
 */
export function formatPermissions(permissions, limit = 10) {
  if (!permissions || permissions.bitfield === 0) return "None";

  const permissionNames = [];
  const permissionMap = {
    Administrator: "Administrator",
    ManageGuild: "Manage Server",
    ManageRoles: "Manage Roles",
    ManageChannels: "Manage Channels",
    ManageMessages: "Manage Messages",
    ManageWebhooks: "Manage Webhooks",
    ManageEmojisAndStickers: "Manage Emojis & Stickers",
    ManageEvents: "Manage Events",
    ManageThreads: "Manage Threads",
    BanMembers: "Ban Members",
    KickMembers: "Kick Members",
    ModerateMembers: "Timeout Members",
    ViewAuditLog: "View Audit Log",
    ViewGuildInsights: "View Server Insights",
  };

  for (const [permission, label] of Object.entries(permissionMap)) {
    if (permissions.has(permission)) {
      permissionNames.push(label);
      if (permissionNames.length >= limit) break;
    }
  }

  if (permissionNames.length === 0) return "None";
  if (permissionNames.length >= limit) {
    return `${permissionNames.join(", ")}, +${permissions.toArray().length - limit} more`;
  }
  return permissionNames.join(", ");
}

/**
 * Calculate account age in a readable format
 * @param {Date} createdAt - Account creation date
 * @returns {string} Formatted account age
 */
export function calculateAccountAge(createdAt) {
  if (!createdAt) return "Unknown";

  const now = new Date();
  const diff = now - createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} year${years !== 1 ? "s" : ""} (${days} days)`;
  } else if (months > 0) {
    return `${months} month${months !== 1 ? "s" : ""} (${days} days)`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
}

/**
 * Format roles list with truncation
 * @param {import('discord.js').Collection} roles - Roles collection
 * @param {number} maxLength - Maximum length for the string
 * @returns {string} Formatted roles string
 */
export function formatRoles(roles, maxLength = 1024) {
  if (!roles || roles.size === 0) return "None";

  // Filter out @everyone role
  const rolesList = roles
    .filter(role => role.id !== role.guild.id)
    .sort((a, b) => b.position - a.position)
    .map(role => role.toString());

  if (rolesList.length === 0) return "None";

  let result = rolesList.join(", ");

  // Truncate if too long
  if (result.length > maxLength) {
    const truncated = result.substring(0, maxLength - 3);
    const lastComma = truncated.lastIndexOf(",");
    const remainingCount = rolesList.length - truncated.split(",").length;
    result = `${truncated.substring(0, lastComma)}, +${remainingCount} more`;
  }

  return result;
}

/**
 * Format user status/presence
 * @param {import('discord.js').Presence|null} presence - User presence
 * @returns {Object} Formatted status with label and emoji
 */
export function formatUserStatus(presence) {
  if (!presence) {
    return {
      label: "Offline",
      emoji: "⚫",
      status: "offline",
    };
  }

  const status = presence.status || "offline";
  const statusMap = {
    online: { label: "Online", emoji: "🟢" },
    idle: { label: "Idle", emoji: "🟡" },
    dnd: { label: "Do Not Disturb", emoji: "🔴" },
    offline: { label: "Offline", emoji: "⚫" },
    invisible: { label: "Invisible", emoji: "⚫" },
  };

  return {
    ...statusMap[status],
    status,
  };
}

/**
 * Format user activity
 * @param {import('discord.js').Presence|null} presence - User presence
 * @returns {string|null} Formatted activity string or null
 */
export function formatUserActivity(presence) {
  if (!presence || !presence.activities || presence.activities.length === 0) {
    return null;
  }

  // Filter out CUSTOM_STATUS (ActivityType.Custom) but keep all other activities
  // Prioritize streaming activities (ActivityType.Streaming) as they're more visible
  const activities = presence.activities.filter(
    activity => activity.type !== ActivityType.Custom, // Filter out CUSTOM_STATUS
  );

  if (activities.length === 0) {
    // Check for custom status
    const customStatus = presence.activities.find(
      activity => activity.type === ActivityType.Custom,
    );
    if (customStatus && customStatus.state) {
      return `**Custom Status:** ${customStatus.state}`;
    }
    return null;
  }

  // Prioritize streaming activities (ActivityType.Streaming) if present
  const streamingActivity = activities.find(
    activity => activity.type === ActivityType.Streaming,
  );
  const activity = streamingActivity || activities[0]; // Get streaming or primary activity

  // Map ActivityType enum to readable labels
  const activityTypes = {
    [ActivityType.Playing]: "Playing",
    [ActivityType.Streaming]: "Streaming",
    [ActivityType.Listening]: "Listening",
    [ActivityType.Watching]: "Watching",
    [ActivityType.Competing]: "Competing",
  };

  const typeLabel = activityTypes[activity.type] || "Playing";
  let activityText = `**${typeLabel}:** `;

  if (activity.type === ActivityType.Streaming) {
    // Streaming - show name and URL if available
    // Discord streaming activities should always have a name and URL
    if (activity.url) {
      // Format as clickable link
      const streamName = activity.name || activity.details || "Stream";
      activityText += `[${streamName}](${activity.url})`;
    } else if (activity.name) {
      // Has name but no URL (unusual but handle it)
      activityText += activity.name;
    } else if (activity.details) {
      // Fallback to details if name is missing
      activityText += activity.details;
    } else {
      // Last resort
      activityText += "Stream";
    }

    // Add details/state if available for streaming (on new line for better formatting)
    if (activity.details && activity.url) {
      // If we already used details in the link, don't repeat
      // But if there's state, show it
      if (activity.state) {
        activityText += `\n${activity.state}`;
      }
    } else if (activity.details && !activity.url) {
      // Details not used yet, add them
      activityText += `\n${activity.details}`;
      if (activity.state) {
        activityText += ` - ${activity.state}`;
      }
    } else if (activity.state && activity.url) {
      // Only state available
      activityText += `\n${activity.state}`;
    }
  } else if (activity.details) {
    activityText += activity.details;
    if (activity.state) {
      activityText += ` - ${activity.state}`;
    }
  } else {
    activityText += activity.name || "Unknown";
  }

  return activityText;
}
