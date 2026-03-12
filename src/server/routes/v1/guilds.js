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
  apiCancelPremiumFeature,
  apiGetPremiumStatus,
  apiGuildLeaderboard,
  apiGetPublicLeaderboards,
  apiGetGuildRoleMappings,
  apiDeleteGuildRoleMapping,
  apiDeployRoleReactions,
  apiUpdateRoleReactions,
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
router.post("/:guildId/premium/cancel", apiCancelPremiumFeature);
router.get("/:guildId/premium/status", internalAuth, apiGetPremiumStatus);

// Leaderboard
router.get("/public-leaderboards", apiGetPublicLeaderboards);
router.get("/:guildId/leaderboard", apiGuildLeaderboard);

// Analytics
router.get("/:guildId/analytics", internalAuth, apiGetGuildAnalytics);

// Role Reactions
router.get("/:guildId/role-reactions", internalAuth, apiGetGuildRoleMappings);
router.delete(
  "/:guildId/role-reactions/:messageId",
  internalAuth,
  apiDeleteGuildRoleMapping,
);
router.post("/:guildId/roles/deploy", internalAuth, apiDeployRoleReactions);
router.patch(
  "/:guildId/role-reactions/:messageId",
  internalAuth,
  apiUpdateRoleReactions,
);

export default router;
