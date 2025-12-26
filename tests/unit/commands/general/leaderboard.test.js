import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// IMPORTANT: Mocks must be defined BEFORE importing the module under test
// Mock MongoDB directly to prevent real connections
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

// Mock the entire module to prevent any real DatabaseManager instantiation
// This MUST be hoisted before any imports
const mockDbManagerInstance = {
  guildSettings: {
    getByGuild: jest.fn().mockResolvedValue({
      experienceSystem: {
        enabled: true,
      },
    }),
  },
  welcomeSettings: { exists: true }, // Non-empty object to prevent reconnect
  goodbyeSettings: {},
  experienceSystem: {},
  connectionManager: {
    db: { collection: jest.fn() },
    connect: jest.fn().mockResolvedValue(undefined),
  },
  connect: jest.fn().mockResolvedValue(undefined),
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
};

jest.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: jest.fn().mockResolvedValue(mockDbManagerInstance),
  DatabaseManager: jest.fn(() => mockDbManagerInstance),
}));

// Mock storage manager to prevent real connections
const mockStorageManager = {
  read: jest.fn().mockResolvedValue({}),
  write: jest.fn().mockResolvedValue(true),
  isInitialized: true,
};

jest.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: jest.fn(() => Promise.resolve(mockStorageManager)),
  StorageManager: jest.fn(() => mockStorageManager),
}));

// Mock logger
jest.mock("src/utils/logger.js", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock experience manager
const mockExperienceManager = {
  getLeaderboard: jest.fn().mockResolvedValue([
    { userId: "user1", totalXP: 5000, level: 10 },
    { userId: "user2", totalXP: 3000, level: 8 },
    { userId: "user3", totalXP: 2000, level: 6 },
  ]),
  isInitialized: true,
  initialize: jest.fn().mockResolvedValue(undefined),
};

jest.mock("src/features/experience/ExperienceManager.js", () => ({
  getExperienceManager: jest.fn(() => Promise.resolve(mockExperienceManager)),
  ExperienceManager: jest.fn(() => mockExperienceManager),
}));

// Mock embeds
jest.mock("src/commands/general/leaderboard/embeds.js", () => ({
  createLeaderboardEmbed: jest.fn(() => ({
    data: {
      title: "Leaderboard",
      description: "XP leaderboard",
    },
  })),
}));

// Mock response messages
jest.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: jest.fn(options => ({
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
    jest.clearAllMocks();

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
      },
      options: {
        getInteger: jest.fn().mockReturnValue(10),
        getString: jest.fn().mockReturnValue("xp"),
      },
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
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
      const mockGetDatabaseManager = jest
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = jest
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
      const mockGetDatabaseManager = jest
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = jest
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
      const mockGetDatabaseManager = jest
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = jest
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
      const mockGetDatabaseManager = jest
        .fn()
        .mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest
        .fn()
        .mockResolvedValue(mockExperienceManager);
      const mockGetStorageManager = jest
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
