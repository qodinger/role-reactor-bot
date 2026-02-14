import express from "express";
import {
  apiGetGuildSettings,
  apiUpdateGuildSettings,
  apiGetGuildChannels,
  apiGetGuildRoles,
  apiGetGuildEmojis,
  apiCheckGuilds,
  apiListGuilds,
  apiActivatePremiumFeature,
  apiGuildLeaderboard,
} from "../../controllers/GuildController.js";
import { apiGetGuildAnalytics } from "../../controllers/GuildAnalyticsController.js";
import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

// Bulk check
router.post("/check", apiCheckGuilds);

// List all guilds
router.get("/", internalAuth, apiListGuilds);

// Settings
router.get("/:guildId/settings", internalAuth, apiGetGuildSettings);
router.patch("/:guildId/settings", internalAuth, apiUpdateGuildSettings);

// Channels
router.get("/:guildId/channels", internalAuth, apiGetGuildChannels);

// Roles
router.get("/:guildId/roles", internalAuth, apiGetGuildRoles);

// Emojis
router.get("/:guildId/emojis", internalAuth, apiGetGuildEmojis);

// Premium
router.post("/:guildId/premium/activate", apiActivatePremiumFeature);

// Leaderboard
router.get("/:guildId/leaderboard", apiGuildLeaderboard);

// Analytics
router.get("/:guildId/analytics", internalAuth, apiGetGuildAnalytics);

export default router;
