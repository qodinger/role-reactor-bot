/**
 * Format duration in milliseconds to human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDurationMs(ms) {
  // Validate input
  if (typeof ms !== "number" || isNaN(ms) || ms < 0) {
    return "Invalid duration";
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Parses a duration string (e.g., "1h30m") into milliseconds.
 * @param {string} durationStr
 * @returns {number|null}
 */
export function parseDuration(durationStr) {
  // Validate input
  if (typeof durationStr !== "string" || !durationStr.trim()) {
    return null;
  }

  const regex = /(\d+)\s*(w|d|h|m)/g;
  let totalMs = 0;
  let match;
  while ((match = regex.exec(durationStr)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case "w":
        totalMs += value * 7 * 24 * 60 * 60 * 1000;
        break;
      case "d":
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
      case "h":
        totalMs += value * 60 * 60 * 1000;
        break;
      case "m":
        totalMs += value * 60 * 1000;
        break;
    }
  }
  return totalMs > 0 ? totalMs : null;
}

/**
 * Formats a duration string into a human-readable format.
 * @param {string} durationStr
 * @returns {string}
 */
export function formatDuration(durationStr) {
  const ms = parseDuration(durationStr);
  if (!ms) return "Invalid duration";

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  return parts.join(", ");
}

/**
 * Formats the remaining time until a date.
 * @param {Date|string} expiresAt
 * @returns {string}
 */
export function formatRemainingTime(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);

  let remaining = "";
  if (days > 0) remaining += `${days}d `;
  if (hours > 0) remaining += `${hours}h `;
  if (minutes > 0) remaining += `${minutes}m`;
  return remaining.trim() || "Less than a minute";
}
