import express from "express";
import {
  apiPaymentStats,
  apiPendingPayments,
  apiGetAdminActionLogs,
} from "../../controllers/PaymentAdminController.js";
import { apiCreatePayment } from "../../controllers/PaymentProcessingController.js";

import { internalAuth } from "../../middleware/internalAuth.js";
import { requireAuth } from "../../middleware/authentication.js";

const router = express.Router();

// Admin endpoints - require internal auth + user authentication
router.get("/stats", internalAuth, requireAuth, apiPaymentStats);
router.get("/pending", internalAuth, requireAuth, apiPendingPayments);
router.get("/logs/admin", internalAuth, requireAuth, apiGetAdminActionLogs);

// Payment creation - requires authenticated user (who is making the payment)
router.post("/create", requireAuth, apiCreatePayment);

export default router;
