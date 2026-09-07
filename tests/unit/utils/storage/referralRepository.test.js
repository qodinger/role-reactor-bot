import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

const { ReferralRepository } = await import(
  "../../../../src/utils/storage/repositories/ReferralRepository.js"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockCollection() {
  return {
    createIndex: vi.fn().mockResolvedValue(true),
    findOne: vi.fn().mockResolvedValue(null),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
}

function createMockDb(collection) {
  return { collection: vi.fn().mockReturnValue(collection) };
}

function createMockCache() {
  return { clear: vi.fn(), get: vi.fn(), set: vi.fn(), delete: vi.fn() };
}

function createMockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeReferralDoc(overrides = {}) {
  return {
    userId: "user_001",
    referralCode: "RR-ABCDEF",
    totalEarnedCores: 0,
    referrals: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ReferralRepository", () => {
  let repo;
  let collection;
  let cache;
  let logger;

  beforeEach(() => {
    vi.clearAllMocks();
    collection = createMockCollection();
    cache = createMockCache();
    logger = createMockLogger();
    const db = createMockDb(collection);
    repo = new ReferralRepository(db, cache, logger);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Constructor & Indexes
  // ───────────────────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("creates required indexes on initialization", () => {
      expect(collection.createIndex).toHaveBeenCalledWith(
        { userId: 1 },
        { unique: true }
      );
      expect(collection.createIndex).toHaveBeenCalledWith(
        { referralCode: 1 },
        { unique: true }
      );
      expect(collection.createIndex).toHaveBeenCalledWith(
        { "referrals.refereeId": 1 },
        { unique: true, sparse: true }
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getByUserId
  // ───────────────────────────────────────────────────────────────────────────

  describe("getByUserId", () => {
    it("returns the document when found", async () => {
      const doc = makeReferralDoc();
      collection.findOne.mockResolvedValue(doc);

      const result = await repo.getByUserId("user_001");

      expect(collection.findOne).toHaveBeenCalledWith({ userId: "user_001" });
      expect(result).toEqual(doc);
    });

    it("returns null when no document found", async () => {
      collection.findOne.mockResolvedValue(null);
      const result = await repo.getByUserId("nonexistent_user");
      expect(result).toBeNull();
    });

    it("returns null and logs error on DB failure", async () => {
      collection.findOne.mockRejectedValue(new Error("DB crash"));
      const result = await repo.getByUserId("user_001");
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getByCode
  // ───────────────────────────────────────────────────────────────────────────

  describe("getByCode", () => {
    it("finds document by code, normalizing to uppercase", async () => {
      const doc = makeReferralDoc({ referralCode: "RR-ABCDEF" });
      collection.findOne.mockResolvedValue(doc);

      const result = await repo.getByCode("rr-abcdef");

      expect(collection.findOne).toHaveBeenCalledWith({ referralCode: "RR-ABCDEF" });
      expect(result).toEqual(doc);
    });

    it("returns null when code not found", async () => {
      collection.findOne.mockResolvedValue(null);
      const result = await repo.getByCode("RR-XXXXXX");
      expect(result).toBeNull();
    });

    it("returns null and logs error on DB failure", async () => {
      collection.findOne.mockRejectedValue(new Error("DB crash"));
      const result = await repo.getByCode("RR-ABCDEF");
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getOrCreateCode
  // ───────────────────────────────────────────────────────────────────────────

  describe("getOrCreateCode", () => {
    it("returns existing doc immediately when referralCode already exists", async () => {
      const existingDoc = makeReferralDoc();
      collection.findOne.mockResolvedValue(existingDoc);

      const result = await repo.getOrCreateCode("user_001");

      expect(collection.findOne).toHaveBeenCalledTimes(1);
      expect(collection.updateOne).not.toHaveBeenCalled();
      expect(result).toEqual(existingDoc);
    });

    it("creates a new doc with a generated RR-XXXXXX code for a brand-new user", async () => {
      const newDoc = makeReferralDoc({ referralCode: "RR-YZ9FMF" });
      collection.findOne
        .mockResolvedValueOnce(null)    // getByUserId: new user
        .mockResolvedValueOnce(null)    // getByCode: no collision
        .mockResolvedValueOnce(newDoc); // post-upsert fetch

      const result = await repo.getOrCreateCode("user_001");

      expect(collection.updateOne).toHaveBeenCalledWith(
        { userId: "user_001" },
        { $setOnInsert: expect.objectContaining({ userId: "user_001" }) },
        { upsert: true }
      );
      expect(result.referralCode).toMatch(/^RR-[A-Z0-9]{6}$/);
    });

    it("patches an existing doc that is missing referralCode (migration case)", async () => {
      const legacyDoc = { userId: "user_legacy", referrals: [] };
      const patchedDoc = makeReferralDoc({ userId: "user_legacy", referralCode: "RR-NEWCOD" });

      collection.findOne
        .mockResolvedValueOnce(legacyDoc)  // getByUserId: doc exists, no code
        .mockResolvedValueOnce(null)       // getByCode: no collision
        .mockResolvedValueOnce(patchedDoc); // post-patch fetch

      const result = await repo.getOrCreateCode("user_legacy");

      expect(collection.updateOne).toHaveBeenCalledWith(
        { userId: "user_legacy" },
        {
          $set: expect.objectContaining({
            referralCode: expect.stringMatching(/^RR-[A-Z0-9]{6}$/),
            updatedAt: expect.any(String),
          }),
        }
      );
      expect(result.referralCode).toBe("RR-NEWCOD");
    });

    it("retries code generation on collision and uses a unique code", async () => {
      const collisionDoc = makeReferralDoc({ referralCode: "RR-COLLIDE" });
      const finalDoc = makeReferralDoc({ referralCode: "RR-UNIQUE1" });

      collection.findOne
        .mockResolvedValueOnce(null)         // getByUserId: new user
        .mockResolvedValueOnce(collisionDoc) // getByCode: 1st attempt collision
        .mockResolvedValueOnce(null)         // getByCode: 2nd attempt unique
        .mockResolvedValueOnce(finalDoc);    // post-upsert fetch

      const result = await repo.getOrCreateCode("user_new");

      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(result.referralCode).toBe("RR-UNIQUE1");
    });

    it("returns null and logs error on DB failure", async () => {
      collection.findOne.mockRejectedValue(new Error("DB crash"));
      const result = await repo.getOrCreateCode("user_001");
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // claimCode
  // ───────────────────────────────────────────────────────────────────────────

  describe("claimCode", () => {
    it("successfully claims a valid referral code", async () => {
      const referrerDoc = makeReferralDoc({ userId: "referrer_001", referralCode: "RR-ABCDEF" });

      collection.findOne
        .mockResolvedValueOnce(null)        // findByRefereeId: not claimed
        .mockResolvedValueOnce(referrerDoc); // getByCode: found

      const result = await repo.claimCode("referee_002", "RR-ABCDEF");

      expect(result.success).toBe(true);
      expect(result.referrerUserId).toBe("referrer_001");
      expect(result.message).toContain("Referral code applied");
      expect(collection.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "referrer_001",
          "referrals.refereeId": { $ne: "referee_002" },
        }),
        expect.objectContaining({
          $push: { referrals: expect.objectContaining({ refereeId: "referee_002", status: "pending" }) },
        })
      );
    });

    it("normalizes code to uppercase before lookup", async () => {
      const referrerDoc = makeReferralDoc({ userId: "referrer_001", referralCode: "RR-ABCDEF" });
      collection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(referrerDoc);

      await repo.claimCode("referee_002", "rr-abcdef");

      expect(collection.findOne).toHaveBeenCalledWith({ referralCode: "RR-ABCDEF" });
    });

    it("blocks self-referral", async () => {
      const selfDoc = makeReferralDoc({ userId: "user_001", referralCode: "RR-ABCDEF" });
      collection.findOne
        .mockResolvedValueOnce(null)     // findByRefereeId: hasn't claimed
        .mockResolvedValueOnce(selfDoc); // getByCode: own doc

      const result = await repo.claimCode("user_001", "RR-ABCDEF");

      expect(result.success).toBe(false);
      expect(result.error).toContain("cannot refer yourself");
    });

    it("blocks duplicate claim when referee has already used a code", async () => {
      const existingClaim = makeReferralDoc({ userId: "referrer_001" });
      collection.findOne.mockResolvedValueOnce(existingClaim); // already claimed

      const result = await repo.claimCode("referee_002", "RR-ABCDEF");

      expect(result.success).toBe(false);
      expect(result.error).toContain("already used a referral code");
      expect(collection.updateOne).not.toHaveBeenCalled();
    });

    it("fails when referral code does not exist", async () => {
      collection.findOne
        .mockResolvedValueOnce(null)  // findByRefereeId: not claimed
        .mockResolvedValueOnce(null); // getByCode: not found

      const result = await repo.claimCode("referee_002", "RR-INVALID");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid referral code");
    });

    it("returns error and logs on DB failure", async () => {
      collection.findOne.mockRejectedValue(new Error("DB crash"));
      const result = await repo.claimCode("referee_002", "RR-ABCDEF");
      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // findByRefereeId
  // ───────────────────────────────────────────────────────────────────────────

  describe("findByRefereeId", () => {
    it("finds the referrer doc containing the referee", async () => {
      const doc = makeReferralDoc({
        referrals: [{ refereeId: "referee_002", status: "pending" }],
      });
      collection.findOne.mockResolvedValue(doc);

      const result = await repo.findByRefereeId("referee_002");

      expect(collection.findOne).toHaveBeenCalledWith({ "referrals.refereeId": "referee_002" });
      expect(result).toEqual(doc);
    });

    it("returns null when referee has no referrer", async () => {
      collection.findOne.mockResolvedValue(null);
      const result = await repo.findByRefereeId("unlinked_user");
      expect(result).toBeNull();
    });

    it("returns null and logs error on DB failure", async () => {
      collection.findOne.mockRejectedValue(new Error("DB crash"));
      const result = await repo.findByRefereeId("referee_002");
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // processPurchaseBonus
  // ───────────────────────────────────────────────────────────────────────────

  describe("processPurchaseBonus", () => {
    let coreCreditsRepo;
    let paymentRepo;

    beforeEach(() => {
      coreCreditsRepo = { updateCredits: vi.fn().mockResolvedValue(true) };
      paymentRepo = { create: vi.fn().mockResolvedValue(true) };
    });

    it("skips purchases below $10 minimum", async () => {
      const result = await repo.processPurchaseBonus({
        refereeId: "referee_002",
        purchaseAmount: 5,
        coresGranted: 75,
        coreCreditsRepo,
      });

      expect(result.processed).toBe(false);
      expect(result.reason).toContain("below minimum");
      expect(coreCreditsRepo.updateCredits).not.toHaveBeenCalled();
    });

    it("skips when referee has no linked referrer", async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.processPurchaseBonus({
        refereeId: "unlinked_user",
        purchaseAmount: 20,
        coresGranted: 300,
        coreCreditsRepo,
      });

      expect(result.processed).toBe(false);
      expect(result.reason).toContain("no linked referrer");
    });

    it("grants 15% referrer bonus + 10% referee welcome bonus on first purchase", async () => {
      const referrerDoc = makeReferralDoc({
        userId: "referrer_001",
        referrals: [{
          refereeId: "referee_002",
          status: "pending",
          totalPurchased: 0,
          referrerBonusEarned: 0,
          refereeBonusEarned: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        }],
      });
      collection.findOne.mockResolvedValue(referrerDoc);

      const result = await repo.processPurchaseBonus({
        refereeId: "referee_002",
        purchaseAmount: 10,
        coresGranted: 100,
        coreCreditsRepo,
        paymentRepo,
      });

      expect(result.processed).toBe(true);
      expect(result.isFirstPurchase).toBe(true);
      expect(result.referrerBonusCores).toBe(15);
      expect(result.refereeBonusCores).toBe(10);
      expect(coreCreditsRepo.updateCredits).toHaveBeenCalledWith("referrer_001", 15);
      expect(coreCreditsRepo.updateCredits).toHaveBeenCalledWith("referee_002", 10);
      expect(paymentRepo.create).toHaveBeenCalledTimes(2);
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discordId: "referrer_001",
          type: "referrer_bonus",
          coresGranted: 15,
        }),
      );
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discordId: "referee_002",
          type: "referee_welcome_bonus",
          coresGranted: 10,
        }),
      );
    });

    it("grants 15% referrer bonus only on repeat purchases (no referee welcome bonus)", async () => {
      const referrerDoc = makeReferralDoc({
        userId: "referrer_001",
        referrals: [{
          refereeId: "referee_002",
          status: "qualified",
          totalPurchased: 15,
          referrerBonusEarned: 2.25,
          refereeBonusEarned: 1.5,
          createdAt: "2026-01-01T00:00:00.000Z",
        }],
      });
      collection.findOne.mockResolvedValue(referrerDoc);

      const result = await repo.processPurchaseBonus({
        refereeId: "referee_002",
        purchaseAmount: 20,
        coresGranted: 200,
        coreCreditsRepo,
        paymentRepo,
      });

      expect(result.processed).toBe(true);
      expect(result.isFirstPurchase).toBe(false);
      expect(result.referrerBonusCores).toBe(30);
      expect(result.refereeBonusCores).toBe(0);
      expect(coreCreditsRepo.updateCredits).toHaveBeenCalledWith("referrer_001", 30);
      expect(coreCreditsRepo.updateCredits).not.toHaveBeenCalledWith("referee_002", expect.any(Number));
    });

    it("correctly updates referral document totals and marks status as qualified", async () => {
      const referrerDoc = makeReferralDoc({
        userId: "referrer_001",
        referrals: [{
          refereeId: "referee_002",
          status: "pending",
          totalPurchased: 0,
          referrerBonusEarned: 0,
          refereeBonusEarned: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        }],
      });
      collection.findOne.mockResolvedValue(referrerDoc);

      await repo.processPurchaseBonus({
        refereeId: "referee_002",
        purchaseAmount: 10,
        coresGranted: 100,
        coreCreditsRepo,
      });

      const updateCall = collection.updateOne.mock.calls[0];
      const setData = updateCall[1].$set;

      expect(setData["referrals.0.status"]).toBe("qualified");
      expect(setData["referrals.0.totalPurchased"]).toBe(10);
      expect(setData["referrals.0.referrerBonusEarned"]).toBe(15);
      expect(setData["referrals.0.qualifiedAt"]).toBeDefined();
      expect(updateCall[1].$inc.totalEarnedCores).toBe(15);
    });

    it("returns error and logs on DB failure during document update", async () => {
      // findByRefereeId catches internal errors and returns null.
      // To test processPurchaseBonus's own catch block, we need the lookup
      // to succeed but the updateOne to fail.
      const referrerDoc = makeReferralDoc({
        userId: "referrer_001",
        referrals: [{
          refereeId: "referee_002",
          status: "pending",
          totalPurchased: 0,
          referrerBonusEarned: 0,
          refereeBonusEarned: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        }],
      });
      collection.findOne.mockResolvedValue(referrerDoc);
      collection.updateOne.mockRejectedValue(new Error("DB write crash"));

      const result = await repo.processPurchaseBonus({
        refereeId: "referee_002",
        purchaseAmount: 20,
        coresGranted: 200,
        coreCreditsRepo,
      });

      expect(result.processed).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });


    it("logs REFERRAL_BONUS_PROCESSED on success", async () => {
      const referrerDoc = makeReferralDoc({
        userId: "referrer_001",
        referrals: [{
          refereeId: "referee_002",
          status: "pending",
          totalPurchased: 0,
          referrerBonusEarned: 0,
          refereeBonusEarned: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        }],
      });
      collection.findOne.mockResolvedValue(referrerDoc);

      await repo.processPurchaseBonus({
        refereeId: "referee_002",
        purchaseAmount: 10,
        coresGranted: 100,
        coreCreditsRepo,
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("REFERRAL_BONUS_PROCESSED")
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // End-to-End Flow Simulation
  // ───────────────────────────────────────────────────────────────────────────

  describe("end-to-end referral lifecycle", () => {
    it("simulates complete flow: generate code → claim → purchase bonus", async () => {
      const coreCreditsRepo = { updateCredits: vi.fn().mockResolvedValue(true) };
      const referrerDoc = makeReferralDoc({ userId: "referrer_001", referralCode: "RR-ABCDEF" });

      // Step 1: Referrer gets their code
      collection.findOne.mockResolvedValueOnce(referrerDoc);
      const codeDoc = await repo.getOrCreateCode("referrer_001");
      expect(codeDoc.referralCode).toBe("RR-ABCDEF");

      // Step 2: Referee claims the code
      collection.findOne
        .mockResolvedValueOnce(null)        // findByRefereeId: not claimed
        .mockResolvedValueOnce(referrerDoc); // getByCode: found
      const claimResult = await repo.claimCode("referee_002", "RR-ABCDEF");
      expect(claimResult.success).toBe(true);

      // Step 3: Referee makes a qualifying purchase
      const referrerWithReferee = makeReferralDoc({
        userId: "referrer_001",
        referralCode: "RR-ABCDEF",
        referrals: [{
          refereeId: "referee_002",
          status: "pending",
          totalPurchased: 0,
          referrerBonusEarned: 0,
          refereeBonusEarned: 0,
          createdAt: new Date().toISOString(),
        }],
      });
      collection.findOne.mockResolvedValueOnce(referrerWithReferee);

      const bonusResult = await repo.processPurchaseBonus({
        refereeId: "referee_002",
        purchaseAmount: 10,
        coresGranted: 100,
        coreCreditsRepo,
      });

      expect(bonusResult.processed).toBe(true);
      expect(bonusResult.isFirstPurchase).toBe(true);
      expect(bonusResult.referrerBonusCores).toBe(15);
      expect(bonusResult.refereeBonusCores).toBe(10);
      expect(coreCreditsRepo.updateCredits).toHaveBeenCalledTimes(2);
    });

    it("prevents self-referral in a complete flow context", async () => {
      const selfDoc = makeReferralDoc({ userId: "user_001", referralCode: "RR-SELF12" });
      collection.findOne
        .mockResolvedValueOnce(null)     // findByRefereeId: no prior claim
        .mockResolvedValueOnce(selfDoc); // getByCode: own doc

      const result = await repo.claimCode("user_001", "RR-SELF12");
      expect(result.success).toBe(false);
      expect(result.error).toContain("cannot refer yourself");
    });
  });
});
