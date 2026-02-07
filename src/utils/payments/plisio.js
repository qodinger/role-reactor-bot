import axios from "axios";
import crypto from "crypto";
import { getLogger } from "../logger.js";
import { config } from "../../config/config.js";

const logger = getLogger();

/**
 * Plisio Payment Utility Class
 * Handles invoice creation and webhook verification
 */
export class PlisioPay {
  constructor() {
    this.secretKey = config.payments.plisio.secretKey;
    this.baseUrl = "https://api.plisio.net/api/v1";
  }

  /**
   * Creates a payment invoice
   * @param {Object} orderDetails
   * @param {number} orderDetails.amount - Fiat amount
   * @param {string} orderDetails.currency - Fiat currency (USD, EUR, etc.)
   * @param {string} orderDetails.orderNumber - Unique order ID
   * @param {string} orderDetails.orderName - Description of the order
   * @param {string} orderDetails.email - Customer email (optional)
   * @param {string} orderDetails.callbackUrl - Webhook URL
   * @returns {Promise<string>} The invoice URL to redirect the user to
   */
  async createInvoice({
    amount,
    currency,
    cryptoCurrency,
    orderNumber,
    orderName,
    email,
    callbackUrl,
  }) {
    if (!this.secretKey) {
      throw new Error("PLISIO_SECRET_KEY is not configured");
    }

    const endpoint = "/invoices/new";
    const url = `${this.baseUrl}${endpoint}`;

    const params = {
      api_key: this.secretKey,
      order_number: orderNumber,
      order_name: orderName,
      source_currency: currency,
      source_amount: amount.toString(),
      callback_url: callbackUrl,
    };

    if (cryptoCurrency) {
      params.currency = cryptoCurrency;
      params.allowed_psys_cids = cryptoCurrency;
    }

    if (email) {
      params.email = email;
    }

    // Merchant pays the network fee (better UX for customer)
    // params.pay_fee = 1;

    try {
      const response = await axios.get(url, { params });

      if (response.data && response.data.status === "success") {
        return response.data.data.invoice_url;
      } else {
        const errorMsg =
          response.data?.data?.message ||
          JSON.stringify(response.data) ||
          "Unknown Plisio error";
        throw new Error(`Plisio API Error: ${errorMsg}`);
      }
    } catch (error) {
      logger.error(
        "Plisio Create Invoice Error:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Verifies the Plisio Webhook Signature
   * @param {Object} body - The raw parsed JSON body of the POST request
   * @returns {boolean} True if signature is valid
   */
  verifyWebhook(body) {
    if (!this.secretKey) return false;
    if (!body || !body.verify_hash) return false;

    const receivedHash = body.verify_hash;

    // 1. Create a clean copy and remove verify_hash
    const payload = { ...body };
    delete payload.verify_hash;

    // 2. Sort keys alphabetically (Plisio requirement for deterministic hashing)
    const sortedKeys = Object.keys(payload).sort();
    const sortedData = {};
    for (const key of sortedKeys) {
      sortedData[key] = payload[key];
    }

    // 3. Stringify the sorted object
    // JSON.stringify in Node.js defaults to compact (no spaces) which matches Plisio's json=true expectations
    const dataString = JSON.stringify(sortedData);

    // 4. HMAC-SHA1 calculation
    const calculatedHash = crypto
      .createHmac("sha1", this.secretKey)
      .update(dataString)
      .digest("hex");

    return calculatedHash === receivedHash;
  }
}

export const plisioPay = new PlisioPay();
