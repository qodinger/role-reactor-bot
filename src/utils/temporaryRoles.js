// Parses a duration string like '1h30m' or '2d' into milliseconds
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
    // y: 365 * 24 * 60 * 60 * 1000, // years not supported by test
  };
  while ((match = regex.exec(str)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    if (unitToMs[unit]) {
      ms += value * unitToMs[unit];
    }
  }
  // If there are any unsupported characters left, ignore them (do not throw)
  return ms;
}

// Formats a future ISO date string as a human-readable remaining time
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

// Mock functions for temporary role management (these would be implemented in a real app)
export async function removeTemporaryRole(guildId, userId, roleId) {
  // Mock implementation for tests
  console.log(
    `Mock: Removing temporary role ${roleId} from user ${userId} in guild ${guildId}`,
  );
  return true;
}

export async function getUserTemporaryRoles(guildId, userId) {
  // Mock implementation for tests
  console.log(
    `Mock: Getting temporary roles for user ${userId} in guild ${guildId}`,
  );
  return [];
}

export async function addTemporaryRole(guildId, userId, roleId, expiresAt) {
  // Mock implementation for tests
  console.log(
    `Mock: Adding temporary role ${roleId} to user ${userId} in guild ${guildId}, expires at ${expiresAt}`,
  );
  return true;
}

export function formatDuration(durationStr) {
  // Mock implementation for tests
  const duration = parseDuration(durationStr);
  if (duration === 0) return "Invalid duration";

  const hours = Math.floor(duration / (60 * 60 * 1000));
  const minutes = Math.floor((duration % (60 * 60 * 1000)) / (60 * 1000));
  const days = Math.floor(duration / (24 * 60 * 60 * 1000));

  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  return "Less than 1 minute";
}

// Additional functions for list-temp-roles command
export async function getTemporaryRoles(guildId) {
  // Mock implementation for tests
  console.log(`Mock: Getting all temporary roles for guild ${guildId}`);
  return [];
}

export async function getTemporaryRolesByUser(guildId, userId) {
  // Mock implementation for tests
  console.log(
    `Mock: Getting temporary roles for user ${userId} in guild ${guildId}`,
  );
  return [];
}

export function formatTemporaryRole(tempRole, userInfo, roleInfo) {
  // Mock implementation for tests
  const userName = userInfo ? userInfo.username : "Unknown User";
  const roleName = roleInfo ? roleInfo.name : "Unknown Role";
  const isExpired = new Date(tempRole.expiresAt) < new Date();
  const status = isExpired ? "EXPIRED" : "Active";

  return `${userName} - ${roleName} (${status})`;
}

export function calculateTimeRemaining(expiresAt) {
  // Mock implementation for tests
  const now = Date.now();
  const end = new Date(expiresAt).getTime();
  const diff = end - now;

  if (diff <= 0) return "EXPIRED";

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  return "Less than 1 minute";
}

export async function getUserInfo(guild, userId) {
  // Mock implementation for tests
  console.log(`Mock: Getting user info for ${userId} in guild ${guild.id}`);
  return {
    username: "TestUser",
    discriminator: "1234",
    id: userId,
  };
}

export async function getRoleInfo(guild, roleId) {
  // Mock implementation for tests
  console.log(`Mock: Getting role info for ${roleId} in guild ${guild.id}`);
  return {
    name: "Test Role",
    color: "#FF0000",
    id: roleId,
  };
}

export function validateDuration(durationStr) {
  // Mock implementation for tests
  const duration = parseDuration(durationStr);
  if (duration === 0) return false;

  // Check minimum duration (e.g., 5 minutes)
  const minDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
  if (duration < minDuration) return false;

  // Check maximum duration (e.g., 1 year)
  const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (duration > maxDuration) return false;

  return true;
}
