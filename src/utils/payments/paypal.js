import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
} from "@paypal/paypal-server-sdk";
import { getLogger } from "../logger.js";

const logger = getLogger();

let paypalClient = null;
let ordersController = null;
let paymentsController = null;

/**
 * Initialize the PayPal SDK client
 * @returns {Object} Object containing controllers
 */
export function getPayPalClient() {
  if (paypalClient) return { ordersController, paymentsController };

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || "sandbox";

  if (!clientId || !clientSecret) {
    logger.warn(
      "⚠️ PayPal credentials missing - PayPal features will be limited",
    );
    return { ordersController: null, paymentsController: null };
  }

  try {
    paypalClient = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      environment:
        mode === "live" ? Environment.Production : Environment.Sandbox,
      logging: {
        logLevel: "Info",
        logRequest: true,
        logResponse: true,
      },
    });

    ordersController = new OrdersController(paypalClient);
    paymentsController = new PaymentsController(paypalClient);

    logger.info(`✅ PayPal SDK initialized in ${mode} mode`);
    return { ordersController, paymentsController };
  } catch (error) {
    logger.error("❌ Failed to initialize PayPal SDK:", error);
    return { ordersController: null, paymentsController: null };
  }
}

/**
 * Create a PayPal order
 * @param {Object} options - Order options
 * @returns {Promise<Object>} The created order
 */
export async function createPayPalOrder({
  amount,
  currency = "USD",
  description,
  customId,
}) {
  const { ordersController } = getPayPalClient();
  if (!ordersController) throw new Error("PayPal client not initialized");

  const collect = {
    body: {
      intent: "CAPTURE",
      purchaseUnits: [
        {
          amount: {
            currencyCode: currency,
            value: amount.toString(),
          },
          description: description,
          customId: customId,
        },
      ],
    },
    prefer: "return=representation",
  };

  try {
    const { result } = await ordersController.createOrder(collect);
    return result;
  } catch (error) {
    logger.error("❌ PayPal Create Order Error:", error);
    throw error;
  }
}

/**
 * Capture a PayPal payment
 * @param {string} orderId - PayPal order ID
 * @returns {Promise<Object>} The captured payment details
 */
export async function capturePayPalOrder(orderId) {
  const { ordersController } = getPayPalClient();
  if (!ordersController) throw new Error("PayPal client not initialized");

  const collect = {
    id: orderId,
    prefer: "return=representation",
  };

  try {
    const { result } = await ordersController.captureOrder(collect);
    return result;
  } catch (error) {
    logger.error(`❌ PayPal Capture Order Error (${orderId}):`, error);
    throw error;
  }
}
