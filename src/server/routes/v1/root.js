import express from "express";
import {
  apiInfo,
  apiStats,
  apiPricing,
  apiUserBalance,
  apiUserPayments,
} from "../api.js";

const router = express.Router();

router.get("/info", apiInfo);
router.get("/stats", apiStats);
router.get("/pricing", apiPricing);

// Legacy/Compatibility routes
router.get("/balance", apiUserBalance);
router.get("/payments", apiUserPayments);

export default router;
