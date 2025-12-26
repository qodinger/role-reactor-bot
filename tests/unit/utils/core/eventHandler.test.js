import { jest } from "@jest/globals";

// Create mock functions that will be hoisted
const mockInfo = jest.fn();
const mockError = jest.fn();
const mockWarn = jest.fn();
const mockDebug = jest.fn();
const mockLogRateLimit = jest.fn();

// Create rate limiter mocks outside factory to ensure they're jest.fn() instances
const mockIsRateLimitedFn = jest.fn();
const mockGetRateLimitRemainingTimeFn = jest.fn();

// Mock rate limiter - must be hoisted before any imports
jest.mock("src/utils/discord/rateLimiter.js", () => ({
  isRateLimited: mockIsRateLimitedFn,
  getRateLimitRemainingTime: mockGetRateLimitRemainingTimeFn,
}));

// Mock logger - must be hoisted before any imports
jest.mock("src/utils/logger.js", () => ({
  getLogger: jest.fn(() => ({
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
    debug: mockDebug,
    logRateLimit: mockLogRateLimit,
  })),
}));

// Mock MongoDB to prevent real connections
jest.mock("mongodb", () => {
  const mockMongoClient = {
    connect: jest.fn().mockResolvedValue({
      db: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          find: jest.fn(),
          updateOne: jest.fn(),
          deleteOne: jest.fn(),
        }),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    MongoClient: jest.fn(() => mockMongoClient),
  };
});

// Mock database manager
jest.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: jest.fn().mockResolvedValue({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
  }),
}));

// Mock storage manager
jest.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: jest.fn().mockResolvedValue({
    save: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn(),
  }),
}));

// Mock Core utils to prevent storage lookups
// Create mock functions outside factory to ensure they're jest.fn() instances
const mockGetUserCorePriority = jest.fn().mockResolvedValue({
  hasCore: false,
  tier: null,
  priority: 0,
});
const mockGetCoreRateLimitMultiplier = jest.fn().mockReturnValue(1.0);

jest.mock("src/commands/general/core/utils.js", () => ({
  getUserCorePriority: mockGetUserCorePriority,
  getCoreRateLimitMultiplier: mockGetCoreRateLimitMultiplier,
}));

// Import EventHandler after mocks are set up
import { EventHandler } from "../../../../src/utils/core/eventHandler.js";

describe("EventHandler - Core-Aware Command Rate Limiting", () => {
  let eventHandler;
  let mockInteraction;
  let mockHandler;

  beforeEach(() => {
    eventHandler = new EventHandler();
    jest.clearAllMocks();

    // Create mock interaction
    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
      },
      commandName: "help",
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(),
      editReply: jest.fn().mockResolvedValue(),
    };

    // Create mock handler
    mockHandler = jest.fn().mockResolvedValue();
  });

  describe("processEvent - Legacy Rate Limiting", () => {
    test("should use legacy rate limiting for non-command events", async () => {
      // Non-command events use legacy rate limiting (no MongoDB needed)
      jest.spyOn(eventHandler, "isRateLimited").mockReturnValue(false);

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
      jest.spyOn(eventHandler, "isRateLimited").mockReturnValue(true);

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
      const errorHandler = jest
        .fn()
        .mockRejectedValue(new Error("Handler failed"));
      jest.spyOn(eventHandler, "isRateLimited").mockReturnValue(false);

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
