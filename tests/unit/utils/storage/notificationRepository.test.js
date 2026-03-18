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

const { NotificationRepository } = await import(
  "../../../../src/utils/storage/repositories/NotificationRepository.js"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockCollection() {
  return {
    createIndex: vi.fn().mockResolvedValue(true),
    insertOne: vi.fn().mockResolvedValue({
      acknowledged: true,
      insertedId: "mock-id-123",
    }),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 3 }),
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

describe("NotificationRepository", () => {
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
    repo = new NotificationRepository(db, cache, logger);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("creates indexes on initialization", () => {
      // 3 indexes: (userId, createdAt), (userId, read), TTL
      expect(collection.createIndex).toHaveBeenCalledTimes(3);
    });

    it("creates a TTL index with 90-day expiry", () => {
      expect(collection.createIndex).toHaveBeenCalledWith(
        { createdAt: 1 },
        { expireAfterSeconds: 90 * 24 * 60 * 60 }
      );
    });

    it("creates a compound index on userId and createdAt", () => {
      expect(collection.createIndex).toHaveBeenCalledWith({
        userId: 1,
        createdAt: -1,
      });
    });

    it("creates a compound index on userId and read", () => {
      expect(collection.createIndex).toHaveBeenCalledWith({
        userId: 1,
        read: 1,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a notification with all fields", async () => {
      const data = {
        userId: "u1",
        type: "vote_reward",
        title: "Vote Reward!",
        message: "+1 Core credited",
        icon: "vote",
        metadata: { coresGranted: 1 },
      };

      const result = await repo.create(data);

      expect(collection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          type: "vote_reward",
          title: "Vote Reward!",
          message: "+1 Core credited",
          icon: "vote",
          read: false,
          metadata: { coresGranted: 1 },
          createdAt: expect.any(Date),
        })
      );
      expect(result).not.toBeNull();
      expect(result._id).toBe("mock-id-123");
    });

    it("defaults icon to 'core' when not provided", async () => {
      const data = {
        userId: "u1",
        type: "balance_added",
        title: "Balance Added",
        message: "+10 Cores",
      };

      await repo.create(data);

      expect(collection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({ icon: "core" })
      );
    });

    it("defaults metadata to empty object when not provided", async () => {
      const data = {
        userId: "u1",
        type: "balance_added",
        title: "Balance Added",
        message: "+10 Cores",
      };

      await repo.create(data);

      expect(collection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} })
      );
    });

    it("always sets read to false", async () => {
      const data = {
        userId: "u1",
        type: "test",
        title: "Test",
        message: "msg",
      };

      await repo.create(data);

      expect(collection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({ read: false })
      );
    });

    it("returns null when insertOne is not acknowledged", async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: false });

      const result = await repo.create({
        userId: "u1",
        type: "test",
        title: "Test",
        message: "msg",
      });

      expect(result).toBeNull();
    });

    it("returns null and logs error on DB failure", async () => {
      collection.insertOne.mockRejectedValue(new Error("DB crash"));

      const result = await repo.create({
        userId: "u1",
        type: "test",
        title: "Test",
        message: "msg",
      });

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to create notification",
        expect.any(Error)
      );
    });

    it("does not clear cache on write", async () => {
      await repo.create({
        userId: "u1",
        type: "test",
        title: "Test",
        message: "msg",
      });

      expect(cache.clear).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getByUserId
  // ─────────────────────────────────────────────────────────────────────────

  describe("getByUserId", () => {
    it("queries with userId and default options", async () => {
      await repo.getByUserId("u1");

      const findCall = collection.find.mock.calls[0][0];
      expect(findCall).toEqual({ userId: "u1" });
    });

    it("adds read:false filter when unreadOnly is true", async () => {
      await repo.getByUserId("u1", { unreadOnly: true });

      const findCall = collection.find.mock.calls[0][0];
      expect(findCall).toEqual({ userId: "u1", read: false });
    });

    it("applies limit and skip", async () => {
      const mockSort = vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      collection.find.mockReturnValue({ sort: mockSort });

      await repo.getByUserId("u1", { limit: 10, skip: 5 });

      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      const skipFn = mockSort.mock.results[0].value.skip;
      expect(skipFn).toHaveBeenCalledWith(5);
      const limitFn = skipFn.mock.results[0].value.limit;
      expect(limitFn).toHaveBeenCalledWith(10);
    });

    it("returns empty array on error", async () => {
      collection.find.mockImplementation(() => {
        throw new Error("DB fail");
      });

      const result = await repo.getByUserId("u1");
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getUnreadCount
  // ─────────────────────────────────────────────────────────────────────────

  describe("getUnreadCount", () => {
    it("counts unread documents for a user", async () => {
      collection.countDocuments.mockResolvedValue(7);

      const result = await repo.getUnreadCount("u1");

      expect(collection.countDocuments).toHaveBeenCalledWith({
        userId: "u1",
        read: false,
      });
      expect(result).toBe(7);
    });

    it("returns 0 on error", async () => {
      collection.countDocuments.mockRejectedValue(new Error("DB fail"));

      const result = await repo.getUnreadCount("u1");
      expect(result).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // markAsRead
  // ─────────────────────────────────────────────────────────────────────────

  describe("markAsRead", () => {
    it("updates a single notification by ID and userId", async () => {
      collection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await repo.markAsRead("abc123", "u1");

      expect(collection.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1" }),
        { $set: { read: true } }
      );
      expect(result).toBe(true);
    });

    it("returns false when notification is not found", async () => {
      collection.updateOne.mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.markAsRead("nonexistent", "u1");
      expect(result).toBe(false);
    });

    it("returns false on error", async () => {
      collection.updateOne.mockRejectedValue(new Error("DB fail"));

      const result = await repo.markAsRead("abc123", "u1");
      expect(result).toBe(false);
    });

    it("does not clear cache", async () => {
      await repo.markAsRead("abc123", "u1");
      expect(cache.clear).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // markAllAsRead
  // ─────────────────────────────────────────────────────────────────────────

  describe("markAllAsRead", () => {
    it("updates all unread notifications for a user", async () => {
      collection.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const result = await repo.markAllAsRead("u1");

      expect(collection.updateMany).toHaveBeenCalledWith(
        { userId: "u1", read: false },
        { $set: { read: true } }
      );
      expect(result).toBe(5);
    });

    it("returns 0 when nothing to update", async () => {
      collection.updateMany.mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.markAllAsRead("u1");
      expect(result).toBe(0);
    });

    it("returns 0 on error", async () => {
      collection.updateMany.mockRejectedValue(new Error("DB fail"));

      const result = await repo.markAllAsRead("u1");
      expect(result).toBe(0);
    });

    it("does not clear cache", async () => {
      await repo.markAllAsRead("u1");
      expect(cache.clear).not.toHaveBeenCalled();
    });
  });
});
