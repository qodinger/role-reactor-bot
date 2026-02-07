import express from "express";
import { apiUserBalance, apiUserPayments } from "../api.js";

const router = express.Router();

router.get("/:userId/balance", apiUserBalance);
router.get("/:userId/payments", apiUserPayments);

export default router;
