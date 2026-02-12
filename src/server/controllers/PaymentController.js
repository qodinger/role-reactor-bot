import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";
import { plisioPay } from "../../utils/payments/plisio.js";
import * as paypal from "../../utils/payments/paypal.js";
import { config } from "../../config/config.js";

const logger = getLogger();

/**
 * Core pricing endpoint - Returns package pricing for website integration
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiPricing(req, res) {
  logRequest("Pricing info", req);

  try {
    const corePricing = config.corePricing;

    if (!corePricing || !corePricing.packages) {
      const { statusCode, response } = createErrorResponse(
        "Pricing configuration not available",
        500,
      );
      return res.status(statusCode).json(response);
    }

    // Get optional user ID for personalized pricing
    const userId = req.query.user_id || req.query.discord_id || null;
    const isDev = config.isDeveloper(userId);

    // Build packages array with clean structure for website
    const packages = Object.entries(corePricing.packages)
      .filter(([_, pkg]) => !pkg.hidden || isDev) // Filter hidden packages for non-devs
      .map(([key, pkg]) => ({
        id: key,
        name: pkg.name,
        price: parseFloat(key.replace("$", "")),
        currency: "USD",
        baseCores: pkg.baseCores,
        bonusCores: pkg.bonusCores,
        totalCores: pkg.totalCores,
        rate: pkg.rate,
        valuePerDollar: `${pkg.rate.toFixed(1)} Cores/$1`,
        description: pkg.description,
        estimatedUsage: pkg.estimatedUsage,
        popular: pkg.popular || false,
        features: pkg.features || [],
      }));

    // Sort by price
    packages.sort((a, b) => a.price - b.price);

    // Get active promotions
    const activePromotions = [];
    const promotions = corePricing.coreSystem?.promotions;

    if (promotions?.enabled && promotions?.types) {
      const now = new Date();
      const dayOfWeek = now.getDay();

      for (const promo of promotions.types) {
        if (promo.type === "first_purchase") {
          activePromotions.push({
            name: promo.name,
            type: promo.type,
            bonus: `${promo.bonus * 100}%`,
            maxBonus: promo.maxBonus,
            description: `Get ${promo.bonus * 100}% bonus Cores on your first purchase (up to ${promo.maxBonus} bonus Cores)`,
          });
        } else if (
          promo.type === "weekend" &&
          promo.days?.includes(dayOfWeek)
        ) {
          activePromotions.push({
            name: promo.name,
            type: promo.type,
            bonus: `${promo.bonus * 100}%`,
            description: `Weekend special: ${promo.bonus * 100}% bonus Cores on all purchases!`,
            active: true,
          });
        }
      }
    }

    // Check for first purchase eligibility if user ID provided
    let userEligibility = null;
    if (userId) {
      try {
        const { getStorageManager } = await import(
          "../../utils/storage/storageManager.js"
        );
        const storage = await getStorageManager();
        const coreCredits = (await storage.get("core_credit")) || {};
        const userData = coreCredits[userId];

        const hasPayments =
          userData?.paypalPayments?.length > 0 ||
          userData?.cryptoPayments?.length > 0;

        userEligibility = {
          userId,
          isFirstPurchase: !hasPayments,
          currentCredits: userData?.credits || 0,
          eligibleForFirstPurchaseBonus: !hasPayments,
        };
      } catch (error) {
        logger.warn("Failed to check user eligibility:", error.message);
      }
    }

    // Build response
    const minPayment =
      isDev && config.payments.paypal.testMode
        ? 1
        : corePricing.coreSystem?.minimumPayment || 3;

    const response = {
      packages,
      minimumPayment: minPayment,
      currency: "USD",
      paymentMethods: {
        paypal: config.payments.paypal.enabled,
        crypto: config.payments.plisio.enabled,
      },
      promotions: activePromotions,
      referralSystem: corePricing.coreSystem?.referralSystem?.enabled
        ? {
            enabled: true,
            referrerBonus: `${(corePricing.coreSystem.referralSystem.referrerBonus || 0) * 100}%`,
            refereeBonus: `${(corePricing.coreSystem.referralSystem.refereeBonus || 0) * 100}%`,
            minimumPurchase:
              corePricing.coreSystem.referralSystem.minimumPurchase || 10,
          }
        : { enabled: false },
    };

    // Add user eligibility if available
    if (userEligibility) {
      response.user = userEligibility;
    }

    res.json(createSuccessResponse(response));
  } catch (error) {
    logger.error("❌ Error getting pricing info:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve pricing information",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * User Core balance endpoint - Returns user's Core credits
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiUserBalance(req, res) {
  logRequest("User balance", req);

  const userId = req.params.userId || req.query.user_id || req.query.discord_id;

  if (!userId) {
    const { statusCode, response } = createErrorResponse(
      "User ID is required",
      400,
      "Provide user_id as a URL parameter or query parameter",
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};
    const userData = coreCredits[userId];

    if (!userData) {
      res.json(
        createSuccessResponse({
          userId,
          credits: 0,
          hasAccount: false,
          paymentHistory: {
            paypal: 0,
            crypto: 0,
          },
        }),
      );
      return;
    }

    res.json(
      createSuccessResponse({
        userId,
        credits: userData.credits || 0,
        hasAccount: true,
        lastUpdated: userData.lastUpdated || null,
        paymentHistory: {
          paypal: userData.paypalPayments?.length || 0,
          crypto: userData.cryptoPayments?.length || 0,
        },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting user balance:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve user balance",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * User payment history endpoint - Returns user's payment transactions
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiUserPayments(req, res) {
  logRequest("User payments", req);

  const userId = req.params.userId || req.query.user_id || req.query.discord_id;

  if (!userId) {
    const { statusCode, response } = createErrorResponse(
      "User ID is required",
      400,
      "Provide user_id as a URL parameter or query parameter",
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.payments) {
      // Fallback to legacy storage if PaymentRepository not available
      const { getStorageManager } = await import(
        "../../utils/storage/storageManager.js"
      );
      const storage = await getStorageManager();
      const coreCredits = (await storage.get("core_credit")) || {};
      const userData = coreCredits[userId];

      const payments = [];
      if (userData?.paypalPayments) {
        payments.push(
          ...userData.paypalPayments.map(p => ({
            ...p,
            provider: "paypal",
          })),
        );
      }
      if (userData?.cryptoPayments) {
        payments.push(...userData.cryptoPayments);
      }

      // Sort by timestamp descending
      payments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      res.json(
        createSuccessResponse({
          userId,
          payments,
          total: payments.length,
          source: "legacy",
        }),
      );
      return;
    }

    // Use PaymentRepository
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    const provider = req.query.provider || null;

    const payments = await dbManager.payments.findByDiscordId(userId, {
      limit,
      skip,
      status: "completed",
      provider,
    });

    const stats = await dbManager.payments.getUserStats(userId);

    res.json(
      createSuccessResponse({
        userId,
        payments: payments.map(p => ({
          paymentId: p.paymentId,
          provider: p.provider,
          amount: p.amount,
          currency: p.currency,
          coresGranted: p.coresGranted,
          tier: p.tier,
          status: p.status,
          createdAt: p.createdAt,
        })),
        total: stats.totalPayments,
        stats: {
          totalAmount: stats.totalAmount,
          totalCores: stats.totalCores,
          byProvider: stats.byProvider,
        },
        pagination: {
          limit,
          skip,
          hasMore: payments.length === limit,
        },
      }),
    );
  } catch (error) {
    logger.error("❌ Error getting user payments:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve payment history",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Global payment statistics endpoint (admin)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
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

    // Optional date range
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
        dateRange: {
          start: startDate,
          end: endDate,
        },
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
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiPendingPayments(req, res) {
  logRequest("Pending payments", req);

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    if (!dbManager?.payments) {
      // Fallback to legacy storage
      const { getStorageManager } = await import(
        "../../utils/storage/storageManager.js"
      );
      const storage = await getStorageManager();

      const pendingPaypal =
        (await storage.get("pending_paypal_payments")) || [];
      const pendingCrypto =
        (await storage.get("pending_crypto_payments")) || [];

      res.json(
        createSuccessResponse({
          pending: [...pendingPaypal, ...pendingCrypto],
          total: pendingPaypal.length + pendingCrypto.length,
          source: "legacy",
        }),
      );
      return;
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
 * Create payment invoice endpoint - Creates a Plisio crypto payment
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiCreatePayment(req, res) {
  logRequest("Create payment", req);

  try {
    // Get user info from session OR request body (for website integration)
    const sessionUser = req.session?.discordUser;
    const { discordId, email, username, packageId, amount, currency } =
      req.body;

    // Determine user info - prefer session, fallback to body params
    let userInfo = null;

    if (sessionUser) {
      // User authenticated via Discord OAuth on the bot
      userInfo = {
        id: sessionUser.id,
        email: sessionUser.email,
        username: sessionUser.username,
      };
    } else if (discordId) {
      // User info passed from website (website already authenticated them)
      userInfo = {
        id: discordId,
        email: email || null,
        username: username || null,
      };
    }

    if (!userInfo) {
      const { statusCode, response } = createErrorResponse(
        "Authentication required",
        401,
        "Please login with Discord first",
      );
      return res.status(statusCode).json(response);
    }

    // Validate request body
    if (!amount || typeof amount !== "number" || amount < 1) {
      const { statusCode, response } = createErrorResponse(
        "Invalid amount",
        400,
        "Amount must be a positive number (minimum $1)",
      );
      return res.status(statusCode).json(response);
    }

    // Validate amount against config
    // Validate amount against config
    // Allow $1 for developers in test mode
    const isDev = config.isDeveloper(userInfo.id);
    const minimumAmount =
      isDev && config.payments?.paypal?.testMode
        ? 0.5
        : config.corePricing?.coreSystem?.minimumPayment || 1;

    if (amount < minimumAmount) {
      const { statusCode, response } = createErrorResponse(
        "Amount too low",
        400,
        `Minimum payment amount is $${minimumAmount}`,
      );
      return res.status(statusCode).json(response);
    }

    // Generate unique order number
    const orderNumber = `${userInfo.id}_${Date.now()}`;
    const fiatCurrency = "USD";
    const selectedCrypto = currency; // This comes from the request body (Bitcoin choice)

    // Build callback URL using centralized config
    const callbackUrl = `${config.botInfo.apiUrl}/webhook/crypto?json=true`;

    // Get package name for description
    let orderName = "Core Credits";
    if (packageId && config.corePricing?.packages?.[packageId]) {
      orderName = config.corePricing.packages[packageId].name || "Core Credits";
    }

    // Create Plisio invoice with user's Discord email pre-filled
    const invoiceUrl = await plisioPay.createInvoice({
      amount,
      currency: fiatCurrency,
      cryptoCurrency: selectedCrypto,
      orderNumber,
      orderName,
      email: userInfo.email || null, // Pre-fill email from Discord OAuth
      callbackUrl,
    });

    logger.info(
      `CREATE_PAYMENT: User ${userInfo.id} (${userInfo.username || "unknown"}) created $${amount} payment via ${sessionUser ? "session" : "website"}`,
    );

    res.json(
      createSuccessResponse({
        invoiceUrl,
        orderId: orderNumber,
        amount,
        currency,
        packageId: packageId || null,
        user: {
          discordId: userInfo.id,
          username: userInfo.username,
          emailPrefilled: !!userInfo.email,
        },
        message:
          "Payment invoice created successfully. Redirect user to invoiceUrl.",
      }),
    );
  } catch (error) {
    logger.error("❌ Error creating payment:", error);

    // Handle specific Plisio errors
    const errorMessage = error.message?.includes("PLISIO_SECRET_KEY")
      ? "Payment system is not configured"
      : "Failed to create payment invoice";

    const { statusCode, response } = createErrorResponse(
      errorMessage,
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Handle PayPal order creation
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiCreatePayPalOrder(req, res) {
  logRequest("Create PayPal order", req);

  try {
    const { amount, packageId, discordId } = req.body;
    const sessionUser = req.session?.discordUser;
    const userId = sessionUser?.id || discordId;

    if (!userId) {
      const { statusCode, response } = createErrorResponse(
        "Authentication required",
        401,
      );
      return res.status(statusCode).json(response);
    }

    if (!amount || isNaN(amount) || amount < 0.5) {
      const { statusCode, response } = createErrorResponse(
        "Invalid amount",
        400,
      );
      return res.status(statusCode).json(response);
    }

    const orderData = await paypal.createPayPalOrder({
      amount,
      currency: "USD",
      description: `Role Reactor Bot - ${packageId || "Credits"}`,
      customId: userId,
    });

    res.json(createSuccessResponse({ data: orderData }));
  } catch (error) {
    logger.error("❌ Error creating PayPal order:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to create PayPal order",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Handle PayPal order capture
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function apiCapturePayPalOrder(req, res) {
  logRequest("Capture PayPal order", req);

  try {
    const { orderID } = req.body;
    if (!orderID) {
      const { statusCode, response } = createErrorResponse(
        "Order ID is required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    const captureData = await paypal.capturePayPalOrder(orderID);

    // The webhook will handle the credit granting, but we return success here
    res.json(createSuccessResponse({ data: captureData }));
  } catch (error) {
    logger.error("❌ Error capturing PayPal order:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to capture PayPal order",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
