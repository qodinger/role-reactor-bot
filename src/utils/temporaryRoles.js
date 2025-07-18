import { getStorageManager } from "./storageManager.js";
import { getLogger } from "./logger.js";

// Temporary role functions
export async function addTemporaryRole(guildId, userId, roleId, expiresAt) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    return await storageManager.addTemporaryRole(
      guildId,
      userId,
      roleId,
      expiresAt,
    );
  } catch (error) {
    logger.error("❌ Failed to add temporary role", error);
    return false;
  }
}

export async function removeTemporaryRole(guildId, userId, roleId) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    return await storageManager.removeTemporaryRole(guildId, userId, roleId);
  } catch (error) {
    logger.error("❌ Failed to remove temporary role", error);
    return false;
  }
}

export async function getUserTemporaryRoles(guildId, userId) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();
    return tempRoles[guildId]?.[userId]
      ? Object.keys(tempRoles[guildId][userId])
      : [];
  } catch (error) {
    logger.error("❌ Failed to get user temporary roles", error);
    return [];
  }
}

export async function getTemporaryRoles(guildId) {
  const logger = getLogger();

  try {
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();
    return tempRoles[guildId] || {};
  } catch (error) {
    logger.error("❌ Failed to get temporary roles", error);
    return {};
  }
}

// Duration parsing and formatting
export function parseDuration(str) {
  if (!str || typeof str !== "string") return 0;
  const regex = /([0-9]+)([smhdw])/g;
  let match;
  let ms = 0;
  const unitToMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  while ((match = regex.exec(str)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    if (unitToMs[unit]) {
      ms += value * unitToMs[unit];
    }
  }
  return ms;
}

export function formatRemainingTime(isoString) {
  const now = Date.now();
  const end = new Date(isoString).getTime();
  let diff = end - now;
  if (diff <= 0) return "Expired";
  const units = [
    { label: "day", ms: 24 * 60 * 60 * 1000 },
    { label: "hour", ms: 60 * 60 * 1000 },
    { label: "minute", ms: 60 * 1000 },
    { label: "second", ms: 1000 },
  ];
  for (const { label, ms } of units) {
    const value = Math.floor(diff / ms);
    if (value > 0) {
      return value === 1 ? `1 ${label}` : `${value} ${label}s`;
    }
    diff %= ms;
  }
  return "<1 second";
}

export function validateDuration(durationStr) {
  if (!durationStr || typeof durationStr !== "string") {
    return { isValid: false, error: "Duration must be a string" };
  }

  const duration = parseDuration(durationStr);
  if (duration <= 0) {
    return { isValid: false, error: "Invalid duration format" };
  }

  if (duration > 30 * 24 * 60 * 60 * 1000) {
    // 30 days
    return { isValid: false, error: "Duration cannot exceed 30 days" };
  }

  return { isValid: true, duration };
}

export function formatDuration(durationStr) {
  const durationMs = parseDuration(durationStr);
  if (durationMs === 0) return "Invalid duration";

  const units = [
    { label: "day", ms: 24 * 60 * 60 * 1000 },
    { label: "hour", ms: 60 * 60 * 1000 },
    { label: "minute", ms: 60 * 1000 },
    { label: "second", ms: 1000 },
  ];

  const parts = [];
  let remaining = durationMs;
  for (const { label, ms } of units) {
    const value = Math.floor(remaining / ms);
    if (value > 0) {
      parts.push(value === 1 ? `1 ${label}` : `${value} ${label}s`);
      break;
    }
    remaining %= ms;
  }

  return parts.join(", ") || "0 seconds";
}

// Utility functions
export async function getTemporaryRolesByUser(guildId, userId) {
  return await getUserTemporaryRoles(guildId, userId);
}

export async function formatTemporaryRole(tempRole, userInfo, roleInfo) {
  return {
    user: userInfo,
    role: roleInfo,
    expiresAt: tempRole.expiresAt,
    remainingTime: formatRemainingTime(tempRole.expiresAt),
  };
}

export async function calculateTimeRemaining(expiresAt) {
  return formatRemainingTime(expiresAt);
}

export async function getUserInfo(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    return {
      id: member.user.id,
      tag: member.user.tag,
      displayName: member.displayName,
      avatarURL: member.user.displayAvatarURL(),
    };
  } catch (_error) {
    return {
      id: userId,
      tag: "Unknown User",
      displayName: "Unknown User",
      avatarURL: null,
    };
  }
}

export async function getRoleInfo(guild, roleId) {
  try {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return {
        id: roleId,
        name: "Unknown Role",
        color: "#000000",
        position: 0,
      };
    }
    return {
      id: role.id,
      name: role.name,
      color: `#${role.color.toString(16).padStart(6, "0")}`,
      position: role.position,
    };
  } catch (_error) {
    return {
      id: roleId,
      name: "Unknown Role",
      color: "#000000",
      position: 0,
    };
  }
}
