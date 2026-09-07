import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────────────────

const mockPlisioPay = {
  verifyWebhook: vi.fn().mockReturnValue(true),
};

const mockStorageManager = {
  getCoreCredits: vi.fn().mockResolvedValue(null),
  createPayment: vi.fn().mockResolvedValue(true),
  completePayment: vi.fn().mockResolvedValue(true),
};

const mockDbManager = {
  coreCredits: {
    collection: {
      findOneAndUpdate: vi.fn().mockResolvedValue({ credits: 150 }),
    },
  },
  referrals: {
    processPurchaseBonus: vi.fn(),
  },
  payments: {
    complete: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  },
  notifications: {
    create: vi.fn().mockResolvedValue({}),
  },
};

const mockConfig = {
  calculateCores: amount => Math.floor(amount * 15),
  corePricing: {
    coreSystem: { conversionRate: 15 },
  },
};

vi.mock("../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue(mockStorageManager),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("../../../src/utils/payments/plisio.js", () => ({
  plisioPay: mockPlisioPay,
}));

vi.mock("../../../src/config/emojis.js", () => ({
  emojiConfig: {
    customEmojis: { core: "💎" },
  },
}));

vi.mock("../../../src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue(mockDbManager),
}));

vi.mock("../../../src/config/config.js", () => ({
  config: mockConfig,
}));

vi.mock("../../../src/features/premium/PremiumManager.js", () => ({
  getPremiumManager: () => null,
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

const { handleCryptoWebhook } = await import("../../../src/webhooks/crypto.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

function createPlisioWebhookBody(overrides = {}) {
  return {
    order_number: "930964921116680304_1774809683267",
    status: "new",
    amount: "0.00250512",
    source_amount: "5.03",
    currency: "ETH",
    source_currency: "USD",
    email: "tyler.steamboat@me.com",
    txn_id: "0x53605f22edd7e6be03104c379503dd8166a1c93f",
    metadata: {},
    verify_hash: "valid-hash",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("handleCryptoWebhook", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = createMockRes();
    mockPlisioPay.verifyWebhook.mockReturnValue(true);
    mockStorageManager.getCoreCredits.mockResolvedValue(null);
    mockStorageManager.completePayment.mockResolvedValue(true);
    mockDbManager.payments.complete.mockResolvedValue({});
    mockDbManager.coreCredits.collection.findOneAndUpdate.mockResolvedValue({
      credits: 75,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Signature Verification
  // ─────────────────────────────────────────────────────────────────────────

  describe("signature verification", () => {
    it("rejects webhooks with invalid signatures", async () => {
      mockPlisioPay.verifyWebhook.mockReturnValue(false);

      const req = { body: createPlisioWebhookBody() };
      await handleCryptoWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error" }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // User ID Extraction (THE BUG FIX)
  // ─────────────────────────────────────────────────────────────────────────

  describe("userId extraction from order_number", () => {
    it("extracts discordId from order_number when metadata is empty", async () => {
      const req = {
        body: createPlisioWebhookBody({
          status: "completed",
          metadata: {}, // No discordId in metadata
        }),
      };

      await handleCryptoWebhook(req, res);

      // The storePaymentRecord should have been called with the
      // extracted userId, which is stored in the payment record
      expect(mockDbManager.payments.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          discordId: "930964921116680304", // extracted from order_number
        }),
      );
    });

    it("prefers metadata.discordId over order_number extraction", async () => {
      const req = {
        body: createPlisioWebhookBody({
          status: "completed",
          metadata: { discordId: "111222333444555666" },
        }),
      };

      await handleCryptoWebhook(req, res);

      // Should use metadata.discordId, not the one from order_number
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "111222333444555666" }),
        expect.anything(),
        expect.anything(),
      );
    });

    it("returns no_user_linked when discordId cannot be extracted", async () => {
      const req = {
        body: createPlisioWebhookBody({
          order_number: "invalid-no-underscore",
          status: "completed",
          metadata: {},
        }),
      };

      await handleCryptoWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "no_user_linked" }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Status Filtering
  // ─────────────────────────────────────────────────────────────────────────

  describe("status filtering", () => {
    it("ignores non-completed statuses (new, pending, etc.)", async () => {
      const req = {
        body: createPlisioWebhookBody({ status: "new" }),
      };

      await handleCryptoWebhook(req, res);

      // Should store the raw record but NOT process the payment
      expect(mockDbManager.payments.complete).toHaveBeenCalled();
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: "ignored" });
    });

    it("processes 'completed' status webhooks", async () => {
      const req = {
        body: createPlisioWebhookBody({ status: "completed" }),
      };

      await handleCryptoWebhook(req, res);

      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("processes 'mismatch' status webhooks (partial payments)", async () => {
      const req = {
        body: createPlisioWebhookBody({ status: "mismatch" }),
      };

      await handleCryptoWebhook(req, res);

      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Payment Record Storage (storePaymentRecord)
  // ─────────────────────────────────────────────────────────────────────────

  describe("payment record storage", () => {
    it("stores raw payment record with discordId for ALL webhook statuses", async () => {
      const req = {
        body: createPlisioWebhookBody({ status: "new" }),
      };

      await handleCryptoWebhook(req, res);

      // complete() is called by storePaymentRecord for audit trail
      expect(mockDbManager.payments.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "930964921116680304_1774809683267",
          discordId: "930964921116680304",
          provider: "plisio",
          status: "new",
          amount: expect.any(Number), // parseFloat(source_amount) || 0
          currency: "USD",
        }),
      );
    });

    it("parses source_amount correctly as fiat amount", async () => {
      const req = {
        body: createPlisioWebhookBody({
          status: "new",
          source_amount: "5.03",
        }),
      };

      await handleCryptoWebhook(req, res);

      expect(mockDbManager.payments.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5.03, // parsed from source_amount
        }),
      );
    });

    it("defaults amount to 0 when source_amount is missing", async () => {
      const req = {
        body: createPlisioWebhookBody({
          status: "new",
          source_amount: undefined,
        }),
      };

      await handleCryptoWebhook(req, res);

      expect(mockDbManager.payments.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0, // parseFloat(undefined) || 0 = 0, NOT null
        }),
      );
    });

    it("falls back to createPayment when complete() fails", async () => {
      mockDbManager.payments.complete.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const req = {
        body: createPlisioWebhookBody({ status: "new" }),
      };

      await handleCryptoWebhook(req, res);

      // Fallback should be called
      expect(mockStorageManager.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "930964921116680304_1774809683267",
          discordId: "930964921116680304",
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Core Credit Processing (processCryptoPayment)
  // ─────────────────────────────────────────────────────────────────────────

  describe("core credit processing", () => {
    it("uses fiat amount (source_amount) for core calculation, not crypto", async () => {
      const req = {
        body: createPlisioWebhookBody({
          status: "completed",
          amount: "0.00250512", // crypto amount (~$5.00 in ETH)
          source_amount: "5.03", // fiat amount
        }),
      };

      await handleCryptoWebhook(req, res);

      // $5.03 × 15 = 75 cores (Math.floor(5.03 * 15) = 75)
      // Filter carries the atomic dedupe (CAS) — chargeId must not exist
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          userId: "930964921116680304",
          "cryptoPayments.chargeId": {
            $ne: "930964921116680304_1774809683267",
          },
        },
        expect.objectContaining({
          $inc: { credits: 75, totalGenerated: 75 },
        }),
        { upsert: true, returnDocument: "after" },
      );
    });

    it("prevents duplicate credit processing", async () => {
      // Pre-check finds existing payment in user's record
      mockStorageManager.getCoreCredits.mockResolvedValue({
        credits: 75,
        cryptoPayments: [
          {
            chargeId: "930964921116680304_1774809683267",
            processed: true,
          },
        ],
      });

      const req = {
        body: createPlisioWebhookBody({ status: "completed" }),
      };

      await handleCryptoWebhook(req, res);

      // findOneAndUpdate should NOT be called (early return)
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Already processed" }),
      );
    });

    it("atomically rejects duplicates when the fast-path check misses (CAS)", async () => {
      // Fast-path misses (stale read / concurrent delivery): no prior data
      mockStorageManager.getCoreCredits.mockResolvedValue(null);
      // CAS lost: the write matched nothing — already credited by a
      // concurrent delivery
      mockDbManager.coreCredits.collection.findOneAndUpdate.mockResolvedValue(
        null,
      );

      const req = {
        body: createPlisioWebhookBody({ status: "completed" }),
      };

      await handleCryptoWebhook(req, res);

      // The atomic dedupe filter was used
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "930964921116680304",
          "cryptoPayments.chargeId": {
            $ne: "930964921116680304_1774809683267",
          },
        }),
        expect.anything(),
        expect.anything(),
      );

      // No ledger entry, no referral bonus, no notification for a dupe
      expect(mockStorageManager.completePayment).not.toHaveBeenCalled();
      expect(
        mockDbManager.referrals.processPurchaseBonus,
      ).not.toHaveBeenCalled();
      expect(mockDbManager.notifications.create).not.toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Already processed" }),
      );
    });

    it("updates the payments ledger via completePayment() after crediting", async () => {
      const req = {
        body: createPlisioWebhookBody({ status: "completed" }),
      };

      await handleCryptoWebhook(req, res);

      // This is the FIX: uses completePayment (upsert), not createPayment (insert)
      expect(mockStorageManager.completePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "930964921116680304_1774809683267",
          discordId: "930964921116680304",
          provider: "plisio",
          type: "one_time",
          status: "completed",
          amount: 5.03,
          coresGranted: 75,
        }),
      );
    });

    it("adds to existing user balance instead of replacing it", async () => {
      // findOneAndUpdate returns doc with the new total after $inc
      mockDbManager.coreCredits.collection.findOneAndUpdate.mockResolvedValue({
        credits: 125,
      });

      const req = {
        body: createPlisioWebhookBody({ status: "completed" }),
      };

      await handleCryptoWebhook(req, res);

      // New balance should be 50 + 75 = 125 (atomic $inc adds to existing)
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "930964921116680304" }),
        expect.objectContaining({
          $inc: expect.objectContaining({ credits: 75, totalGenerated: 75 }),
        }),
        expect.objectContaining({ upsert: true, returnDocument: "after" }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Full End-to-End Flow
  // ─────────────────────────────────────────────────────────────────────────

  describe("end-to-end: new → completed", () => {
    it("correctly handles the full payment lifecycle", async () => {
      // ─── Step 1: "new" webhook ───
      const newReq = {
        body: createPlisioWebhookBody({ status: "new" }),
      };

      await handleCryptoWebhook(newReq, createMockRes());

      // Should store raw record with discordId
      expect(mockDbManager.payments.complete).toHaveBeenCalledTimes(1);
      expect(mockDbManager.payments.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          discordId: "930964921116680304",
          status: "new",
        }),
      );
      // Should NOT credit the user yet
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // ─── Step 2: "completed" webhook ───
      const completedReq = {
        body: createPlisioWebhookBody({
          status: "completed",
          source_amount: "5.00",
        }),
      };

      await handleCryptoWebhook(completedReq, res);

      // Should store the completed audit record
      expect(mockDbManager.payments.complete).toHaveBeenCalled();

      // Should credit user with cores (atomic $inc)
      expect(
        mockDbManager.coreCredits.collection.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "930964921116680304" }),
        expect.objectContaining({
          $inc: expect.objectContaining({ credits: 75, totalGenerated: 75 }),
        }),
        expect.objectContaining({ upsert: true, returnDocument: "after" }),
      );

      // Should update the payment ledger to "completed"
      expect(mockStorageManager.completePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          amount: 5.0,
          coresGranted: 75,
          discordId: "930964921116680304",
        }),
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          credits: 75,
        }),
      );
    });
  });
});
