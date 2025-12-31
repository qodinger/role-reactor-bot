import { describe, it, expect, beforeEach, vi } from "vitest";

// IMPORTANT: Mocks must be defined BEFORE importing the module under test
// Mock MongoDB directly to prevent real connections
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

// Mock the entire module to prevent any real DatabaseManager instantiation
// This MUST be hoisted before any imports
const mockDbManagerInstance = {
  guildSettings: {
    getByGuild: vi.fn().mockResolvedValue({
      experienceSystem: {
        enabled: true,
      },
    }),
  },
  welcomeSettings: { exists: true }, // Non-empty object to prevent reconnect
  goodbyeSettings: {},
  experienceSystem: {},
  connectionManager: {
    db: { collection: vi.fn() },
    connect: vi.fn().mockResolvedValue(undefined),
  },
  connect: vi.fn().mockResolvedValue(undefined),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
};

vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue(mockDbManagerInstance),
  DatabaseManager: vi.fn(() => mockDbManagerInstance),
}));

// Mock storage manager to prevent real connections
const mockStorageManager = {
  read: vi.fn().mockResolvedValue({}),
  write: vi.fn().mockResolvedValue(true),
  isInitialized: true,
};

vi.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn(() => Promise.resolve(mockStorageManager)),
  StorageManager: vi.fn(() => mockStorageManager),
}));

// Mock logger
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock experience manager
const mockExperienceManager = {
  getLeaderboard: vi.fn().mockResolvedValue([
    { userId: "user1", totalXP: 5000, level: 10 },
    { userId: "user2", totalXP: 3000, level: 8 },
    { userId: "user3", totalXP: 2000, level: 6 },
  ]),
  isInitialized: true,
  initialize: vi.fn().mockResolvedValue(undefined),
};

vi.mock("src/features/experience/ExperienceManager.js", () => ({
  getExperienceManager: vi.fn(() => Promise.resolve(mockExperienceManager)),
  ExperienceManager: vi.fn(() => mockExperienceManager),
}));

// Mock embeds
vi.mock("src/commands/general/leaderboard/embeds.js", () => ({
  createLeaderboardEmbed: vi.fn(() => ({
    data: {
      title: "Leaderboard",
      description: "XP leaderboard",
    },
  })),
}));

// Mock response messages
vi.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: vi.fn(options => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
}));

import { handleLeaderboard } from "../../../../src/commands/general/leaderboard/handlers.js";

describe("Leaderboard Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset guild settings mock
    mockDbManagerInstance.guildSettings.getByGuild.mockResolvedValue({
      experienceSystem: {
        enabled: true,
      },
    });

    // Reset experience manager mocks
    mockExperienceManager.getLeaderboard.mockResolvedValue([
      { userId: "user1", totalXP: 5000, level: 10 },
      { userId: "user2", totalXP: 3000, level: 8 },
      { userId: "user3", totalXP: 2000, level: 6 },
    ]);

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
      },
      guild: {
        id: "guild123",
        name: "Test Guild",
        iconURL: vi.fn().mockReturnValue("https://example.com/guild-icon.png"),
        members: {
          cache: {
            get: vi.fn().mockReturnValue({
              id: "user1",
              displayName: "User1",
              user: {
                id: "user1",
                username: "user1",
              },
            }),
          },
        },
      },
      options: {
        getInteger: vi.fn().mockReturnValue(10),
        getString: vi.fn().mockReturnValue("xp"),
      },
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      user: {
        id: "bot123",
        tag: "TestBot#1234",
      },
    };
  });

  describe("handleLeaderboard", () => {
    it("should display leaderboard with default limit", async () => {
      mockInteraction.options.getInteger.mockReturnValue(null);

      // Inject mocks directly
      const mockGetDatabaseManager = vi
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = vi
        .fn()
        .mockResolvedValue(mockStorageManager);

      await handleLeaderboard(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should display leaderboard with custom limit", async () => {
      mockInteraction.options.getInteger.mockReturnValue(25);

      // Inject mocks directly
      const mockGetDatabaseManager = vi
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = vi
        .fn()
        .mockResolvedValue(mockStorageManager);

      await handleLeaderboard(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle disabled XP system", async () => {
      // Update the mock to return disabled XP system
      mockDbManagerInstance.guildSettings.getByGuild.mockResolvedValueOnce({
        experienceSystem: {
          enabled: false,
        },
      });

      // Inject mocks directly
      const mockGetDatabaseManager = vi
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = vi
        .fn()
        .mockResolvedValue(mockStorageManager);

      await handleLeaderboard(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle empty leaderboard", async () => {
      mockExperienceManager.getLeaderboard.mockResolvedValueOnce([]);

      // Inject mocks directly
      const mockGetDatabaseManager = vi
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = vi
        .fn()
        .mockResolvedValue(mockStorageManager);

      await handleLeaderboard(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});
