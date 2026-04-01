import express from "express";
import { apiInfo } from "../api.js";
import {
  apiStats,
  apiCommandUsage,
} from "../../controllers/StatsController.js";
import { apiPricing } from "../../controllers/CorePricingController.js";
import { internalAuth } from "../../middleware/internalAuth.js";
import { requireAuth } from "../../middleware/authentication.js";

const router = express.Router();

router.get("/info", apiInfo);
router.get("/global", apiStats);
router.get("/usage", internalAuth, requireAuth, apiCommandUsage);
router.get("/pricing", apiPricing); // Keeping pricing under stats/general as it's often informational

export default router;
