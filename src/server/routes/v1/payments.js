import express from "express";
import {
  apiPaymentStats,
  apiPendingPayments,
  apiCreatePayment,
  apiCreatePayPalOrder,
  apiCapturePayPalOrder,
} from "../api.js";

const router = express.Router();

router.get("/stats", apiPaymentStats);
router.get("/pending", apiPendingPayments);
router.post("/create", apiCreatePayment);
router.post("/paypal/create", apiCreatePayPalOrder);
router.post("/paypal/capture", apiCapturePayPalOrder);

export default router;
