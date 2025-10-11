import { EMOJIS, THEME } from "../../../config/theme.js";

/**
 * Calculate latency status and provide status information
 * @param {number} apiLatency - Discord API latency in milliseconds
 * @returns {Object} Object containing status, emoji, color, and description
 */
export function calculateLatency(apiLatency) {
  let status, statusEmoji, statusColor, statusDescription;

  if (apiLatency < 100) {
    status = "Excellent";
    statusEmoji = EMOJIS.STATUS.SUCCESS;
    statusColor = THEME.SUCCESS;
    statusDescription = "Your connection is running smoothly! 🚀";
  } else if (apiLatency < 200) {
    status = "Good";
    statusEmoji = EMOJIS.STATUS.INFO;
    statusColor = THEME.INFO;
    statusDescription = "Connection is working well. ✅";
  } else if (apiLatency < 400) {
    status = "Fair";
    statusEmoji = EMOJIS.STATUS.WARNING;
    statusColor = THEME.WARNING;
    statusDescription = "Connection is a bit slow but still functional. ⚠️";
  } else {
    status = "Poor";
    statusEmoji = EMOJIS.STATUS.ERROR;
    statusColor = THEME.ERROR;
    statusDescription = "Connection is experiencing issues. 🔴";
  }

  return { status, statusEmoji, statusColor, statusDescription };
}

/**
 * Returns a visual indicator for latency values
 * @param {number} latency - Latency in milliseconds
 * @returns {string} Visual indicator emoji
 */
export function getLatencyIndicator(latency) {
  if (latency < 100) return EMOJIS.STATUS.ONLINE;
  if (latency < 200) return EMOJIS.STATUS.IDLE;
  if (latency < 400) return EMOJIS.STATUS.WARNING;
  return EMOJIS.STATUS.OFFLINE;
}

/**
 * Formats uptime in milliseconds to a human-readable string
 * @param {number} uptime - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
export function formatUptime(uptime) {
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((uptime % (1000 * 60)) / 1000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}
