import { getLogger } from "../../utils/logger.js";
import { config } from "../../config/config.js";

const logger = getLogger();

/**
 * Generate a unique BMAC code in format RR-XXXXXX
 * Characters: A-Z, 0-9 (6 characters after RR- prefix)
 */
function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "RR-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * API: Generate Buy Me a Coffee unique code
 *
 * Creates a unique code linking the Discord user to a BMAC donation.
 * The code is stored in pending_codes collection with 24h expiration.
 * Users can only have 1 active (unused) code at a time.
 *
 * POST /api/v1/payments/buymeacoffee/generate-code
 * Requires: internalAuth middleware (website verifies user session)
 */
export async function apiGenerateBMACCode(req, res) {
  try {
    // Extract user ID from internal auth or session
    const userId = req.user?.id || req.session?.discordUser?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { getDatabaseManager } = await import("../../utils/storage/databaseManager.js");
    const dbManager = await getDatabaseManager();
    if (!dbManager?.connectionManager?.db) {
      return res.status(500).json({
        success: false,
        message: "Database not available",
      });
    }
    const db = dbManager.connectionManager.db;
    const pendingCodes = db.collection("pending_codes");

    // Check for existing unused, non-expired code
    const existing = await pendingCodes.findOne({
      discordId: userId,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (existing) {
      logger.info(`🔑 BMAC code already exists for user ${userId}: ${existing.code}`);
      return res.status(200).json({
        success: true,
        data: {
          code: existing.code,
          expiresAt: existing.expiresAt,
          buyMeACoffeeUrl: config.payments?.buymeacoffeeUrl || "https://buymeacoffee.com/rolereactor",
        },
      });
    }

    // Generate new unique code (retry on collision, max 5 attempts)
    let code;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      code = generateCode();
      const existingCode = await pendingCodes.findOne({ code });
      if (!existingCode) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      logger.error(`❌ BMAC code generation failed after ${maxAttempts} attempts for user ${userId}`);
      return res.status(500).json({
        success: false,
        message: "Failed to generate unique code",
      });
    }

    // Store the code
    const codeDocument = {
      code,
      discordId: userId,
      createdAt: new Date(),
      used: false,
      usedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      paymentData: null,
    };

    await pendingCodes.insertOne(codeDocument);

    logger.info(`🔑 BMAC code generated: ${code} for user ${userId}`);

    return res.status(201).json({
      success: true,
      data: {
        code,
        expiresAt: codeDocument.expiresAt,
        buyMeACoffeeUrl: config.payments?.buymeacoffeeUrl || "https://buymeacoffee.com/rolereactor",
      },
    });
  } catch (error) {
    logger.error("❌ Failed to generate BMAC code:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate code",
    });
  }
}
