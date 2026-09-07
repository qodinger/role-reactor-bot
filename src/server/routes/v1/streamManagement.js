import express from "express";
import {
  apiGetStreamStatus,
  apiGenerateConnectUrl,
  apiDisconnectPlatform,
  apiGetStreamConfig,
  apiUpdateStreamConfig,
  apiTestAlert,
  apiListCommands,
  apiAddCommand,
  apiEditCommand,
  apiDeleteCommand,
  apiGetFilters,
  apiUpdateFilter,
  apiListQuotes,
  apiAddQuote,
  apiDeleteQuote,
  apiListTimers,
  apiAddTimer,
  apiDeleteTimer,
  apiGetDiagnostics,
  apiGenerateOverlayToken,
  apiVerifyMod,
} from "../../controllers/StreamController.js";
import { internalAuth } from "../../middleware/internalAuth.js";
import {
  requireGuildPermission,
  requireGuildMembership,
} from "../../middleware/guildAuthorization.js";

const router = express.Router();

// Connection management — membership for reads, permission for writes
router.get(
  "/guilds/:guildId/status",
  internalAuth,
  requireGuildMembership,
  apiGetStreamStatus,
);
router.post(
  "/guilds/:guildId/connect",
  internalAuth,
  requireGuildPermission,
  apiGenerateConnectUrl,
);
router.delete(
  "/guilds/:guildId/disconnect",
  internalAuth,
  requireGuildPermission,
  apiDisconnectPlatform,
);

// Config
router.get(
  "/guilds/:guildId/config",
  internalAuth,
  requireGuildMembership,
  apiGetStreamConfig,
);
router.patch(
  "/guilds/:guildId/config",
  internalAuth,
  requireGuildPermission,
  apiUpdateStreamConfig,
);

// Alert test
router.post(
  "/guilds/:guildId/alert-test",
  internalAuth,
  requireGuildPermission,
  apiTestAlert,
);

// Chat commands
router.get(
  "/guilds/:guildId/commands",
  internalAuth,
  requireGuildMembership,
  apiListCommands,
);
router.post(
  "/guilds/:guildId/commands",
  internalAuth,
  requireGuildPermission,
  apiAddCommand,
);
router.patch(
  "/guilds/:guildId/commands/:name",
  internalAuth,
  requireGuildPermission,
  apiEditCommand,
);
router.delete(
  "/guilds/:guildId/commands/:name",
  internalAuth,
  requireGuildPermission,
  apiDeleteCommand,
);

// Chat filters
router.get(
  "/guilds/:guildId/filters",
  internalAuth,
  requireGuildMembership,
  apiGetFilters,
);
router.patch(
  "/guilds/:guildId/filters/:filter",
  internalAuth,
  requireGuildPermission,
  apiUpdateFilter,
);

// Quotes
router.get(
  "/guilds/:guildId/quotes",
  internalAuth,
  requireGuildMembership,
  apiListQuotes,
);
router.post(
  "/guilds/:guildId/quotes",
  internalAuth,
  requireGuildPermission,
  apiAddQuote,
);
router.delete(
  "/guilds/:guildId/quotes/:id",
  internalAuth,
  requireGuildPermission,
  apiDeleteQuote,
);

// Timers
router.get(
  "/guilds/:guildId/timers",
  internalAuth,
  requireGuildMembership,
  apiListTimers,
);
router.post(
  "/guilds/:guildId/timers",
  internalAuth,
  requireGuildPermission,
  apiAddTimer,
);
router.delete(
  "/guilds/:guildId/timers/:name",
  internalAuth,
  requireGuildPermission,
  apiDeleteTimer,
);

// Diagnostics
router.get(
  "/guilds/:guildId/diag",
  internalAuth,
  requireGuildMembership,
  apiGetDiagnostics,
);

// Overlay token generation
router.post(
  "/guilds/:guildId/overlay-token",
  internalAuth,
  requireGuildPermission,
  apiGenerateOverlayToken,
);

// Verify bot moderator status
router.get(
  "/guilds/:guildId/verify-mod",
  internalAuth,
  requireGuildMembership,
  apiVerifyMod,
);

export default router;
