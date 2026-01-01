/**
 * Payments Service
 * Provides API endpoints for payment processing via Coinbase Commerce
 */

import { BaseService } from "../BaseService.js";
import { requireAuth } from "../../middleware/authentication.js";
import { validateBody, validateParams } from "../../middleware/validation.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

export class PaymentsService extends BaseService {
  constructor() {
    super({
      name: "payments",
      version: "v1",
      basePath: "/api/payments",
      metadata: {
        description: "Payment processing API via Coinbase Commerce",
        version: "1.0.0",
      },
    });

    this.setupRoutes();
  }

  /**
   * Override setupCommonMiddleware to skip health endpoint registration
   * We'll register it in setupRoutes() before applying auth
   */
  setupCommonMiddleware() {
    // Request ID middleware (for tracing)
    this.router.use((req, res, next) => {
      req.requestId =
        req.headers["x-request-id"] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader("X-Request-ID", req.requestId);
      next();
    });

    // Service context middleware
    this.router.use((req, res, next) => {
      req.serviceContext = {
        service: this.name,
        version: this.version,
        basePath: this.basePath,
      };
      next();
    });

    // Health endpoint will be registered in setupRoutes() before auth
  }

  setupRoutes() {
    // Register health endpoint (public, no auth required)
    this.router.get(
      "/health",
      this.asyncHandler(async (req, res) => {
        const healthStatus = await this.getHealthStatus();
        this.sendSuccess(res, healthStatus);
      }),
    );

    // Apply authentication to protected routes only
    // POST /api/payments/create - Create payment link
    this.post(
      "/create",
      requireAuth,
      validateBody({
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["payment"] },
          amount: { type: "number", min: 5 },
          tier: { type: "string" },
        },
      }),
      this.asyncHandler(this.handleCreate.bind(this)),
    );

    // GET /api/payments/history - Get payment history
    this.get(
      "/history",
      requireAuth,
      this.asyncHandler(this.handleHistory.bind(this)),
    );

    // GET /api/payments/status/:chargeId - Get payment status
    this.get(
      "/status/:chargeId",
      requireAuth,
      validateParams({
        required: ["chargeId"],
        properties: {
          chargeId: { type: "string" },
        },
      }),
      this.asyncHandler(this.handleStatus.bind(this)),
    );
  }

  async handleCreate(req, res) {
    const { type, amount, tier } = req.body;
    const userId = req.user.id;

    // Check if crypto payments are enabled
    if (
      !process.env.COINBASE_ENABLED ||
      process.env.COINBASE_ENABLED !== "true"
    ) {
      return this.sendError(res, "Cryptocurrency payments not enabled", 503);
    }

    const apiKey = process.env.COINBASE_API_KEY;
    if (!apiKey) {
      logger.error("COINBASE_API_KEY not configured");
      return this.sendError(res, "Payment system not configured", 500);
    }

    if (type === "subscription") {
      return this.sendError(
        res,
        "Subscriptions are no longer supported. Please use one-time payments.",
        400,
      );
    }

    // Load config for pricing
    const configModule = await import("../../../config/config.js").catch(
      () => null,
    );
    const config = configModule?.config || configModule?.default || {};
    // All pricing values come from config - use package pricing
    const packages = config?.corePricing?.packages || {};

    if (!packages || Object.keys(packages).length === 0) {
      logger.error("❌ Core pricing packages not found in config");
      return this.sendError(res, "Payment system configuration error", 500);
    }

    // Get minimum payment amount from config
    const minimumAmount = config?.corePricing?.coreSystem?.minimumPayment;
    if (!minimumAmount) {
      logger.error("❌ Minimum payment amount not found in config");
      return this.sendError(res, "Payment system configuration error", 500);
    }

    // Calculate rate from packages (use $10 package as default)
    // If packages not available, calculate from smallest package
    let defaultRate = 0;
    if (packages.$10) {
      defaultRate = (packages.$10.baseCores + packages.$10.bonusCores) / 10;
    } else if (packages.$5) {
      defaultRate = (packages.$5.baseCores + packages.$5.bonusCores) / 5;
    } else if (packages.$25) {
      defaultRate = (packages.$25.baseCores + packages.$25.bonusCores) / 25;
    } else if (packages.$50) {
      defaultRate = (packages.$50.baseCores + packages.$50.bonusCores) / 50;
    }

    if (!defaultRate) {
      logger.error(
        "❌ Unable to calculate default rate - no packages found in config",
      );
      return this.sendError(res, "Payment processing configuration error", 500);
    }

    if (amount && amount < minimumAmount) {
      return this.sendError(
        res,
        `Amount must be at least $${minimumAmount}`,
        400,
      );
    }

    // Use tiered rates based on amount
    let paymentRate = defaultRate;
    if (amount >= 50 && packages.$50) {
      paymentRate = (packages.$50.baseCores + packages.$50.bonusCores) / 50;
    } else if (amount >= 25 && packages.$25) {
      paymentRate = (packages.$25.baseCores + packages.$25.bonusCores) / 25;
    } else if (amount >= 10 && packages.$10) {
      paymentRate = (packages.$10.baseCores + packages.$10.bonusCores) / 10;
    } else if (amount >= 5 && packages.$5) {
      paymentRate = (packages.$5.baseCores + packages.$5.bonusCores) / 5;
    }

    const price = amount;
    const credits = Math.floor(amount * paymentRate);
    const description = "One-time Core credits purchase";

    // Create Coinbase Commerce charge
    const chargeData = {
      name: "Core Credits",
      description,
      pricing_type: "fixed_price",
      local_price: {
        amount: price.toString(),
        currency: "USD",
      },
      metadata: {
        discord_user_id: userId,
        tier: null,
        type: "payment",
      },
    };

    const response = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey,
        "X-CC-Version": "2018-03-22",
      },
      body: JSON.stringify(chargeData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `Coinbase Commerce API error: ${response.status} - ${errorText}`,
        { requestId: req.requestId, userId },
      );
      return this.sendError(res, "Failed to create payment", 500);
    }

    const charge = await response.json();
    const paymentUrl = charge.data?.hosted_url;

    if (!paymentUrl) {
      return this.sendError(res, "Failed to create payment URL", 500);
    }

    logger.info(`Payment created for user ${userId}: ${type} - $${price}`, {
      requestId: req.requestId,
      chargeId: charge.data?.id,
    });

    this.sendSuccess(
      res,
      {
        paymentUrl,
        chargeId: charge.data?.id,
        amount: price,
        credits,
        type,
        tier: tier || null,
      },
      201,
    );
  }

  async handleHistory(req, res) {
    const userId = req.user.id;

    // Get user's payment history from storage
    const { getStorageManager } = await import(
      "../../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    const userData = coreCredits[userId] || {};
    const payments = userData.cryptoPayments || [];

    this.sendSuccess(res, {
      payments: payments.map(p => ({
        chargeId: p.chargeId,
        type: p.type,
        tier: p.tier,
        amount: p.amount,
        currency: p.currency,
        cores: p.cores,
        timestamp: p.timestamp,
      })),
      totalPayments: payments.length,
      totalSpent: payments.reduce((sum, p) => sum + p.amount, 0),
      totalCredits: userData.credits || 0,
    });
  }

  async handleStatus(req, res) {
    const { chargeId } = req.params;
    const userId = req.user.id;

    // Check Coinbase Commerce API key
    const apiKey = process.env.COINBASE_API_KEY;
    if (!apiKey) {
      return this.sendError(res, "Payment system not configured", 500);
    }

    // Get charge status from Coinbase Commerce
    const response = await fetch(
      `https://api.commerce.coinbase.com/charges/${chargeId}`,
      {
        headers: {
          "X-CC-Api-Key": apiKey,
          "X-CC-Version": "2018-03-22",
        },
      },
    );

    if (!response.ok) {
      return this.sendError(res, "Payment not found", 404);
    }

    const charge = await response.json();
    const chargeData = charge.data;

    // Verify charge belongs to user
    if (chargeData.metadata?.discord_user_id !== userId) {
      return this.sendError(res, "Payment does not belong to you", 403);
    }

    // Get latest timeline status
    const latestStatus =
      chargeData.timeline?.[chargeData.timeline.length - 1]?.status;

    // Extract settlement currency (which crypto was actually used)
    const settlementCurrency = chargeData.pricing?.settlement?.currency;
    const settlementAmount = chargeData.pricing?.settlement?.amount;

    // Extract network/chain info from web3_data if available
    const chainId = chargeData.web3_data?.transfer_intent?.metadata?.chain_id;
    const inputTokenAddress =
      chargeData.web3_data?.success_events?.[0]?.input_token_address;

    this.sendSuccess(res, {
      chargeId: chargeData.id,
      code: chargeData.code,
      status: latestStatus,
      amount: chargeData.pricing?.local?.amount,
      currency: chargeData.pricing?.local?.currency,
      settlementCurrency: settlementCurrency || null,
      settlementAmount: settlementAmount || null,
      chainId: chainId || null,
      inputTokenAddress: inputTokenAddress || null,
      createdAt: chargeData.created_at,
      expiresAt: chargeData.expires_at,
      confirmedAt: chargeData.confirmed_at || null,
      timeline: chargeData.timeline || [],
    });
  }

  /**
   * Get service health status
   * Includes Coinbase Commerce API connectivity check
   */
  async getHealthStatus() {
    const baseStatus = await super.getHealthStatus();

    const checks = {};

    // Check if payments are enabled
    const paymentsEnabled =
      process.env.COINBASE_ENABLED === "true" && !!process.env.COINBASE_API_KEY;

    checks.paymentsEnabled = {
      status: paymentsEnabled ? "healthy" : "disabled",
      message: paymentsEnabled
        ? "Payments enabled and configured"
        : "Payments disabled or not configured",
    };

    // Check Coinbase API connectivity (if enabled)
    if (paymentsEnabled) {
      try {
        // Simple connectivity check - we could ping their API here
        // For now, just verify the API key is set
        if (process.env.COINBASE_API_KEY) {
          checks.coinbaseApi = {
            status: "healthy",
            message: "Coinbase API key configured",
          };
        } else {
          checks.coinbaseApi = {
            status: "unhealthy",
            message: "Coinbase API key not configured",
          };
        }
      } catch (error) {
        checks.coinbaseApi = {
          status: "unhealthy",
          message: "Coinbase API check failed",
          error: error.message,
        };
      }
    }

    // Determine overall status
    const allHealthy = Object.values(checks).every(
      check => check.status === "healthy" || check.status === "disabled",
    );

    return {
      ...baseStatus,
      status: allHealthy ? "healthy" : "degraded",
      checks,
    };
  }
}

// Export service config for auto-loading (optional)
export const serviceConfig = {
  name: "payments",
  version: "v1",
  basePath: "/api/payments",
  loader: () => {
    const service = new PaymentsService();
    return service;
  },
  metadata: {
    description: "Payment processing API via Coinbase Commerce",
    version: "1.0.0",
  },
};
