import express from "express";
import {
  apiGetGuildSettings,
  apiUpdateGuildSettings,
  apiGetGuildChannels,
  apiCheckGuilds,
  apiActivatePremiumFeature,
  apiGuildLeaderboard,
} from "../api.js";
import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

// Bulk check
router.post("/check", apiCheckGuilds);

// Settings
router.get("/:guildId/settings", internalAuth, apiGetGuildSettings);
router.patch("/:guildId/settings", internalAuth, apiUpdateGuildSettings);

// Channels
router.get("/:guildId/channels", internalAuth, apiGetGuildChannels);

// Premium
router.post("/:guildId/premium/activate", apiActivatePremiumFeature);

// Leaderboard
router.get("/:guildId/leaderboard", apiGuildLeaderboard);

export default router;
