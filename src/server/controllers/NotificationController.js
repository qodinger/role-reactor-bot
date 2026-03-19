import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Get user notifications
 */
export async function apiGetNotifications(req, res) {
  const userId = req.params.userId;

  if (!userId) {
    const { statusCode, response } = createErrorResponse(
      "User ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.notifications) {
      const { statusCode, response } = createErrorResponse(
        "Notifications not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const unreadOnly = req.query.unread === "true";

    const notifications = await dbManager.notifications.getByUserId(userId, {
      limit,
      skip,
      unreadOnly,
    });
    const unreadCount = await dbManager.notifications.getUnreadCount(userId);

    res.json(
      createSuccessResponse({
        notifications: notifications.map(n => ({
          id: n._id.toString(),
          type: n.type,
          title: n.title,
          message: n.message,
          icon: n.icon,
          read: n.read,
          metadata: n.metadata,
          createdAt: n.createdAt,
        })),
        unreadCount,
        pagination: { limit, skip, hasMore: notifications.length === limit },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting notifications:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve notifications",
      500,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get unread notification count
 */
export async function apiGetUnreadCount(req, res) {
  const userId = req.params.userId;

  if (!userId) {
    const { statusCode, response } = createErrorResponse(
      "User ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.notifications) {
      return res.json(createSuccessResponse({ unreadCount: 0 }));
    }

    const unreadCount = await dbManager.notifications.getUnreadCount(userId);
    res.json(createSuccessResponse({ unreadCount }));
  } catch (error) {
    logger.error("❌ Error getting unread count:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to get unread count",
      500,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Mark a single notification as read
 */
export async function apiMarkAsRead(req, res) {
  const { userId, notificationId } = req.params;

  if (!userId || !notificationId) {
    const { statusCode, response } = createErrorResponse(
      "User ID and notification ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.notifications) {
      const { statusCode, response } = createErrorResponse(
        "Notifications not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const success = await dbManager.notifications.markAsRead(
      notificationId,
      userId,
    );

    res.json(
      createSuccessResponse({
        success,
        message: "Notification marked as read",
      }),
    );
  } catch (error) {
    logger.error("❌ Error marking notification as read:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to mark notification as read",
      500,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function apiMarkAllAsRead(req, res) {
  const { userId } = req.params;

  if (!userId) {
    const { statusCode, response } = createErrorResponse(
      "User ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.notifications) {
      const { statusCode, response } = createErrorResponse(
        "Notifications not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const count = await dbManager.notifications.markAllAsRead(userId);
    res.json(
      createSuccessResponse({
        markedRead: count,
        message: `${count} notification${count !== 1 ? "s" : ""} marked as read`,
      }),
    );
  } catch (error) {
    logger.error("❌ Error marking all notifications as read:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to mark all as read",
      500,
    );
    res.status(statusCode).json(response);
  }
}
