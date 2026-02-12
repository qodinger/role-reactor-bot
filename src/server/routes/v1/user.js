import express from "express";
import {
  apiUserBalance,
  apiUserPayments,
} from "../../controllers/PaymentController.js";

import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

router.get("/:userId/balance", internalAuth, apiUserBalance);
router.get("/:userId/payments", internalAuth, apiUserPayments);

export default router;
