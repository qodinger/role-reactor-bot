import { vi } from "vitest";

// Create mock functions that will be hoisted
const mockInfo = vi.fn();
const mockError = vi.fn();
const mockWarn = vi.fn();
const mockDebug = vi.fn();
const mockLogRateLimit = vi.fn();

// Create rate limiter mocks outside factory to ensure they're vi.fn() instances
const mockIsRateLimitedFn = vi.fn();
const mockGetRateLimitRemainingTimeFn = vi.fn();

// Mock rate limiter - must be hoisted before any imports
vi.mock("src/utils/discord/rateLimiter.js", () => ({
  isRateLimited: mockIsRateLimitedFn,
  getRateLimitRemainingTime: mockGetRateLimitRemainingTimeFn,
}));

// Mock logger - must be hoisted before any imports
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
    debug: mockDebug,
    logRateLimit: mockLogRateLimit,
  })),
}));

// Mock MongoDB to prevent real connections
vi.mock("mongodb", () => {
  const mockCollection = {
    find: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
    findOne: vi.fn().mockResolvedValue(null),
    insertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    replaceOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    createIndex: vi.fn().mockResolvedValue({}),
  };
  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
    admin: vi.fn().mockReturnValue({
      ping: vi.fn().mockResolvedValue({}),
    }),
  };
  const mockMongoClient = {
    connect: vi.fn().mockResolvedValue({
      db: vi.fn().mockReturnValue(mockDb),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    db: vi.fn().mockReturnValue(mockDb),
    close: vi.fn().mockResolvedValue(undefined),
  };
  class MongoClient {
    constructor() {
      Object.assign(this, mockMongoClient);
    }
  }
  return {
    MongoClient,
  };
});

// Mock database manager
vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
  }),
}));

// Mock storage manager
vi.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue({
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn(),
  }),
}));

// Mock Core utils to prevent storage lookups
// Create mock functions outside factory to ensure they're vi.fn() instances
const mockGetUserCorePriority = vi.fn().mockResolvedValue({
  hasCore: false,
  tier: null,
  priority: 0,
});
const mockGetCoreRateLimitMultiplier = vi.fn().mockReturnValue(1.0);

vi.mock("src/commands/general/core/utils.js", () => ({
  getUserCorePriority: mockGetUserCorePriority,
  getCoreRateLimitMultiplier: mockGetCoreRateLimitMultiplier,
}));

// Import EventHandler after mocks are set up
import { describe, test, it, expect, beforeEach, vi } from "vitest";
import { EventHandler } from "../../../../src/utils/core/eventHandler.js";

describe("EventHandler - Core-Aware Command Rate Limiting", () => {
  let eventHandler;
  let mockInteraction;
  let mockHandler;

  beforeEach(() => {
    eventHandler = new EventHandler();
    vi.clearAllMocks();

    // Create mock interaction
    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
      },
      commandName: "help",
      replied: false,
      deferred: false,
      reply: vi.fn().mockResolvedValue(),
      editReply: vi.fn().mockResolvedValue(),
    };

    // Create mock handler
    mockHandler = vi.fn().mockResolvedValue();
  });

  describe("processEvent - Legacy Rate Limiting", () => {
    test("should use legacy rate limiting for non-command events", async () => {
      // Non-command events use legacy rate limiting (no MongoDB needed)
      vi.spyOn(eventHandler, "isRateLimited").mockReturnValue(false);

      await eventHandler.processEvent(
        "button:click",
        mockHandler,
        mockInteraction,
      );

      expect(eventHandler.isRateLimited).toHaveBeenCalledWith(
        "user123",
        "button:click",
      );
      expect(mockHandler).toHaveBeenCalled();
      eventHandler.isRateLimited.mockRestore();
    });

    test("should block non-command events when rate limited", async () => {
      // Test legacy rate limiting blocking
      vi.spyOn(eventHandler, "isRateLimited").mockReturnValue(true);

      await eventHandler.processEvent(
        "button:click",
        mockHandler,
        mockInteraction,
      );

      expect(eventHandler.isRateLimited).toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
      eventHandler.isRateLimited.mockRestore();
    });
  });

  describe("processEvent - Error Handling", () => {
    test("should not throw when handler errors", async () => {
      // When handler throws an error, should catch it and not throw
      // Use non-command event to avoid MongoDB connection
      const errorHandler = vi
        .fn()
        .mockRejectedValue(new Error("Handler failed"));
      vi.spyOn(eventHandler, "isRateLimited").mockReturnValue(false);

      // Process event - should not throw, should catch error
      await expect(
        eventHandler.processEvent(
          "button:click",
          errorHandler,
          mockInteraction,
        ),
      ).resolves.not.toThrow();

      // Verify handler was called
      expect(errorHandler).toHaveBeenCalled();
      eventHandler.isRateLimited.mockRestore();
    });
  });
});
