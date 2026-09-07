import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoreCreditsRepository } from "../../../../src/utils/storage/repositories/CoreCreditsRepository.js";

function createMockCollection() {
  const docs = new Map();
  return {
    docs,
    async findOne(query) {
      if (query.userId) return docs.get(query.userId) || null;
      return null;
    },
    async replaceOne(query, document) {
      docs.set(query.userId, document);
      return { acknowledged: true };
    },
    async findOneAndUpdate(query, update, options = {}) {
      const doc = docs.get(query.userId);
      if (!doc) return null;
      if (
        query.credits &&
        query.credits.$gte !== undefined &&
        (doc.credits || 0) < query.credits.$gte
      ) {
        return null; // conditional match fails (insufficient balance)
      }
      const before = options.returnDocument === "before" ? { ...doc } : null;
      if (update.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          doc[key] = (doc[key] || 0) + val;
        }
      }
      if (update.$set) {
        for (const [key, val] of Object.entries(update.$set)) {
          doc[key] = val;
        }
      }
      return options.returnDocument === "before" ? before : { ...doc };
    },
    async updateOne(query, update, options = {}) {
      let doc = docs.get(query.userId);
      if (!doc) {
        if (options.upsert) {
          doc = { userId: query.userId, credits: 0, sparks: 0 };
          docs.set(query.userId, doc);
        } else {
          return { acknowledged: false, matchedCount: 0 };
        }
      }
      if (update.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          doc[key] = (doc[key] || 0) + val;
        }
      }
      if (update.$set) {
        for (const [key, val] of Object.entries(update.$set)) {
          doc[key] = val;
        }
      }
      return { acknowledged: true, matchedCount: 1 };
    },
    async deleteOne(query) {
      const existed = docs.delete(query.userId);
      return { deletedCount: existed ? 1 : 0 };
    },
    createIndex: vi.fn().mockResolvedValue("index_name"),
  };
}

function createMockCache() {
  const store = new Map();
  return {
    get: key => store.get(key),
    set: (key, val) => store.set(key, val),
    delete: key => store.delete(key),
    invalidatePrefix: prefix => {
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
      }
    },
    clear: () => store.clear(),
  };
}

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("CoreCreditsRepository - Cores 🔮 and Sparks ⚡ Dual Balance", () => {
  let repository;
  let mockCollection;
  let mockCache;
  let mockLogger;

  beforeEach(() => {
    mockCollection = createMockCollection();
    mockCache = createMockCache();
    mockLogger = createMockLogger();

    repository = new CoreCreditsRepository(
      { collection: () => mockCollection },
      mockCache,
      mockLogger,
    );
  });

  describe("getByUserId", () => {
    it("returns defaulted sparks: 0 and credits: 0 when doc is retrieved", async () => {
      mockCollection.docs.set("user_100", { userId: "user_100", credits: 50 });
      const result = await repository.getByUserId("user_100");
      expect(result).toEqual({ userId: "user_100", credits: 50, sparks: 0 });
    });

    it("returns null for non-existent user", async () => {
      const result = await repository.getByUserId("user_999");
      expect(result).toBeNull();
    });
  });

  describe("updateCredits (Paid Cores 🔮)", () => {
    it("increments Cores balance correctly with rounding", async () => {
      await repository.updateCredits("user_100", 15.875);
      const doc = await repository.getByUserId("user_100");
      expect(doc.credits).toBe(15.88);
    });

    it("deducts Cores balance when negative change passed", async () => {
      await repository.updateCredits("user_100", 50);
      await repository.updateCredits("user_100", -10);
      const doc = await repository.getByUserId("user_100");
      expect(doc.credits).toBe(40);
    });
  });

  describe("deductCredits (atomic, non-negative guard)", () => {
    it("deducts when balance is sufficient and returns the new balance", async () => {
      await repository.updateCredits("user_100", 50);
      const result = await repository.deductCredits("user_100", 20);
      expect(result).toEqual({ success: true, credits: 30 });
      const doc = await repository.getByUserId("user_100");
      expect(doc.credits).toBe(30);
    });

    it("refuses to deduct more than the balance (never goes negative)", async () => {
      await repository.updateCredits("user_100", 10);
      const result = await repository.deductCredits("user_100", 20);
      expect(result).toEqual({ success: false });
      const doc = await repository.getByUserId("user_100");
      expect(doc.credits).toBe(10); // unchanged
    });

    it("refuses to deduct when the user has no document", async () => {
      const result = await repository.deductCredits("user_999", 1);
      expect(result).toEqual({ success: false });
    });

    it("rounds the deducted amount to 2 decimal places", async () => {
      await repository.updateCredits("user_100", 10);
      await repository.deductCredits("user_100", 0.125);
      const doc = await repository.getByUserId("user_100");
      expect(doc.credits).toBe(9.87); // 10 - 0.13
    });
  });

  describe("updateSparks (Reward Sparks ⚡)", () => {
    it("increments Sparks balance correctly", async () => {
      await repository.updateSparks("user_100", 5);
      let doc = await repository.getByUserId("user_100");
      expect(doc.sparks).toBe(5);

      await repository.updateSparks("user_100", 25);
      doc = await repository.getByUserId("user_100");
      expect(doc.sparks).toBe(30);
    });

    it("maintains separate balances for Cores and Sparks on the same user", async () => {
      await repository.updateCredits("user_100", 100);
      await repository.updateSparks("user_100", 25);

      const doc = await repository.getByUserId("user_100");
      expect(doc.credits).toBe(100);
      expect(doc.sparks).toBe(25);
    });
  });
});
