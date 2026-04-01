import express from "express";
import {
  apiPaymentStats,
  apiPendingPayments,
  apiGetAdminActionLogs,
} from "../../controllers/PaymentAdminController.js";
import { apiCreatePayment } from "../../controllers/PaymentProcessingController.js";

import { internalAuth } from "../../middleware/internalAuth.js";
import { requireAuth } from "../../middleware/authentication.js";
import { requireAdmin } from "../../middleware/userAuthorization.js";

const router = express.Router();

// Admin endpoints - require internal auth + user authentication
router.get("/stats", internalAuth, requireAuth, requireAdmin, apiPaymentStats);
router.get(
  "/pending",
  internalAuth,
  requireAuth,
  requireAdmin,
  apiPendingPayments,
);
router.get(
  "/logs/admin",
  internalAuth,
  requireAuth,
  requireAdmin,
  apiGetAdminActionLogs,
);

// Payment creation - requires internal auth (website verifies user session)
router.post("/create", internalAuth, apiCreatePayment);

export default router;
