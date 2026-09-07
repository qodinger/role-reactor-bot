import { randomBytes } from "crypto";
import { config } from "../../../config/config.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

// ============================================================================
// YOUTUBE OAuth
// ============================================================================

const YOUTUBE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/**
 * Generate YouTube OAuth authorization URL.
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Authorization URL
 */
export function generateYouTubeAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.youtube?.clientId || "",
    redirect_uri: config.youtube?.redirectUri || "",
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `${YOUTUBE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange YouTube authorization code for tokens.
 * @param {string} code - Authorization code
 * @returns {Promise<Object>} Tokens
 */
export async function exchangeYouTubeCode(code) {
  const response = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.youtube?.clientId || "",
      client_secret: config.youtube?.clientSecret || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: config.youtube?.redirectUri || "",
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    logger.error("YouTube token exchange failed", data);
    throw new Error(`YouTube token exchange failed: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh YouTube access token.
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New tokens
 */
export async function refreshYouTubeToken(refreshToken) {
  const response = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.youtube?.clientId || "",
      client_secret: config.youtube?.clientSecret || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    logger.error("YouTube token refresh failed", data);
    throw new Error(`YouTube token refresh failed: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  };
}

// ============================================================================
// KICK OAuth
// ============================================================================

const KICK_AUTH_URL = "https://kick.com/oauth/authorize";
const KICK_TOKEN_URL = "https://kick.com/api/oauth/token";
const KICK_SCOPES = ["chat.write", "channel:read", "moderate:channel"];

/**
 * Generate Kick OAuth authorization URL.
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Authorization URL
 */
export function generateKickAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.kick?.clientId || "",
    redirect_uri: config.kick?.redirectUri || "",
    response_type: "code",
    scope: KICK_SCOPES.join(" "),
    state,
  });

  return `${KICK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange Kick authorization code for tokens.
 * @param {string} code - Authorization code
 * @returns {Promise<Object>} Tokens
 */
export async function exchangeKickCode(code) {
  const response = await fetch(KICK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.kick?.clientId || "",
      client_secret: config.kick?.clientSecret || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: config.kick?.redirectUri || "",
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    logger.error("Kick token exchange failed", data);
    throw new Error(`Kick token exchange failed: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh Kick access token.
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New tokens
 */
export async function refreshKickToken(refreshToken) {
  const response = await fetch(KICK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.kick?.clientId || "",
      client_secret: config.kick?.clientSecret || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    logger.error("Kick token refresh failed", data);
    throw new Error(`Kick token refresh failed: ${data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
  };
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * Generate a random state string for CSRF protection.
 * @returns {string} Random state string
 */
export function generateState() {
  return randomBytes(32).toString("hex");
}
