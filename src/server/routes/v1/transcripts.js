import express from "express";
import { viewTranscript } from "../../controllers/TranscriptController.js";
import { apiRateLimiter } from "../../middleware/rateLimiter.js";
import { requireAuth } from "../../middleware/authentication.js";

const router = express.Router();

/**
 * Transcript viewing route — requires authentication
 */
router.get("/:transcriptId", apiRateLimiter, requireAuth, viewTranscript);

export default router;
