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
  apiManageUserCores,
} from "../../controllers/UserController.js";
import {
  apiGetNotifications,
  apiGetUnreadCount,
  apiMarkAsRead,
  apiMarkAllAsRead,
} from "../../controllers/NotificationController.js";

import { internalAuth } from "../../middleware/internalAuth.js";
import { requireAuth } from "../../middleware/authentication.js";
import {
  requireOwnUser,
  requireAdmin,
} from "../../middleware/userAuthorization.js";

const router = express.Router();

// User data endpoints - require internal auth + user can only access their own data
router.post("/sync", requireAuth, apiSyncUser);
router.get("/:userId/balance", internalAuth, requireOwnUser, apiUserBalance);
router.get("/:userId/payments", internalAuth, requireOwnUser, apiUserPayments);

// Notification routes - require auth + user can only access their own notifications
router.get(
  "/:userId/notifications",
  requireAuth,
  requireOwnUser,
  apiGetNotifications,
);
router.get(
  "/:userId/notifications/unread-count",
  requireAuth,
  requireOwnUser,
  apiGetUnreadCount,
);
router.patch(
  "/:userId/notifications/read-all",
  requireAuth,
  requireOwnUser,
  apiMarkAllAsRead,
);
router.patch(
  "/:userId/notifications/:notificationId/read",
  requireAuth,
  requireOwnUser,
  apiMarkAsRead,
);

// Admin endpoints - require internal auth + admin role
router.get("/", internalAuth, requireAuth, requireAdmin, apiListUsers);
router.get("/:userId", internalAuth, requireAuth, requireAdmin, apiUserInfo);
router.patch(
  "/:userId/role",
  internalAuth,
  requireAuth,
  requireAdmin,
  apiSetUserRole,
);
router.post(
  "/:userId/cores/manage",
  internalAuth,
  requireAuth,
  requireAdmin,
  apiManageUserCores,
);

export default router;
