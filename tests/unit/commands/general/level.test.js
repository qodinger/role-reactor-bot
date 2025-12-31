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
  getUserData: vi.fn().mockResolvedValue({
    totalXP: 1000,
    level: 5,
  }),
  calculateProgress: vi.fn().mockReturnValue({
    currentLevel: 5,
    totalXP: 1000,
    xpInCurrentLevel: 500,
    xpNeededForNextLevel: 1000,
    progress: 50,
    xpForNextLevel: 2000,
  }),
  isInitialized: true,
  initialize: vi.fn().mockResolvedValue(undefined),
};

vi.mock("src/features/experience/ExperienceManager.js", () => ({
  getExperienceManager: vi.fn(() => Promise.resolve(mockExperienceManager)),
  ExperienceManager: vi.fn(() => mockExperienceManager),
}));

// Mock embeds
vi.mock("src/commands/general/level/embeds.js", () => ({
  createLevelEmbed: vi.fn(() => ({
    data: {
      title: "Level",
      description: "User level information",
    },
  })),
}));

// Mock response messages
vi.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: vi.fn((options) => ({
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
    vi.clearAllMocks();

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
      totalXP: 1000,
      xpInCurrentLevel: 500,
      xpNeededForNextLevel: 1000,
      progress: 50,
      xpForNextLevel: 2000,
    });

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
        displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
        displayName: "TestUser",
        username: "TestUser",
      },
      guild: {
        id: "guild123",
        name: "Test Guild",
        members: {
          cache: {
            get: vi.fn().mockReturnValue({
              id: "user123",
              user: { id: "user123" },
            }),
          },
        },
      },
      options: {
        getUser: vi.fn().mockReturnValue(null),
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

  describe("handleLevel", () => {
    it("should display level for current user", async () => {
      // Inject mocks directly
      const mockGetDatabaseManager = vi.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi.fn().mockResolvedValue(mockExperienceManager);

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
        displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar2.png"),
        displayName: "OtherUser",
        username: "OtherUser",
      });

      // Inject mocks directly
      const mockGetDatabaseManager = vi.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi.fn().mockResolvedValue(mockExperienceManager);

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
      const mockGetDatabaseManager = vi.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi.fn().mockResolvedValue(mockExperienceManager);

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
      const mockGetDatabaseManager = vi.fn().mockResolvedValue(mockDbManagerInstance);
      const mockGetExperienceManager = vi.fn().mockResolvedValue(mockExperienceManager);

      await handleLevel(mockInteraction, mockClient, {
        getDatabaseManager: mockGetDatabaseManager,
        getExperienceManager: mockGetExperienceManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});

