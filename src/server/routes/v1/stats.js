import express from "express";
import { apiInfo } from "../api.js";
import {
  apiStats,
  apiCommandUsage,
  apiActiveUsers,
  apiRecentUsers,
} from "../../controllers/StatsController.js";
import { apiPricing } from "../../controllers/CorePricingController.js";
import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

router.get("/info", apiInfo);
// Global stats expose server-wide numbers — internal only
router.get("/global", internalAuth, apiStats);
router.get("/usage", internalAuth, apiCommandUsage);
router.get("/active-users", internalAuth, apiActiveUsers);
router.get("/recent-users", internalAuth, apiRecentUsers);
router.get("/pricing", apiPricing); // Keeping pricing under stats/general as it's often informational

export default router;
