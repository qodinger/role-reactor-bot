import express from "express";
import {
  apiGetGuildSettings,
  apiUpdateGuildSettings,
  apiGetGuildChannels,
  apiGetGuildRoles,
  apiGetGuildEmojis,
  apiCheckGuilds,
  apiListGuilds,
} from "../../controllers/GuildController.js";
import {
  apiActivatePremiumFeature,
  apiCancelPremiumFeature,
  apiGetPremiumStatus,
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
router.get("/", internalAuth, requireAuth, apiListGuilds);

// Settings - requires guild permission
router.get(
  "/:guildId/settings",
  internalAuth,
  requireAuth,
  requireGuildMembership,
  apiGetGuildSettings,
);
router.patch(
  "/:guildId/settings",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  guildSettingsLimiter,
  apiUpdateGuildSettings,
);

// Channels - requires guild membership
router.get(
  "/:guildId/channels",
  internalAuth,
  requireAuth,
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

// Premium - requires guild permission for activation/cancellation
router.post(
  "/:guildId/premium/activate",
  requireAuth,
  requireGuildPermission,
  premiumActivationLimiter,
  apiActivatePremiumFeature,
);
router.post(
  "/:guildId/premium/cancel",
  requireAuth,
  requireGuildPermission,
  premiumActivationLimiter,
  apiCancelPremiumFeature,
);
router.get(
  "/:guildId/premium/status",
  internalAuth,
  requireAuth,
  requireGuildMembership,
  apiGetPremiumStatus,
);

// Leaderboard - public access
router.get("/public-leaderboards", apiGetPublicLeaderboards);
router.get("/:guildId/leaderboard", apiGuildLeaderboard);

// Analytics - requires guild permission
router.get(
  "/:guildId/analytics",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  apiGetGuildAnalytics,
);

// Role Reactions - CRITICAL: All role reaction endpoints require guild permission
router.get(
  "/:guildId/role-reactions",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  apiGetGuildRoleMappings,
);
router.delete(
  "/:guildId/role-reactions/:messageId",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  roleManagementLimiter,
  apiDeleteGuildRoleMapping,
);
router.post(
  "/:guildId/roles/deploy",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  roleManagementLimiter,
  apiDeployRoleReactions,
);
router.patch(
  "/:guildId/role-reactions/:messageId",
  internalAuth,
  requireAuth,
  requireGuildPermission,
  roleManagementLimiter,
  apiUpdateRoleReactions,
);

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

export default router;
