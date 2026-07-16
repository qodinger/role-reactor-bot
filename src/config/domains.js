/**
 * Centralized domain configuration
 * All domain references should use this file instead of hardcoding.
 * Update .env.production to change domains — no code changes needed.
 */

export const WEBSITE_URL =
  process.env.BOT_WEBSITE_URL || "https://rolereactor.xyz";

export const API_URL =
  process.env.BOT_API_URL ||
  process.env.PUBLIC_URL ||
  process.env.BOT_URL ||
  "https://api.rolereactor.xyz";

export const CORS_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS ||
  `${WEBSITE_URL},${WEBSITE_URL.replace("://", "://www.")}`;
