import express from "express";
import {
  apiPaymentStats,
  apiPendingPayments,
  apiCreatePayment,
  apiCreatePayPalOrder,
  apiCapturePayPalOrder,
} from "../../controllers/PaymentController.js";

import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

router.get("/stats", internalAuth, apiPaymentStats);
router.get("/pending", internalAuth, apiPendingPayments);
router.post("/create", apiCreatePayment);
router.post("/paypal/create", apiCreatePayPalOrder);
router.post("/paypal/capture", apiCapturePayPalOrder);

export default router;
