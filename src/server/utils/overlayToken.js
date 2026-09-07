import crypto from "crypto";

const OVERLAY_SECRET = process.env.OVERLAY_SECRET || process.env.SESSION_SECRET;
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const WIDGET_TYPES = ["alerts", "chat", "activity", "stats"];

/**
 * Generate a signed overlay token for a guild + widget type.
 * The token is an HMAC-SHA256 signature that proves the URL was issued by the server.
 *
 * @param {string} guildId - Discord guild ID
 * @param {string} widgetType - Widget type (alerts, chat, activity, stats)
 * @param {number} [expiresInMs=TOKEN_EXPIRY_MS] - Token expiry in milliseconds
 * @returns {{ token: string, expiresAt: string }}
 */
export function generateOverlayToken(
  guildId,
  widgetType,
  expiresInMs = TOKEN_EXPIRY_MS,
) {
  if (!OVERLAY_SECRET) {
    throw new Error(
      "OVERLAY_SECRET or SESSION_SECRET env var required for overlay tokens",
    );
  }

  if (!WIDGET_TYPES.includes(widgetType)) {
    throw new Error(
      `Invalid widget type: ${widgetType}. Must be one of: ${WIDGET_TYPES.join(", ")}`,
    );
  }

  const expiresAt = Date.now() + expiresInMs;
  const payload = `${guildId}:${widgetType}:${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", OVERLAY_SECRET)
    .update(payload)
    .digest("base64url");

  const token = `${expiresAt}.${signature}`;

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/**
 * Verify an overlay token.
 *
 * @param {string} guildId - Discord guild ID
 * @param {string} widgetType - Widget type
 * @param {string} token - Token to verify
 * @returns {boolean}
 */
export function verifyOverlayToken(guildId, widgetType, token) {
  if (!OVERLAY_SECRET || !token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresAtStr, providedSig] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const payload = `${guildId}:${widgetType}:${expiresAt}`;
  const expectedSig = crypto
    .createHmac("sha256", OVERLAY_SECRET)
    .update(payload)
    .digest("base64url");

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSig),
      Buffer.from(expectedSig),
    );
  } catch {
    return false;
  }
}
