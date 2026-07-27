import { getLogger } from "../utils/logger.js";
import { formatCoreCredits } from "../utils/ai/aiCreditManager.js";
import { config } from "../config/config.js";
import { emojiConfig } from "../config/emojis.js";

const logger = getLogger();

/**
 * Handle Buy Me a Coffee Payment Webhook
 *
 * BMAC sends:
 *   - `supporter_name` → donor's name from "Name or @yoursocial" field
 *   - `message`        → "Say something nice..." field (contains our unique code)
 *   - `amount`         → donation amount in fiat
 *   - `currency`       → currency code
 *
 * We extract the unique code from `message`, look up the Discord user,
 * and credit cores based on the amount paid.
 */
export async function handleBMACWebhook(req, res) {
  const payload = req.body.response || req.body || {};
  const amount = payload.amount || req.body.amount;
  const supporterName = payload.supporter_name || req.body.supporter_name || payload.support_name || req.body.support_name || "";
  const currency = payload.currency || req.body.currency || "USD";
  const rawMessage = payload.message || req.body.message || payload.support_note || req.body.support_note || payload.support_message || req.body.support_message || "";

  // 1. Validate amount
  const paymentAmount = parseFloat(amount);
  if (!paymentAmount || paymentAmount <= 0 || isNaN(paymentAmount)) {
    logger.warn(`⚠️ BMAC webhook: invalid amount "${amount}"`);
    return res.status(400).json({ status: "error", message: "Invalid amount" });
  }

  // Reasonable max to prevent abuse
  if (paymentAmount > 10000) {
    logger.warn(`⚠️ BMAC webhook: amount too high "$${paymentAmount}"`);
    return res
      .status(400)
      .json({ status: "error", message: "Amount too high" });
  }

  // 2. Extract and validate code from any text field
  const textToSearch = `${rawMessage} ${supporterName}`.toUpperCase();
  const codeMatch = textToSearch.match(/RR-[A-Z0-9]{6}/);
  const code = codeMatch ? codeMatch[0] : "";

  if (!code) {
    logger.debug(
      `BMAC webhook: no valid code found in payload fields: "${textToSearch.substring(0, 50)}"`
    );
    
    // Save to unclaimed payments database
    try {
      const { getDatabaseManager } = await import(
        "../utils/storage/databaseManager.js"
      );
      const dbManager = await getDatabaseManager();
      if (dbManager?.connectionManager?.db) {
        const db = dbManager.connectionManager.db;
        await db.collection("unclaimed_payments").insertOne({
          provider: "buymeacoffee",
          amount: paymentAmount,
          currency: currency || "USD",
          supporterName: supporterName || "Anonymous",
          rawMessage,
          timestamp: new Date(),
          payload: req.body,
          status: "unclaimed"
        });
        logger.info(`💾 Saved unclaimed BMAC payment of $${paymentAmount} from ${supporterName || "Anonymous"}`);
      }
    } catch (e) {
      logger.error("Failed to save unclaimed payment:", e);
    }

    return res
      .status(200)
      .json({ status: "ignored_but_saved", message: "No valid code, saved to unclaimed_payments" });
  }

  // 3. Look up code in pending_codes collection
  const { getDatabaseManager } = await import(
    "../utils/storage/databaseManager.js"
  );
  const { getStorageManager } = await import(
    "../utils/storage/storageManager.js"
  );
  const dbManager = await getDatabaseManager();
  const storage = await getStorageManager();
  if (!dbManager?.connectionManager?.db) {
    logger.error("❌ BMAC webhook: database not available");
    return res
      .status(500)
      .json({ status: "error", message: "Database not available" });
  }
  const db = dbManager.connectionManager.db;
  const pendingCodes = db.collection("pending_codes");

  let codeRecord;
  try {
    codeRecord = await pendingCodes.findOne({ code });
  } catch (dbError) {
    logger.error(
      `❌ BMAC webhook: database error looking up code "${code}":`,
      dbError,
    );
    return res.status(500).json({ status: "error", message: "Database error" });
  }

  if (!codeRecord) {
    logger.warn(`⚠️ BMAC webhook: code not found "${code}"`);
    return res.status(200).json({ status: "not_found" });
  }

  // 4. Check expiration
  if (new Date(codeRecord.expiresAt) < new Date()) {
    logger.warn(
      `⚠️ BMAC webhook: code expired "${code}" (expired at ${codeRecord.expiresAt})`,
    );
    return res.status(200).json({ status: "expired" });
  }

  // 5. Check if already used
  if (codeRecord.used) {
    logger.info(
      `🔄 BMAC webhook: code already used "${code}" for user ${codeRecord.discordId}`,
    );
    return res.status(200).json({ status: "already_processed" });
  }

  const userId = codeRecord.discordId;

  // 6. Verify username matches (secondary check - log only, don't block)
  try {
    const user = await storage.getUserByDiscordId(userId);
    if (user?.username && supporterName) {
      const normalize = s => (s || "").trim().toLowerCase();
      if (normalize(supporterName) !== normalize(user.username)) {
        logger.warn(
          `⚠️ BMAC username mismatch: expected "${user.username}", got "${supporterName}" for code ${code}`,
        );
      }
    }
  } catch (_e) {
    // Non-critical - username check is informational only
  }

  // 7. Process payment with credit lock (atomic operation)
  try {
    const { withCreditLock } = await import("../utils/ai/aiCreditManager.js");

    const result = await withCreditLock(userId, async () => {
      const existingData = await storage.getCoreCredits(userId);
      const userData = existingData || {
        credits: 0,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
      };

      // Calculate cores based on fiat amount
      const coresToAdd =
        typeof config.calculateCores === "function"
          ? config.calculateCores(paymentAmount)
          : Math.floor(
              paymentAmount *
                (config.corePricing?.coreSystem?.conversionRate || 15),
            );

      // Update balance and historical total
      userData.credits = formatCoreCredits(
        (userData.credits || 0) + coresToAdd,
      );
      userData.totalGenerated = (userData.totalGenerated || 0) + coresToAdd;

      // Track BMAC-specific payment metadata
      if (!userData.bmacPayments) userData.bmacPayments = [];
      userData.bmacPayments.push({
        code,
        type: "payment",
        fiatAmount: paymentAmount,
        currency: currency || "USD",
        cores: coresToAdd,
        provider: "buymeacoffee",
        supporterName,
        timestamp: new Date().toISOString(),
        processed: true,
      });

      userData.lastUpdated = new Date().toISOString();
      await storage.setCoreCredits(userId, userData);

      return { coresToAdd, newBalance: userData.credits };
    });

    // 8. Mark code as used
    try {
      await pendingCodes.updateOne(
        { code },
        {
          $set: {
            used: true,
            usedAt: new Date(),
            paymentData: {
              amount: paymentAmount,
              currency: currency || "USD",
              supporterName,
            },
          },
        },
      );
    } catch (markError) {
      logger.error(
        `❌ BMAC webhook: failed to mark code as used "${code}":`,
        markError,
      );
      // Non-critical - cores were already added
    }

    // 9. Store payment record in payments collection (audit trail)
    try {
      const paymentId = `bmac_${code}_${Date.now()}`;
      await storage.completePayment({
        paymentId,
        discordId: userId,
        provider: "buymeacoffee",
        type: "one_time",
        status: "completed",
        amount: paymentAmount,
        currency: currency || "USD",
        coresGranted: result.coresToAdd,
        supporterName,
        metadata: {
          code,
          supporterName,
          raw_amount: amount,
        },
      });
      logger.debug(
        `📝 BMAC payment ${paymentId} logged to payments collection`,
      );
    } catch (logError) {
      logger.error(
        `Failed to log BMAC payment to payments collection:`,
        logError,
      );
    }

    // 10. Create in-app notification
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
          message: `+${result.coresToAdd} Cores from your $${paymentAmount} Buy Me a Coffee donation`,
          icon: "core",
          metadata: {
            coresGranted: result.coresToAdd,
            fiatAmount: paymentAmount,
            provider: "buymeacoffee",
          },
        });
      }
    } catch (_e) {
      /* non-critical */
    }

    // 11. Send Discord DM notification
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
                  title: `${emojiConfig.customEmojis.core} Cores Added!`,
                  description: `You received **${result.coresToAdd} Cores** from your **$${paymentAmount} Buy Me a Coffee** donation.`,
                  color: 0x00d26a,
                  fields: [
                    {
                      name: "Donated by",
                      value: supporterName || "Anonymous",
                      inline: true,
                    },
                    {
                      name: "New Balance",
                      value: `${result.newBalance} ${emojiConfig.customEmojis.core}`,
                      inline: true,
                    },
                  ],
                  timestamp: new Date().toISOString(),
                },
              ],
            })
            .catch(() => null);
          logger.info(`📬 Sent DM notification to ${userId} for BMAC payment`);
        }
      }
    } catch (_e) {
      /* non-critical — DM may fail if user has DMs disabled */
    }

    logger.info(
      `✅ BMAC payment processed: ${code} → user ${userId}, +${result.coresToAdd} cores ($${paymentAmount} ${currency || "USD"})`,
    );
    return res.status(200).json({ success: true, message: "Credited" });
  } catch (error) {
    logger.error(`❌ BMAC webhook failed for code ${code}:`, error);
    return res.status(500).json({ status: "error", error: error.message });
  }
}
