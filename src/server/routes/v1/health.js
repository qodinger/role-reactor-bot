import express from "express";
import { apiGetHealth } from "../../controllers/HealthController.js";
import { apiRateLimiter } from "../../middleware/rateLimiter.js";

const router = express.Router();

/**
 * @route GET /api/v1/health
 * @desc Get system health metrics
 * @access Public (rate limited)
 */
router.get("/", apiRateLimiter, apiGetHealth);

export default router;
