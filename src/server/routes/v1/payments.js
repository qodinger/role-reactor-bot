import express from "express";
import {
  apiPaymentStats,
  apiPendingPayments,
  apiGetAdminActionLogs,
} from "../../controllers/PaymentAdminController.js";
import {
  apiCreatePayment,
  apiCreatePayPalOrder,
  apiCapturePayPalOrder,
} from "../../controllers/PaymentProcessingController.js";

import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

router.get("/stats", internalAuth, apiPaymentStats);
router.get("/pending", internalAuth, apiPendingPayments);
router.get("/logs/admin", internalAuth, apiGetAdminActionLogs);
router.post("/create", apiCreatePayment);
router.post("/paypal/create", apiCreatePayPalOrder);
router.post("/paypal/capture", apiCapturePayPalOrder);

export default router;
