import express from "express";
import {
  apiUserBalance,
  apiUserPayments,
} from "../../controllers/CorePricingController.js";
import {
  apiListUsers,
  apiUserInfo,
  apiSetUserRole,
  apiSyncUser,
  apiManageUserCores, // Added new function
} from "../../controllers/UserController.js";
import {
  apiGetNotifications,
  apiGetUnreadCount,
  apiMarkAsRead,
  apiMarkAllAsRead,
} from "../../controllers/NotificationController.js";

import { internalAuth } from "../../middleware/internalAuth.js";

const router = express.Router();

// Public/User accessible (via internalAuth from website)
router.post("/sync", internalAuth, apiSyncUser);
router.get("/:userId/balance", internalAuth, apiUserBalance);
router.get("/:userId/payments", internalAuth, apiUserPayments);

// Notification routes
router.get("/:userId/notifications", internalAuth, apiGetNotifications);
router.get(
  "/:userId/notifications/unread-count",
  internalAuth,
  apiGetUnreadCount,
);
router.patch("/:userId/notifications/read-all", internalAuth, apiMarkAllAsRead);
router.patch(
  "/:userId/notifications/:notificationId/read",
  internalAuth,
  apiMarkAsRead,
);

// Admin accessible (via internalAuth from website)
router.get("/", internalAuth, apiListUsers);
router.get("/:userId", internalAuth, apiUserInfo);
router.patch("/:userId/role", internalAuth, apiSetUserRole);
router.post("/:userId/cores/manage", internalAuth, apiManageUserCores);

export default router;
