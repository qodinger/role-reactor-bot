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
  getUserData: jest.fn().mockResolvedValue({
    totalXP: 1000,
    level: 5,
  }),
  calculateProgress: jest.fn().mockReturnValue({
    currentLevel: 5,
    nextLevel: 6,
    progress: 50,
  }),
  isInitialized: true,
  initialize: jest.fn().mockResolvedValue(undefined),
};

jest.mock("src/features/experience/ExperienceManager.js", () => ({
  getExperienceManager: jest.fn(() => Promise.resolve(mockExperienceManager)),
  ExperienceManager: jest.fn(() => mockExperienceManager),
}));

// Mock embeds
jest.mock("src/commands/general/level/embeds.js", () => ({
  createLevelEmbed: jest.fn(() => ({
    data: {
      title: "Level",
      description: "User level information",
    },
  })),
}));

// Mock response messages
jest.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: jest.fn((options) => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
}));

import { handleLevel } from "../../../../src/commands/general/level/handlers.js";

describe("Level Command", () => {
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
    mockExperienceManager.getUserData.mockResolvedValue({
      totalXP: 1000,
      level: 5,
    });
    mockExperienceManager.calculateProgress.mockReturnValue({
      currentLevel: 5,
      nextLevel: 6,
      progress: 50,
    });

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
      },
      guild: {
        id: "guild123",
        name: "Test Guild",
        members: {
          cache: {
            get: jest.fn().mockReturnValue({
              id: "user123",
              user: { id: "user123" },
            }),
          },
        },
      },
      options: {
        getUser: jest.fn().mockReturnValue(null),
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

  describe("handleLevel", () => {
    it("should display level for current user", async () => {
      // Inject mocks directly
      const mockGetDatabaseManager = jest.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest.fn().mockResolvedValue(mockExperienceManager);

      await handleLevel(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should display level for specified user", async () => {
      mockInteraction.options.getUser.mockReturnValue({
        id: "other-user",
        tag: "OtherUser#5678",
      });

      // Inject mocks directly
      const mockGetDatabaseManager = jest.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest.fn().mockResolvedValue(mockExperienceManager);

      await handleLevel(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
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
      const mockGetDatabaseManager = jest.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest.fn().mockResolvedValue(mockExperienceManager);

      await handleLevel(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle user not found", async () => {
      mockInteraction.options.getUser.mockReturnValue({
        id: "unknown-user",
      });
      mockInteraction.guild.members.cache.get.mockReturnValue(null);

      // Inject mocks directly
      const mockGetDatabaseManager = jest.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = jest.fn().mockResolvedValue(mockExperienceManager);

      await handleLevel(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});

