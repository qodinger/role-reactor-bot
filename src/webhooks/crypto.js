import { getStorageManager } from "../utils/storage/storageManager.js";
import { getLogger } from "../utils/logger.js";
import { formatCoreCredits } from "../utils/ai/aiCreditManager.js";
import { plisioPay } from "../utils/payments/plisio.js";

const logger = getLogger();

/**
 * Handle Crypto Payment Webhook (Plisio)
 *
 * Plisio sends two amount fields:
 *   - `amount`        → crypto amount (e.g. 0.00001511 BTC)
 *   - `source_amount` → fiat amount   (e.g. 1.00 USD)
 *
 * We use `source_amount` (fiat) for Core calculations, and store
 * both values in every payment record for full audit trail.
 */
export async function handleCryptoWebhook(req, res) {
  const {
    order_number: paymentId,
    status,
    amount: cryptoAmount,
    source_amount: sourceAmount,
    currency,
    source_currency: sourceCurrency,
    email,
    metadata,
  } = req.body;

  // 1. Verify Webhook Signature (SECURITY CRITICAL)
  if (!plisioPay.verifyWebhook(req.body)) {
    logger.warn(`❌ Invalid Plisio webhook signature for payment ${paymentId}`);
    return res
      .status(401)
      .json({ status: "error", message: "Invalid signature" });
  }

  // 2. Log every incoming webhook for audit purposes (regardless of status)
  logger.info(`💰 Plisio webhook received`, {
    paymentId,
    status,
    cryptoAmount,
    sourceAmount,
    currency,
    sourceCurrency,
  });

  // 3. Always store the raw payment record for auditing — even for
  //    non-completed statuses and tiny amounts
  try {
    await storePaymentRecord(req.body);
  } catch (storeErr) {
    logger.error(`❌ Failed to store payment record ${paymentId}:`, storeErr);
  }

  // 4. Filter for successful payment statuses
  if (status !== "completed" && status !== "mismatch") {
    return res.status(200).json({ status: "ignored" });
  }

  let userId = metadata?.discordId;

  // Fallback: Extract Discord ID from order_number if metadata is missing
  // (Format: USERID_TIMESTAMP)
  if (
    !userId &&
    paymentId &&
    typeof paymentId === "string" &&
    paymentId.includes("_")
  ) {
    userId = paymentId.split("_")[0];
    logger.debug(
      `🔍 Extracted user ID ${userId} from Plisio payment ID ${paymentId}`,
    );
  }

  if (!userId) {
    logger.warn(`⚠️ Crypto payment without Discord ID: ${paymentId}`);
    return res.status(200).json({ status: "no_user_linked" });
  }

  try {
    const result = await processCryptoPayment(
      userId,
      paymentId,
      cryptoAmount,
      sourceAmount,
      currency,
      sourceCurrency,
      email,
      metadata,
    );
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`❌ Failed to process crypto payment ${paymentId}:`, error);
    return res.status(500).json({ status: "error", error: error.message });
  }
}

/**
 * Store every incoming Plisio webhook payload for audit trail.
 * Non-critical — errors are logged but never block the main flow.
 */
async function storePaymentRecord(body) {
  const storage = await getStorageManager();

  const record = {
    paymentId: body.order_number,
    provider: "plisio",
    status: body.status,
    cryptoAmount: parseFloat(body.amount) || 0,
    cryptoCurrency: body.currency,
    fiatAmount: parseFloat(body.source_amount) || 0,
    fiatCurrency: body.source_currency || "USD",
    email: body.email,
    txnId: body.txn_id,
    rawPayload: body,
    receivedAt: new Date().toISOString(),
  };

  // Try to store in payments collection (best-effort)
  try {
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    if (dbManager?.payments) {
      await dbManager.payments.create(record);
      logger.debug(`📝 Raw payment record stored: ${record.paymentId}`);
    }
  } catch (_e) {
    // Fallback: store via storage manager
    await storage.createPayment(record);
    logger.debug(
      `📝 Raw payment record stored (fallback): ${record.paymentId}`,
    );
  }
}

/**
 * Atomic processing of Crypto payment
 *
 * @param {string} userId         Discord user ID
 * @param {string} paymentId      Plisio order_number
 * @param {string} cryptoAmount   Amount in cryptocurrency (e.g. "0.00001511")
 * @param {string} sourceAmount   Amount in fiat currency  (e.g. "1.00")
 * @param {string} currency       Crypto currency code     (e.g. "BTC")
 * @param {string} sourceCurrency Fiat currency code       (e.g. "USD")
 * @param {string} _email
 * @param {Object} _metadata
 */
async function processCryptoPayment(
  userId,
  paymentId,
  cryptoAmount,
  sourceAmount,
  currency,
  sourceCurrency,
  _email,
  _metadata,
) {
  // We use the same locking mechanism as AI credits to prevent races
  const { withCreditLock } = await import("../utils/ai/aiCreditManager.js");

  return withCreditLock(userId, async () => {
    const storage = await getStorageManager();
    const configModule = await import("../config/config.js").catch(() => null);
    const config =
      configModule?.config || configModule?.default || configModule || {};

    // Check for duplicate payment
    const existingData = await storage.getCoreCredits(userId);
    if (existingData?.cryptoPayments?.some(p => p.chargeId === paymentId)) {
      return { success: true, message: "Already processed" };
    }

    const userData = existingData || {
      credits: 0,
      totalGenerated: 0,
      lastUpdated: new Date().toISOString(),
    };

    // ─── Use the fiat (source) amount for Core calculation ───
    // Plisio's `source_amount` is the USD value the user actually paid.
    // Fall back to cryptoAmount only if source_amount is missing (shouldn't happen).
    const fiatAmount = parseFloat(sourceAmount) || 0;
    const cryptoAmt = parseFloat(cryptoAmount) || 0;
    const paymentAmount = fiatAmount > 0 ? fiatAmount : cryptoAmt;

    // Use centralized calculateCores method from config
    const coresToAdd =
      typeof config.calculateCores === "function"
        ? config.calculateCores(paymentAmount)
        : Math.floor(
            paymentAmount *
              (config.corePricing?.coreSystem?.conversionRate || 50),
          );

    // Update balance and historical total
    userData.credits = formatCoreCredits((userData.credits || 0) + coresToAdd);
    userData.totalGenerated = (userData.totalGenerated || 0) + coresToAdd;

    // Track the crypto specific payment metadata
    if (!userData.cryptoPayments) userData.cryptoPayments = [];
    userData.cryptoPayments.push({
      chargeId: paymentId,
      type: "payment",
      fiatAmount: paymentAmount,
      cryptoAmount: cryptoAmt,
      currency,
      sourceCurrency: sourceCurrency || "USD",
      cores: coresToAdd,
      provider: "plisio",
      timestamp: new Date().toISOString(),
      processed: true,
    });

    userData.lastUpdated = new Date().toISOString();
    await storage.setCoreCredits(userId, userData);

    // Update separate payments ledger
    try {
      await storage.createPayment({
        paymentId: paymentId,
        discordId: userId,
        provider: "plisio",
        type: "one_time",
        status: "completed",
        amount: paymentAmount,
        cryptoAmount: cryptoAmt,
        currency: currency,
        sourceCurrency: sourceCurrency || "USD",
        coresGranted: coresToAdd,
        email: _email,
        metadata: _metadata,
      });
      logger.debug(`📝 Payment ${paymentId} logged to payments collection`);
    } catch (logError) {
      logger.error(
        `Failed to log payment ${paymentId} to payments collection:`,
        logError,
      );
    }

    logger.info(
      `✅ Added ${coresToAdd} Cores to user ${userId} via Crypto ($${paymentAmount} ${sourceCurrency || "USD"} / ${cryptoAmt} ${currency})`,
    );

    // Create in-app notification
    try {
      const { getDatabaseManager } = await import(
        "../utils/storage/databaseManager.js"
      );
      const dbManager = await getDatabaseManager();
      if (dbManager?.notifications) {
        await dbManager.notifications.create({
          userId,
          type: "balance_added",
          title: "Balance Replenished!",
          message: `+${coresToAdd} Cores from your $${paymentAmount} crypto purchase`,
          icon: "core",
          metadata: {
            coresGranted: coresToAdd,
            fiatAmount: paymentAmount,
            cryptoAmount: cryptoAmt,
            currency,
            provider: "plisio",
          },
        });
      }
    } catch (_e) {
      /* non-critical */
    }

    // Send Discord DM notification to user
    try {
      const { getPremiumManager } = await import(
        "../features/premium/PremiumManager.js"
      );
      const premiumManager = getPremiumManager();
      if (premiumManager?.client) {
        const user = await premiumManager.client.users
          .fetch(userId)
          .catch(() => null);
        if (user) {
          await user
            .send({
              embeds: [
                {
                  title: "💎 Cores Added!",
                  description: `You received **${coresToAdd} Cores** from your crypto payment of **$${paymentAmount} ${sourceCurrency || "USD"}**.`,
                  color: 0x00d26a,
                  fields: [
                    {
                      name: "Crypto Amount",
                      value: `${cryptoAmt} ${currency}`,
                      inline: true,
                    },
                    {
                      name: "New Balance",
                      value: `${userData.credits} Cores`,
                      inline: true,
                    },
                  ],
                  timestamp: new Date().toISOString(),
                },
              ],
            })
            .catch(() => null);
          logger.info(
            `📬 Sent DM notification to ${userId} for crypto payment`,
          );
        }
      }
    } catch (_e) {
      /* non-critical — DM may fail if user has DMs disabled */
    }

    return { success: true, message: "Credited", credits: coresToAdd };
  });
}
