import express from "express";
import { apiGetHealth } from "../../controllers/HealthController.js";

const router = express.Router();

/**
 * @route GET /api/v1/health
 * @desc Get system health metrics
 * @access Internal (requires internal auth)
 */
router.get("/", apiGetHealth);

export default router;
