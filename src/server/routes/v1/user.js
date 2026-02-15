import express from "express";
import {
  apiUserBalance,
  apiUserPayments,
} from "../../controllers/PaymentController.js";
import {
  apiListUsers,
  apiUserInfo,
  apiSetUserRole,
  apiSyncUser,
  apiManageUserCores, // Added new function
} from "../../controllers/UserController.js";

import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

// Public/User accessible (via internalAuth from website)
router.post("/sync", internalAuth, apiSyncUser);
router.get("/:userId/balance", internalAuth, apiUserBalance);
router.get("/:userId/payments", internalAuth, apiUserPayments);

// Admin accessible (via internalAuth from website)
router.get("/", internalAuth, apiListUsers);
router.get("/:userId", internalAuth, apiUserInfo);
router.patch("/:userId/role", internalAuth, apiSetUserRole);
router.post("/:userId/cores/manage", internalAuth, apiManageUserCores);

export default router;
