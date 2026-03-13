import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";

const logger = getLogger();

/**
 * Global payment statistics endpoint (admin)
 */
export async function apiPaymentStats(req, res) {
  logRequest("Payment stats", req);

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.payments) {
      const { statusCode, response } = createErrorResponse(
        "PaymentRepository not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const stats = await dbManager.payments.getGlobalStats({
      startDate,
      endDate,
    });
    const recentPayments = await dbManager.payments.getRecent(10);

    res.json(
      createSuccessResponse({
        overview: {
          totalPayments: stats.totalPayments,
          totalRevenue: stats.totalRevenue,
          totalCoresGranted: stats.totalCores,
          uniqueCustomers: stats.uniqueUsers,
        },
        recentPayments: recentPayments.map(p => ({
          paymentId: p.paymentId,
          discordId: p.discordId,
          provider: p.provider,
          amount: p.amount,
          coresGranted: p.coresGranted,
          createdAt: p.createdAt,
        })),
        dateRange: { start: startDate, end: endDate },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting payment stats:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve payment statistics",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Pending payments endpoint (admin)
 */
export async function apiPendingPayments(req, res) {
  logRequest("Pending payments", req);

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.payments) {
      const { getStorageManager } = await import(
        "../../utils/storage/storageManager.js"
      );
      const storage = await getStorageManager();
      const pendingPaypal =
        (await storage.get("pending_paypal_payments")) || [];
      const pendingCrypto =
        (await storage.get("pending_crypto_payments")) || [];
      return res.json(
        createSuccessResponse({
          pending: [...pendingPaypal, ...pendingCrypto],
          total: pendingPaypal.length + pendingCrypto.length,
          source: "legacy",
        }),
      );
    }

    const pendingPayments = await dbManager.payments.getPending({ limit: 100 });
    const paymentsWithoutUser =
      await dbManager.payments.getPaymentsWithoutDiscordId();

    res.json(
      createSuccessResponse({
        pending: pendingPayments.map(p => ({
          paymentId: p.paymentId,
          provider: p.provider,
          amount: p.amount,
          currency: p.currency,
          email: p.email,
          status: p.status,
          createdAt: p.createdAt,
        })),
        awaitingUserLink: paymentsWithoutUser.map(p => ({
          paymentId: p.paymentId,
          provider: p.provider,
          amount: p.amount,
          email: p.email,
          createdAt: p.createdAt,
        })),
        totals: {
          pending: pendingPayments.length,
          awaitingLink: paymentsWithoutUser.length,
        },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting pending payments:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve pending payments",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Admin action logs endpoint - Returns logs of admin core adjustments
 */
export async function apiGetAdminActionLogs(req, res) {
  logRequest("Admin action logs", req);

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.payments) {
      const { statusCode, response } = createErrorResponse(
        "PaymentRepository not available",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    const userId = req.query.userId || null;
    const query = { provider: "admin_adjustment" };
    if (userId) query.discordId = userId;

    const logs = await dbManager.payments.collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();
    const total = await dbManager.payments.collection.countDocuments(query);

    res.json(
      createSuccessResponse({
        logs: logs.map(l => ({
          logId: l.paymentId,
          userId: l.discordId,
          type: "adjustment",
          change: l.coresGranted,
          adminUser: l.metadata?.adminUser || "unknown",
          reason: l.metadata?.reason || "No reason provided",
          action: l.metadata?.action,
          originalAmount: l.metadata?.originalAmount,
          oldBalance: l.metadata?.previousBalance,
          newBalance: l.metadata?.newBalance,
          timestamp: l.createdAt,
        })),
        pagination: { total, limit, skip, hasMore: skip + logs.length < total },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting admin action logs:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve admin logs",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
