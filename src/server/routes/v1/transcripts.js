import express from "express";
import { viewTranscript } from "../../controllers/TranscriptController.js";
import { apiRateLimiter } from "../../middleware/rateLimiter.js";

const router = express.Router();

/**
 * Public transcript viewing route
 * No authentication required to view transcripts by ID
 */
router.get("/:transcriptId", apiRateLimiter, viewTranscript);

export default router;
