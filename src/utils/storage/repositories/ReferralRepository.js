import { BaseRepository } from "./BaseRepository.js";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RR-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class ReferralRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "referrals", cache, logger);
    this._ensureIndexes();
  }

  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ userId: 1 }, { unique: true });
      await this.collection.createIndex({ referralCode: 1 }, { unique: true });
      await this.collection.createIndex({ "referrals.refereeId": 1 }, { unique: true, sparse: true });
      this.logger.debug("ReferralRepository indexes ensured");
    } catch (error) {
      this.logger.warn("Failed to ensure ReferralRepository indexes", error);
    }
  }

  async getByUserId(userId) {
    try {
      const doc = await this.collection.findOne({ userId });
      return doc;
    } catch (error) {
      this.logger.error(`Failed to get referral for user ${userId}`, error);
      return null;
    }
  }

  async getByCode(referralCode) {
    try {
      const code = referralCode.trim().toUpperCase();
      const doc = await this.collection.findOne({ referralCode: code });
      return doc;
    } catch (error) {
      this.logger.error(`Failed to get referral by code ${referralCode}`, error);
      return null;
    }
  }

  async getOrCreateCode(userId) {
    try {
      let doc = await this.getByUserId(userId);

      // Doc exists and already has a code — return immediately
      if (doc && doc.referralCode) {
        return doc;
      }

      // Generate a unique code
      let attempts = 0;
      let newCode = generateCode();
      while (attempts < 10) {
        const existing = await this.getByCode(newCode);
        if (!existing) break;
        newCode = generateCode();
        attempts++;
      }

      if (doc) {
        // Doc exists but has no referralCode — patch it in place
        await this.collection.updateOne(
          { userId },
          { $set: { referralCode: newCode, updatedAt: new Date().toISOString() } }
        );
      } else {
        // Brand new user — create the full document
        const newDoc = {
          userId,
          referralCode: newCode,
          totalEarnedCores: 0,
          referrals: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await this.collection.updateOne(
          { userId },
          { $setOnInsert: newDoc },
          { upsert: true }
        );
      }

      doc = await this.getByUserId(userId);
      return doc;
    } catch (error) {
      this.logger.error(`Failed to getOrCreateCode for user ${userId}`, error);
      return null;
    }
  }

  async findByRefereeId(refereeId) {
    try {
      const doc = await this.collection.findOne({
        "referrals.refereeId": refereeId,
      });
      return doc;
    } catch (error) {
      this.logger.error(`Failed to find referral by refereeId ${refereeId}`, error);
      return null;
    }
  }

  async claimCode(refereeId, referralCode, coreCreditsRepo = null) {
    try {
      const code = referralCode.trim().toUpperCase();

      // Validate code format before any DB work
      if (!/^RR-[A-Z0-9]{6}$/.test(code)) {
        return { success: false, error: "Invalid referral code format." };
      }

      // Check if referee has already claimed a referrer
      const existingClaim = await this.findByRefereeId(refereeId);
      if (existingClaim) {
        return {
          success: false,
          error: "You have already used a referral code.",
        };
      }

      // Find referrer
      const referrerDoc = await this.getByCode(code);
      if (!referrerDoc) {
        return { success: false, error: "Invalid referral code." };
      }

      if (referrerDoc.userId === refereeId) {
        return { success: false, error: "You cannot refer yourself." };
      }

      const newRefereeEntry = {
        refereeId,
        status: "pending",
        totalPurchased: 0,
        referrerBonusEarned: 0,
        refereeBonusEarned: 0,
        createdAt: new Date().toISOString(),
      };

      // Atomic push: filter rejects if refereeId is already in this referrer's list
      // (guards against concurrent requests to the same referrer doc)
      const result = await this.collection.updateOne(
        {
          userId: referrerDoc.userId,
          "referrals.refereeId": { $ne: refereeId },
        },
        {
          $push: { referrals: newRefereeEntry },
          $set: { updatedAt: new Date().toISOString() },
        }
      );

      if (result.matchedCount === 0) {
        // Document was matched by another concurrent request first
        return { success: false, error: "You have already used a referral code." };
      }

      // Grant instant 25 Sparks welcome gift to referee
      if (coreCreditsRepo && typeof coreCreditsRepo.updateSparks === "function") {
        try {
          await coreCreditsRepo.updateSparks(refereeId, 25);
        } catch (err) {
          this.logger.error(`Failed to grant welcome sparks to referee ${refereeId}`, err);
        }
      }

      return {
        success: true,
        message: "Referral code applied! You received +25 Sparks ⚡ welcome bonus. Complete a purchase of $10+ for +10% bonus Cores!",
        referrerUserId: referrerDoc.userId,
      };
    } catch (error) {
      this.logger.error(`Failed to claim referral code ${referralCode} for referee ${refereeId}`, error);
      return { success: false, error: "Internal server error." };
    }
  }


  async processPurchaseBonus({ refereeId, paymentId, purchaseAmount, coresGranted, coreCreditsRepo, paymentRepo }) {
    try {
      const MINIMUM_PURCHASE = 10; // $10 minimum
      if (purchaseAmount < MINIMUM_PURCHASE) {
        return { processed: false, reason: "Purchase below minimum threshold of $10" };
      }

      const referrerDoc = await this.findByRefereeId(refereeId);
      if (!referrerDoc) {
        return { processed: false, reason: "User has no linked referrer" };
      }

      const refereeEntryIndex = referrerDoc.referrals.findIndex(
        (r) => r.refereeId === refereeId
      );
      if (refereeEntryIndex === -1) {
        return { processed: false, reason: "Referee record not found" };
      }

      const refereeEntry = referrerDoc.referrals[refereeEntryIndex];

      // Idempotency check: verify paymentId hasn't already been processed for this referral
      if (paymentId && Array.isArray(refereeEntry.processedPayments) && refereeEntry.processedPayments.includes(paymentId)) {
        return { processed: false, reason: "Payment bonus already processed" };
      }

      const isFirstPurchase = refereeEntry.status === "pending";

      // Calculate bonuses
      const REFERRER_RATE = 0.15; // 15% ongoing
      const REFEREE_RATE = 0.10;  // 10% welcome bonus (1st purchase only)

      const referrerBonusCores = Math.round(coresGranted * REFERRER_RATE * 100) / 100;
      let refereeBonusCores = 0;
      if (isFirstPurchase) {
        refereeBonusCores = Math.round(coresGranted * REFEREE_RATE * 100) / 100;
      }

      // Grant Cores to Referrer
      if (referrerBonusCores > 0 && coreCreditsRepo) {
        await coreCreditsRepo.updateCredits(referrerDoc.userId, referrerBonusCores);
        if (paymentRepo) {
          await paymentRepo.createPayment({
            userId: referrerDoc.userId,
            paymentId: `ref_bonus_${Date.now()}_${referrerDoc.userId}`,
            provider: "referral_bonus",
            type: "referrer_bonus",
            amount: 0,
            coresGranted: referrerBonusCores,
            status: "completed",
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Grant Cores to Referee (if first purchase)
      if (isFirstPurchase && refereeBonusCores > 0 && coreCreditsRepo) {
        await coreCreditsRepo.updateCredits(refereeId, refereeBonusCores);
        if (paymentRepo) {
          await paymentRepo.createPayment({
            userId: refereeId,
            paymentId: `ref_welcome_${Date.now()}_${refereeId}`,
            provider: "referral_bonus",
            type: "referee_welcome_bonus",
            amount: 0,
            coresGranted: refereeBonusCores,
            status: "completed",
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Update Referral Document
      const now = new Date().toISOString();
      const updatedTotalPurchased = (refereeEntry.totalPurchased || 0) + purchaseAmount;
      const updatedReferrerBonus = (refereeEntry.referrerBonusEarned || 0) + referrerBonusCores;
      const updatedRefereeBonus = (refereeEntry.refereeBonusEarned || 0) + refereeBonusCores;

      const updateFields = {
        [`referrals.${refereeEntryIndex}.totalPurchased`]: updatedTotalPurchased,
        [`referrals.${refereeEntryIndex}.referrerBonusEarned`]: updatedReferrerBonus,
        [`referrals.${refereeEntryIndex}.refereeBonusEarned`]: updatedRefereeBonus,
        [`referrals.${refereeEntryIndex}.status`]: "qualified",
        [`referrals.${refereeEntryIndex}.lastPurchaseAt`]: now,
        updatedAt: now,
      };

      if (isFirstPurchase) {
        updateFields[`referrals.${refereeEntryIndex}.qualifiedAt`] = now;
      }

      const updateOps = {
        $set: updateFields,
        $inc: { totalEarnedCores: referrerBonusCores },
      };

      if (paymentId) {
        updateOps.$addToSet = {
          [`referrals.${refereeEntryIndex}.processedPayments`]: paymentId,
        };
      }

      await this.collection.updateOne(
        { userId: referrerDoc.userId },
        updateOps
      );

      this.logger.info(
        `REFERRAL_BONUS_PROCESSED: Referrer ${referrerDoc.userId} earned +${referrerBonusCores} Cores, Referee ${refereeId} earned +${refereeBonusCores} Cores for $${purchaseAmount} purchase.`
      );

      return {
        processed: true,
        referrerUserId: referrerDoc.userId,
        referrerBonusCores,
        refereeBonusCores,
        isFirstPurchase,
      };
    } catch (error) {
      this.logger.error(`Error processing referral bonus for referee ${refereeId}:`, error);
      return { processed: false, error: error.message };
    }
  }
}
