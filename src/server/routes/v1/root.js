import express from "express";
import { apiInfo } from "../api.js";
import { apiStats } from "../../controllers/StatsController.js";
import {
  apiPricing,
  apiUserBalance,
  apiUserPayments,
} from "../../controllers/CorePricingController.js";
import { internalAuth } from "../../middleware/internalAuth.js";
import { requireAuth } from "../../middleware/authentication.js";
import { requireOwnUser } from "../../middleware/userAuthorization.js";

const router = express.Router();

router.get("/info", apiInfo);
router.get("/stats", apiStats);
router.get("/pricing", apiPricing);

router.get(
  "/balance",
  internalAuth,
  requireAuth,
  requireOwnUser,
  apiUserBalance,
);
router.get(
  "/payments",
  internalAuth,
  requireAuth,
  requireOwnUser,
  apiUserPayments,
);

export default router;
