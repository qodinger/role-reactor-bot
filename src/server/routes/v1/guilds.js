import express from "express";
import {
  apiGetGuildSettings,
  apiUpdateGuildSettings,
  apiGetGuildChannels,
  apiGetGuildRoles,
  apiGetGuildEmojis,
  apiCheckGuilds,
  apiListGuilds,
  apiTestWelcome,
} from "../../controllers/GuildController.js";
import {
  apiActivatePremiumFeature,
  apiCancelPremiumFeature,
  apiGetPremiumStatus,
  apiActivateTrial,
  apiResetPremium,
} from "../../controllers/GuildPremiumController.js";
import {
  apiGuildLeaderboard,
  apiGetPublicLeaderboards,
} from "../../controllers/GuildLeaderboardController.js";
import {
  apiGetGuildRoleMappings,
  apiDeleteGuildRoleMapping,
  apiDeployRoleReactions,
  apiUpdateRoleReactions,
} from "../../controllers/GuildRoleMappingController.js";
import { apiGetGuildAnalytics } from "../../controllers/GuildAnalyticsController.js";
import {
  apiGetCustomCommands,
  apiCreateCustomCommand,
  apiUpdateCustomCommand,
  apiDeleteCustomCommand,
  apiSyncCustomCommands,
  apiDuplicateCustomCommand,
} from "../../controllers/GuildCustomCommandController.js";
import { internalAuth } from "../../middleware/internalAuth.js";
import { requireAuth } from "../../middleware/authentication.js";
import { requireAdmin } from "../../middleware/userAuthorization.js";
import {
  requireGuildPermission,
  requireGuildMembership,
} from "../../middleware/guildAuthorization.js";
import {
  roleManagementLimiter,
  guildSettingsLimiter,
  customCommandLimiter,
  premiumActivationLimiter,
} from "../../middleware/roleManagementLimiter.js";

const router = express.Router();

// Bulk check (internal only)
router.post("/check", internalAuth, apiCheckGuilds);

// List all guilds (internal only - for admin dashboard)
router.get("/", internalAuth, requireAuth, requireAdmin, apiListGuilds);

// Guild history (internal only - for admin dashboard)
router.get(
  "/history",
  internalAuth,
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { getStorageManager } = await import(
        "../../../utils/storage/storageManager.js"
      );
      const storage = await getStorageManager();
      if (!storage?.dbManager?.guildHistory) {
        return res
          .status(503)
          .json({ success: false, error: "Guild history not available" });
      }
      const guilds = await storage.dbManager.guildHistory.getAll();
      res.json({ success: true, data: guilds });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
);

// Guild details for admin (bypasses membership check)
router.get(
  "/:guildId/details",
  internalAuth,
  requireAuth,
  requireAdmin,
  apiGetGuildSettings,
);

// Settings - requires guild permission (internal auth verifies website request)
router.get(
  "/:guildId/settings",
  internalAuth,
  requireGuildMembership,
  apiGetGuildSettings,
);
router.patch(
  "/:guildId/settings",
  internalAuth,
  requireGuildPermission,
  guildSettingsLimiter,
  apiUpdateGuildSettings,
);

// Channels - requires guild membership
router.get(
  "/:guildId/channels",
  internalAuth,
  requireGuildMembership,
  apiGetGuildChannels,
);

// Roles - requires guild membership
router.get(
  "/:guildId/roles",
  internalAuth,
  requireAuth,
  requireGuildMembership,
  apiGetGuildRoles,
);

// Emojis - requires guild membership
router.get(
  "/:guildId/emojis",
  internalAuth,
  requireAuth,
  requireGuildMembership,
  apiGetGuildEmojis,
);

// Premium - requires guild permission
router.post(
  "/:guildId/premium/activate",
  internalAuth,
  requireGuildPermission,
  premiumActivationLimiter,
  apiActivatePremiumFeature,
);
router.post(
  "/:guildId/premium/activate-trial",
  internalAuth,
  requireGuildPermission,
  premiumActivationLimiter,
  apiActivateTrial,
);
router.post(
  "/:guildId/premium/cancel",
  internalAuth,
  requireGuildPermission,
  premiumActivationLimiter,
  apiCancelPremiumFeature,
);
router.get(
  "/:guildId/premium/status",
  internalAuth,
  requireGuildMembership,
  apiGetPremiumStatus,
);
router.post(
  "/:guildId/premium/reset",
  internalAuth,
  requireGuildPermission,
  apiResetPremium,
);

// Analytics - requires guild permission
router.get(
  "/:guildId/analytics",
  internalAuth,
  requireGuildPermission,
  apiGetGuildAnalytics,
);

// Role Reactions - CRITICAL: All role reaction endpoints require guild permission
router.get(
  "/:guildId/role-reactions",
  internalAuth,
  requireGuildPermission,
  apiGetGuildRoleMappings,
);
router.delete(
  "/:guildId/role-reactions/:messageId",
  internalAuth,
  requireGuildPermission,
  roleManagementLimiter,
  apiDeleteGuildRoleMapping,
);
router.post(
  "/:guildId/roles/deploy",
  internalAuth,
  requireGuildPermission,
  roleManagementLimiter,
  apiDeployRoleReactions,
);
router.patch(
  "/:guildId/role-reactions/:messageId",
  internalAuth,
  requireGuildPermission,
  roleManagementLimiter,
  apiUpdateRoleReactions,
);

// Leaderboard - public access
router.get("/public-leaderboards", apiGetPublicLeaderboards);
router.get("/:guildId/leaderboard", apiGuildLeaderboard);

// Custom Commands - requires guild permission for modifications
router.get(
  "/:guildId/custom-commands",
  internalAuth,
  requireAuth,
  requireGuildMembership,
  apiGetCustomCommands,
);
router.post(
  "/:guildId/custom-commands",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  customCommandLimiter,
  apiCreateCustomCommand,
);
router.post(
  "/:guildId/custom-commands/sync",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  customCommandLimiter,
  apiSyncCustomCommands,
);
router.post(
  "/:guildId/custom-commands/:commandId/duplicate",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  customCommandLimiter,
  apiDuplicateCustomCommand,
);
router.patch(
  "/:guildId/custom-commands/:commandId",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  customCommandLimiter,
  apiUpdateCustomCommand,
);
router.delete(
  "/:guildId/custom-commands/:commandId",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  customCommandLimiter,
  apiDeleteCustomCommand,
);

// Welcome System - Test endpoint
router.post(
  "/:guildId/welcome/test",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  apiTestWelcome,
);

export default router;
