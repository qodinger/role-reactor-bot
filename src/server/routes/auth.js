import express from "express";
import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

const logger = getLogger();
const router = express.Router();

// Node.js 18+ has native fetch

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  `${process.env.BOT_URL || "http://localhost:3030"}/auth/discord/callback`;
const DISCORD_API_BASE = "https://discord.com/api/v10";

/**
 * Initiate Discord OAuth2 flow
 * GET /auth/discord
 */
router.get("/discord", (req, res) => {
  try {
    if (!DISCORD_CLIENT_ID) {
      return res
        .status(500)
        .json(
          createErrorResponse(
            "Discord OAuth not configured",
            500,
            "Please set DISCORD_CLIENT_ID in environment variables",
          ).response,
        );
    }

    // Generate state for CSRF protection
    const state = generateRandomString(32);
    req.session.oauthState = state;

    // Discord OAuth2 authorization URL
    const authUrl = new URL(`${DISCORD_API_BASE}/oauth2/authorize`);
    authUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "identify email");
    authUrl.searchParams.set("state", state);

    logger.info("Discord OAuth initiated", {
      clientId: DISCORD_CLIENT_ID,
      redirectUri: DISCORD_REDIRECT_URI,
    });

    res.redirect(authUrl.toString());
  } catch (error) {
    logger.error("Error initiating Discord OAuth:", error);
    res
      .status(500)
      .json(
        createErrorResponse("Failed to initiate Discord login", 500).response,
      );
  }
});

/**
 * Handle Discord OAuth2 callback
 * GET /auth/discord/callback
 */
router.get("/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    // Verify state (CSRF protection)
    if (!state || state !== req.session.oauthState) {
      logger.warn("Invalid OAuth state - possible CSRF attack");
      return res
        .status(400)
        .json(createErrorResponse("Invalid state parameter", 400).response);
    }

    // Verify authorization code
    if (!code) {
      return res
        .status(400)
        .json(
          createErrorResponse("No authorization code provided", 400).response,
        );
    }

    // Exchange code for access token
    const searchParams = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });

    const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: searchParams,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error(`Discord token exchange failed: ${errorText}`);
      return res
        .status(500)
        .json(
          createErrorResponse("Failed to exchange authorization code", 500)
            .response,
        );
    }

    const tokenData = await tokenResponse.json();
    const { access_token: accessToken } = tokenData;

    // Get user information from Discord
    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      logger.error("Failed to fetch Discord user info");
      return res
        .status(500)
        .json(
          createErrorResponse("Failed to fetch user information", 500).response,
        );
    }

    const userData = await userResponse.json();

    // Store user session
    req.session.discordUser = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      email: userData.email,
    };

    // Clear OAuth state
    delete req.session.oauthState;

    logger.info(`User logged in: ${userData.username} (${userData.id})`);

    // Redirect to website (or return success)
    // Validate redirect URL to prevent open redirect attacks
    const redirectUrl = validateRedirectUrl(req.query.redirect) || "/";
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error("Error in Discord OAuth callback:", error);
    res
      .status(500)
      .json(createErrorResponse("Authentication failed", 500).response);
  }
});

/**
 * Get current user information
 * GET /auth/me
 */
router.get("/me", (req, res) => {
  try {
    if (!req.session.discordUser) {
      return res
        .status(401)
        .json(createErrorResponse("Not authenticated", 401).response);
    }

    res.json(createSuccessResponse({ user: req.session.discordUser }));
  } catch (error) {
    logger.error("Error getting user info:", error);
    res
      .status(500)
      .json(
        createErrorResponse("Failed to get user information", 500).response,
      );
  }
});

/**
 * Logout user
 * POST /auth/logout
 */
router.post("/logout", (req, res) => {
  try {
    req.session.destroy(err => {
      if (err) {
        logger.error("Error destroying session:", err);
        return res
          .status(500)
          .json(createErrorResponse("Failed to logout", 500).response);
      }

      res.json(createSuccessResponse({ message: "Logged out successfully" }));
    });
  } catch (error) {
    logger.error("Error logging out:", error);
    res.status(500).json(createErrorResponse("Failed to logout", 500).response);
  }
});

/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allows relative URLs or URLs from the same origin
 * @param {string} url - URL to validate
 * @returns {string|null} Validated URL or null if invalid
 */
function validateRedirectUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  // Allow relative URLs (starting with /)
  if (url.startsWith("/")) {
    return url;
  }

  // Allow URLs from the same origin (BOT_URL)
  const botUrl = process.env.BOT_URL || "http://localhost:3030";
  try {
    const redirectUrl = new URL(url);
    const baseUrl = new URL(botUrl);

    // Only allow same origin redirects
    if (
      redirectUrl.protocol === baseUrl.protocol &&
      redirectUrl.hostname === baseUrl.hostname &&
      redirectUrl.port === baseUrl.port
    ) {
      return url;
    }
  } catch {
    // Invalid URL format
    return null;
  }

  // Reject external URLs for security
  return null;
}

/**
 * Generate random string for state parameter
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default router;
