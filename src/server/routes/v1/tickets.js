import express from "express";
import {
  apiListTickets,
  apiGetTicketStats,
  apiListPanels,
  apiListPanelsWithStats,
  apiListTranscripts,
  apiGetTicketSettings,
  apiUpdateTicketSettings,
  apiCreatePanel,
  apiUpdatePanel,
  apiRefreshPanel,
  apiDeletePanel,
  apiTogglePanel,
  apiGetStaffStats,
} from "../../controllers/TicketController.js";
import { apiRateLimiter } from "../../middleware/rateLimiter.js";
import { requireAuth } from "../../middleware/authentication.js";
import { requireGuildMembership } from "../../middleware/guildAuthorization.js";

const router = express.Router();

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

function validateGuildId(req, res, next) {
  const { guildId } = req.params;
  if (!guildId || !SNOWFLAKE_REGEX.test(guildId)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid guild ID format",
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

// GET /api/v1/guilds/:guildId/tickets/stats — Aggregate stats (must be before /tickets)
router.get(
  "/:guildId/tickets/stats",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiGetTicketStats,
);

// GET /api/v1/guilds/:guildId/tickets — List tickets with filtering
router.get(
  "/:guildId/tickets",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiListTickets,
);

// GET /api/v1/guilds/:guildId/tickets/panels — List all panels with stats
router.get(
  "/:guildId/tickets/panels",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiListPanelsWithStats,
);

// GET /api/v1/guilds/:guildId/tickets/transcripts — List transcripts with pagination
router.get(
  "/:guildId/tickets/transcripts",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiListTranscripts,
);

// GET /api/v1/guilds/:guildId/tickets/settings — Get ticket settings
router.get(
  "/:guildId/tickets/settings",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiGetTicketSettings,
);

// GET /api/v1/guilds/:guildId/tickets/staff — Staff performance stats
router.get(
  "/:guildId/tickets/staff",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiGetStaffStats,
);

// GET /api/v1/guilds/:guildId/panels — List panels for the guild
router.get(
  "/:guildId/panels",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiListPanels,
);

// PUT /api/v1/guilds/:guildId/tickets/settings — Update ticket settings
router.put(
  "/:guildId/tickets/settings",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiUpdateTicketSettings,
);

// POST /api/v1/guilds/:guildId/tickets/panels — Create a new ticket panel
router.post(
  "/:guildId/tickets/panels",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiCreatePanel,
);

// DELETE /api/v1/guilds/:guildId/tickets/panels/:panelId — Delete a ticket panel
router.delete(
  "/:guildId/tickets/panels/:panelId",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiDeletePanel,
);

// PUT /api/v1/guilds/:guildId/tickets/panels/:panelId — Update panel title/description
router.put(
  "/:guildId/tickets/panels/:panelId",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiUpdatePanel,
);

// POST /api/v1/guilds/:guildId/tickets/panels/:panelId/refresh — Refresh panel message
router.post(
  "/:guildId/tickets/panels/:panelId/refresh",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiRefreshPanel,
);

// PUT /api/v1/guilds/:guildId/tickets/panels/:panelId/toggle — Toggle panel enabled/disabled
router.put(
  "/:guildId/tickets/panels/:panelId/toggle",
  apiRateLimiter,
  requireAuth,
  validateGuildId,
  requireGuildMembership,
  apiTogglePanel,
);

export default router;
