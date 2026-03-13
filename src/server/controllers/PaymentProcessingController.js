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
 * Create payment invoice endpoint - Creates a Plisio crypto payment
 */
export async function apiCreatePayment(req, res) {
  logRequest("Create payment", req);

  try {
    const sessionUser = req.session?.discordUser;
    const { discordId, email, username, packageId, amount, currency } =
      req.body;
    let userInfo = null;

    if (sessionUser) {
      userInfo = {
        id: sessionUser.id,
        email: sessionUser.email,
        username: sessionUser.username,
      };
    } else if (discordId) {
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

    if (!amount || typeof amount !== "number" || amount < 1) {
      const { statusCode, response } = createErrorResponse(
        "Invalid amount",
        400,
        "Amount must be a positive number (minimum $1)",
      );
      return res.status(statusCode).json(response);
    }

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

    const orderNumber = `${userInfo.id}_${Date.now()}`;
    const fiatCurrency = "USD";
    const selectedCrypto = currency;
    const callbackUrl = `${config.botInfo.apiUrl}/webhook/crypto?json=true`;

    let orderName = "Core Credits";
    if (packageId && config.corePricing?.packages?.[packageId]) {
      orderName = config.corePricing.packages[packageId].name || "Core Credits";
    }

    const invoiceUrl = await plisioPay.createInvoice({
      amount,
      currency: fiatCurrency,
      cryptoCurrency: selectedCrypto,
      orderNumber,
      orderName,
      email: userInfo.email || null,
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
