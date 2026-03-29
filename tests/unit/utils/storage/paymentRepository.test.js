import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────────────────

vi.mock("mongodb", () => ({
  ObjectId: class ObjectId {
    constructor(id) {
      this._id = id;
    }
    toString() {
      return this._id;
    }
  },
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

const { PaymentRepository } = await import(
  "../../../../src/utils/storage/repositories/PaymentRepository.js"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockCollection() {
  return {
    createIndex: vi.fn().mockResolvedValue(true),
    insertOne: vi.fn().mockResolvedValue({
      acknowledged: true,
      insertedId: "mock-payment-id",
    }),
    findOne: vi.fn().mockResolvedValue(null),
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    aggregate: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  };
}

function createMockDb(collection) {
  return {
    collection: vi.fn().mockReturnValue(collection),
  };
}

function createMockCache() {
  return {
    clear: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PaymentRepository", () => {
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
    repo = new PaymentRepository(db, cache, logger);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor & Indexes
  // ─────────────────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("creates required indexes on initialization", () => {
      // PaymentRepository creates indexes but they go through the Proxy
      // which instruments common methods. createIndex IS a common method
      // but may be called asynchronously. Check the key ones:
      expect(collection.createIndex).toHaveBeenCalledWith(
        { paymentId: 1 },
        { unique: true },
      );
      expect(collection.createIndex).toHaveBeenCalledWith({ discordId: 1 });
      expect(collection.createIndex).toHaveBeenCalledWith({ provider: 1 });
      expect(collection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(collection.createIndex).toHaveBeenCalledWith({ createdAt: -1 });
      // At least 5 indexes are created (the compound index is async)
      expect(collection.createIndex.mock.calls.length).toBeGreaterThanOrEqual(
        5,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a payment record with all fields", async () => {
      const data = {
        paymentId: "user123_1234567890",
        discordId: "user123",
        provider: "plisio",
        type: "one_time",
        status: "completed",
        amount: 5.0,
        currency: "USD",
        coresGranted: 75,
        tier: null,
        email: "test@example.com",
        metadata: { guildId: "guild1" },
      };

      const result = await repo.create(data);

      expect(collection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: "user123_1234567890",
          discordId: "user123",
          provider: "plisio",
          type: "one_time",
          status: "completed",
          amount: 5.0,
          currency: "USD",
          coresGranted: 75,
          email: "test@example.com",
          metadata: { guildId: "guild1" },
          processedAt: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      );
      expect(result).not.toBeNull();
      expect(result._id).toBe("mock-payment-id");
    });

    it("stores amount: null when amount is undefined (the VPS bug)", async () => {
      // This reproduces the exact VPS bug where storePaymentRecord used
      // field name 'fiatAmount' instead of 'amount', so create() received
      // paymentData.amount = undefined, storing null in MongoDB
      const data = {
        paymentId: "user123_1234567890",
        provider: "plisio",
        status: "new",
        // amount is deliberately omitted — simulates the old bug
      };

      await repo.create(data);

      const insertedDoc = collection.insertOne.mock.calls[0][0];
      // amount field is undefined → MongoDB stores as null
      expect(insertedDoc.amount).toBeUndefined();
      // discordId is also undefined → stored as null
      expect(insertedDoc.discordId).toBeUndefined();
    });

    it("defaults type to one_time and status to completed", async () => {
      const data = {
        paymentId: "user123_99999",
        discordId: "user123",
        provider: "plisio",
        amount: 3.0,
      };

      await repo.create(data);

      const insertedDoc = collection.insertOne.mock.calls[0][0];
      expect(insertedDoc.type).toBe("one_time");
      expect(insertedDoc.status).toBe("completed");
    });

    it("handles duplicate paymentId by returning existing record", async () => {
      const existingRecord = {
        paymentId: "user123_1234567890",
        discordId: null,
        status: "new",
        amount: null,
      };

      const duplicateError = new Error("Duplicate key");
      duplicateError.code = 11000;
      collection.insertOne.mockRejectedValue(duplicateError);
      collection.findOne.mockResolvedValue(existingRecord);

      const result = await repo.create({
        paymentId: "user123_1234567890",
        discordId: "user123",
        status: "completed",
        amount: 5.0,
      });

      // BUG: create() returns the OLD record unchanged, not the new data
      expect(result.discordId).toBeNull();
      expect(result.status).toBe("new");
      expect(result.amount).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Duplicate payment detected: user123_1234567890",
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // complete() — The upsert method that fixes the VPS bug
  // ─────────────────────────────────────────────────────────────────────────

  describe("complete", () => {
    it("throws if paymentId is missing", async () => {
      const result = await repo.complete({});

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it("upserts a NEW payment record with correct fields", async () => {
      const expectedDoc = {
        paymentId: "user123_1234567890",
        discordId: "user123",
        provider: "plisio",
        status: "new",
        amount: 0,
        currency: "USD",
        updatedAt: expect.any(String),
        createdAt: expect.any(String),
      };

      collection.findOneAndUpdate.mockResolvedValue(expectedDoc);

      const result = await repo.complete({
        paymentId: "user123_1234567890",
        discordId: "user123",
        provider: "plisio",
        status: "new",
        amount: 0,
        currency: "USD",
      });

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { paymentId: "user123_1234567890" },
        {
          $set: expect.objectContaining({
            discordId: "user123",
            provider: "plisio",
            status: "new",
            amount: 0,
            currency: "USD",
            updatedAt: expect.any(String),
          }),
          $setOnInsert: { createdAt: expect.any(String) },
        },
        { upsert: true, returnDocument: "after" },
      );

      expect(result).not.toBeNull();
      expect(result.discordId).toBe("user123");
    });

    it("updates EXISTING 'new' record to 'completed' with user data", async () => {
      // This is the critical fix: when Plisio sends the "completed" webhook,
      // complete() should UPDATE the existing record with discordId, amount, etc.
      const updatedDoc = {
        paymentId: "user123_1234567890",
        discordId: "user123",
        provider: "plisio",
        status: "completed",
        amount: 5.0,
        coresGranted: 75,
        processedAt: "2026-03-29T20:00:00.000Z",
      };

      collection.findOneAndUpdate.mockResolvedValue(updatedDoc);

      const result = await repo.complete({
        paymentId: "user123_1234567890",
        discordId: "user123",
        provider: "plisio",
        type: "one_time",
        status: "completed",
        amount: 5.0,
        coresGranted: 75,
        email: "user@test.com",
      });

      const updateCall = collection.findOneAndUpdate.mock.calls[0];
      const setData = updateCall[1].$set;

      // Verify ALL critical fields are included in $set
      expect(setData.discordId).toBe("user123");
      expect(setData.status).toBe("completed");
      expect(setData.amount).toBe(5.0);
      expect(setData.coresGranted).toBe(75);
      expect(setData.processedAt).toBeDefined();
      expect(setData.email).toBe("user@test.com");

      expect(result.status).toBe("completed");
      expect(result.amount).toBe(5.0);
    });

    it("sets processedAt only when status is completed", async () => {
      collection.findOneAndUpdate.mockResolvedValue({});

      // Test with "new" status
      await repo.complete({
        paymentId: "test_1",
        status: "new",
      });

      let setData = collection.findOneAndUpdate.mock.calls[0][1].$set;
      expect(setData.processedAt).toBeUndefined();

      // Test with "completed" status
      await repo.complete({
        paymentId: "test_2",
        status: "completed",
      });

      setData = collection.findOneAndUpdate.mock.calls[1][1].$set;
      expect(setData.processedAt).toBeDefined();
    });

    it("does NOT overwrite discordId with undefined on intermediate webhooks", async () => {
      // When a webhook arrives without metadata.discordId and the
      // fallback extraction also fails, discordId would be falsy.
      // complete() should NOT overwrite a previously-stored discordId.
      collection.findOneAndUpdate.mockResolvedValue({});

      await repo.complete({
        paymentId: "user123_1234567890",
        discordId: undefined, // No user ID available
        status: "pending",
      });

      const setData = collection.findOneAndUpdate.mock.calls[0][1].$set;
      // discordId should NOT be in the $set if it's falsy
      expect(setData).not.toHaveProperty("discordId");
    });

    it("does NOT overwrite amount with undefined", async () => {
      collection.findOneAndUpdate.mockResolvedValue({});

      await repo.complete({
        paymentId: "user123_1234567890",
        // amount is deliberately omitted
      });

      const setData = collection.findOneAndUpdate.mock.calls[0][1].$set;
      expect(setData).not.toHaveProperty("amount");
    });

    it("DOES set amount when it is 0 (zero is a valid falsy value)", async () => {
      collection.findOneAndUpdate.mockResolvedValue({});

      await repo.complete({
        paymentId: "user123_1234567890",
        amount: 0,
      });

      const setData = collection.findOneAndUpdate.mock.calls[0][1].$set;
      expect(setData.amount).toBe(0);
    });

    it("returns null and logs error on DB failure", async () => {
      collection.findOneAndUpdate.mockRejectedValue(new Error("DB crash"));

      const result = await repo.complete({
        paymentId: "user123_1234567890",
        discordId: "user123",
      });

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to complete payment user123_1234567890",
        expect.any(Error),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Full Webhook Flow Simulation
  // ─────────────────────────────────────────────────────────────────────────

  describe("webhook flow simulation", () => {
    it("simulates complete Plisio payment lifecycle: new → completed", async () => {
      // ─── Step 1: "new" webhook arrives ───
      // storePaymentRecord calls complete() with initial data
      const newRecord = {
        paymentId: "930964921116680304_1774809683267",
        discordId: "930964921116680304", // extracted from order_number
        provider: "plisio",
        status: "new",
        amount: 0, // parseFloat(undefined) || 0
        currency: "USD",
      };

      const storedNewDoc = {
        ...newRecord,
        updatedAt: "2026-03-29T18:41:26.278Z",
        createdAt: "2026-03-29T18:41:26.278Z",
      };

      collection.findOneAndUpdate.mockResolvedValueOnce(storedNewDoc);

      const step1 = await repo.complete(newRecord);

      // Verify discordId is stored even on "new" webhook
      const step1SetData = collection.findOneAndUpdate.mock.calls[0][1].$set;
      expect(step1SetData.discordId).toBe("930964921116680304");
      expect(step1SetData.status).toBe("new");
      expect(step1SetData.amount).toBe(0);
      expect(step1).toEqual(storedNewDoc);

      // ─── Step 2: "completed" webhook arrives ───
      // processCryptoPayment calls completePayment() to update the record
      const completedRecord = {
        paymentId: "930964921116680304_1774809683267",
        discordId: "930964921116680304",
        provider: "plisio",
        type: "one_time",
        status: "completed",
        amount: 5.0,
        coresGranted: 75,
        email: "user@test.com",
      };

      const storedCompletedDoc = {
        ...storedNewDoc,
        ...completedRecord,
        processedAt: "2026-03-29T19:00:00.000Z",
        updatedAt: "2026-03-29T19:00:00.000Z",
      };

      collection.findOneAndUpdate.mockResolvedValueOnce(storedCompletedDoc);

      const step2 = await repo.complete(completedRecord);

      // Verify the record is now updated
      const step2SetData = collection.findOneAndUpdate.mock.calls[1][1].$set;
      expect(step2SetData.discordId).toBe("930964921116680304");
      expect(step2SetData.status).toBe("completed");
      expect(step2SetData.amount).toBe(5.0);
      expect(step2SetData.coresGranted).toBe(75);
      expect(step2SetData.processedAt).toBeDefined();

      expect(step2.status).toBe("completed");
      expect(step2.amount).toBe(5.0);
      expect(step2.discordId).toBe("930964921116680304");
    });

    it("simulates abandoned checkout: only 'new' webhook, never completed", async () => {
      const newRecord = {
        paymentId: "930964921116680304_1774810317846",
        discordId: "930964921116680304",
        provider: "plisio",
        status: "new",
        amount: 0,
        currency: "USD",
      };

      const storedDoc = {
        ...newRecord,
        updatedAt: "2026-03-29T18:52:01.112Z",
        createdAt: "2026-03-29T18:52:01.112Z",
      };

      collection.findOneAndUpdate.mockResolvedValue(storedDoc);

      const result = await repo.complete(newRecord);

      // Record is stored with user data but stays "new" — this is correct
      expect(result.status).toBe("new");
      expect(result.discordId).toBe("930964921116680304");
      expect(result.amount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findByDiscordId
  // ─────────────────────────────────────────────────────────────────────────

  describe("findByDiscordId", () => {
    it("queries payments for a user with defaults", async () => {
      await repo.findByDiscordId("user123");

      expect(collection.find).toHaveBeenCalledWith({ discordId: "user123" });
    });

    it("filters by status and provider", async () => {
      await repo.findByDiscordId("user123", {
        status: "completed",
        provider: "plisio",
      });

      expect(collection.find).toHaveBeenCalledWith({
        discordId: "user123",
        status: "completed",
        provider: "plisio",
      });
    });

    it("returns empty array on error", async () => {
      collection.find.mockImplementation(() => {
        throw new Error("DB fail");
      });

      const result = await repo.findByDiscordId("user123");
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateStatus
  // ─────────────────────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("updates payment status and sets processedAt for completed", async () => {
      await repo.updateStatus("user123_1234567890", "completed");

      expect(collection.updateOne).toHaveBeenCalledWith(
        { paymentId: "user123_1234567890" },
        {
          $set: expect.objectContaining({
            status: "completed",
            processedAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        },
      );
    });

    it("does NOT set processedAt for non-completed statuses", async () => {
      await repo.updateStatus("user123_1234567890", "pending");

      const setData = collection.updateOne.mock.calls[0][1].$set;
      expect(setData.status).toBe("pending");
      expect(setData.processedAt).toBeUndefined();
    });

    it("returns false when payment not found", async () => {
      collection.updateOne.mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.updateStatus("nonexistent", "completed");
      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isProcessed
  // ─────────────────────────────────────────────────────────────────────────

  describe("isProcessed", () => {
    it("returns true when payment exists and is completed", async () => {
      collection.findOne.mockResolvedValue({ _id: "some-id" });

      const result = await repo.isProcessed("user123_1234567890");

      expect(collection.findOne).toHaveBeenCalledWith(
        { paymentId: "user123_1234567890", status: "completed" },
        { projection: { _id: 1 } },
      );
      expect(result).toBe(true);
    });

    it("returns false when payment is not completed", async () => {
      collection.findOne.mockResolvedValue(null);

      const result = await repo.isProcessed("user123_1234567890");
      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getGlobalStats
  // ─────────────────────────────────────────────────────────────────────────

  describe("getGlobalStats", () => {
    it("returns correct aggregate stats for completed payments", async () => {
      collection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            _id: null,
            totalPayments: 3,
            totalRevenue: 15.0,
            totalCores: 225,
            uniqueUsers: 2,
          },
        ]),
      });

      const stats = await repo.getGlobalStats();

      expect(stats.totalPayments).toBe(3);
      expect(stats.totalRevenue).toBe(15.0);
      expect(stats.totalCores).toBe(225);
      expect(stats.uniqueUsers).toBe(2);
    });

    it("returns zeros when no completed payments exist", async () => {
      collection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });

      const stats = await repo.getGlobalStats();

      expect(stats).toEqual({
        totalPayments: 0,
        totalRevenue: 0,
        totalCores: 0,
        uniqueUsers: 0,
      });
    });

    it("filters to revenue providers only when revenueOnly is true", async () => {
      collection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });

      await repo.getGlobalStats({ revenueOnly: true });

      const pipeline = collection.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;

      // Should filter by provider AND status
      expect(matchStage.status).toBe("completed");
      expect(matchStage.provider).toEqual({
        $in: PaymentRepository.REVENUE_PROVIDERS,
      });
    });

    it("does NOT filter by provider when revenueOnly is false", async () => {
      collection.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });

      await repo.getGlobalStats({ revenueOnly: false });

      const pipeline = collection.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;

      expect(matchStage.status).toBe("completed");
      expect(matchStage.provider).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getRecent
  // ─────────────────────────────────────────────────────────────────────────

  describe("getRecent", () => {
    it("returns recent completed payments", async () => {
      const mockPayments = [
        { paymentId: "p1", provider: "plisio", status: "completed" },
      ];
      collection.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(mockPayments),
          }),
        }),
      });

      const result = await repo.getRecent(5);
      expect(result).toEqual(mockPayments);
      expect(collection.find).toHaveBeenCalledWith({ status: "completed" });
    });

    it("filters to revenue providers only when revenueOnly is true", async () => {
      collection.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repo.getRecent(10, { revenueOnly: true });

      expect(collection.find).toHaveBeenCalledWith({
        status: "completed",
        provider: { $in: PaymentRepository.REVENUE_PROVIDERS },
      });
    });

    it("does NOT filter by provider when revenueOnly is false", async () => {
      collection.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await repo.getRecent(10, { revenueOnly: false });

      expect(collection.find).toHaveBeenCalledWith({ status: "completed" });
    });
  });
});
