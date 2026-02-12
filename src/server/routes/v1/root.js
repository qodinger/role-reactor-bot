import express from "express";
import { apiInfo } from "../api.js";
import { apiStats } from "../../controllers/StatsController.js";
import {
  apiPricing,
  apiUserBalance,
  apiUserPayments,
} from "../../controllers/PaymentController.js";

const router = express.Router();

router.get("/info", apiInfo);
router.get("/stats", apiStats);
router.get("/pricing", apiPricing);

// Legacy/Compatibility routes
router.get("/balance", apiUserBalance);
router.get("/payments", apiUserPayments);

export default router;
