import express from "express";
import { apiInfo, apiStats, apiCommandUsage, apiPricing } from "../api.js";

const router = express.Router();

router.get("/info", apiInfo);
router.get("/global", apiStats);
router.get("/usage", apiCommandUsage);
router.get("/pricing", apiPricing); // Keeping pricing under stats/general as it's often informational

export default router;
