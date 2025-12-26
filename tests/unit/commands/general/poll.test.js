import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// IMPORTANT: Mocks must be defined BEFORE importing the module under test

// Mock logger
jest.mock("src/utils/logger.js", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

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

// Mock database manager to prevent MongoDB connections
// This MUST be hoisted before any imports
const mockDbManager = {
  guildSettings: { exists: true }, // Non-empty object to prevent reconnect
  welcomeSettings: { exists: true }, // Non-empty object to prevent reconnect
  goodbyeSettings: {},
  connectionManager: {
    db: { collection: jest.fn() },
    connect: jest.fn().mockResolvedValue(undefined),
  },
  connect: jest.fn().mockResolvedValue(undefined),
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
};

jest.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: jest.fn().mockResolvedValue(mockDbManager),
  DatabaseManager: jest.fn(() => mockDbManager),
}));

// Mock storage manager - prevent initialization to avoid MongoDB connection
// This MUST be hoisted before any imports
jest.mock("src/utils/storage/storageManager.js", () => {
  // Create mock functions inside the factory
  const mockGetPollById = jest.fn();
  const mockGetPollsByGuild = jest.fn().mockResolvedValue([]);
  const mockDeletePoll = jest.fn().mockResolvedValue(true);

  const mockInstance = {
    getPollById: mockGetPollById,
    getPollsByGuild: mockGetPollsByGuild,
    deletePoll: mockDeletePoll,
    read: jest.fn().mockResolvedValue({}),
    write: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
  };

  return {
    getStorageManager: jest.fn().mockResolvedValue(mockInstance),
    StorageManager: jest.fn(() => mockInstance),
  };
});

// Mock response messages
jest.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: jest.fn(options => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
  successEmbed: jest.fn(options => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
}));

// Mock modals
jest.mock("src/commands/general/poll/modals.js", () => {
  // Create mock functions inside the factory
  const mockCreatePollCreationMenuFn = jest.fn().mockReturnValue({
    embed: { data: { title: "Create Poll" } },
    components: [],
  });

  return {
    createPollCreationModal: jest.fn().mockReturnValue({
      data: { title: "Create Poll" },
    }),
    createPollCreationMenu: mockCreatePollCreationMenuFn,
    createPollCreationMenuWithSelections: jest.fn().mockReturnValue({
      embed: { data: { title: "Create Poll" } },
      components: [],
    }),
  };
});

// Import handlers after all mocks are set up
import {
  handlePollList,
  handlePollEnd,
  handlePollCreateModal,
} from "../../../../src/commands/general/poll/handlers.js";

describe("Poll Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
      },
      guild: {
        id: "guild123",
      },
      channel: {
        id: "channel123",
      },
      isRepliable: jest.fn().mockReturnValue(true),
      options: {
        getString: jest.fn(),
        getInteger: jest.fn(),
      },
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      showModal: jest.fn().mockResolvedValue(undefined),
      member: {
        permissions: {
          has: jest.fn().mockReturnValue(false),
        },
      },
    };

    mockClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue({
          messages: {
            fetch: jest.fn().mockResolvedValue({
              poll: {
                end: jest.fn().mockResolvedValue(undefined),
              },
            }),
          },
        }),
      },
    };
  });

  describe("handlePollList", () => {
    it("should list polls for a guild", async () => {
      // Create mock storage manager
      const mockStorage = {
        getPollsByGuild: jest
          .fn()
          .mockResolvedValueOnce([
            { id: "poll1", question: "Test poll", isActive: true },
          ]),
      };

      // Inject mock directly
      const mockGetStorageManager = jest.fn().mockResolvedValue(mockStorage);

      await handlePollList(mockInteraction, mockClient, true, {
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Create mock storage manager
      const mockStorage = {
        getPollsByGuild: jest
          .fn()
          .mockRejectedValueOnce(new Error("Database error")),
      };

      // Inject mock directly
      const mockGetStorageManager = jest.fn().mockResolvedValue(mockStorage);

      await expect(
        handlePollList(mockInteraction, mockClient, true, {
          getStorageManager: mockGetStorageManager,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("handlePollEnd", () => {
    it("should handle poll not found", async () => {
      // Create mock storage manager
      const mockStorage = {
        getPollById: jest.fn().mockResolvedValueOnce(null),
      };

      // Inject mock directly
      const mockGetStorageManager = jest.fn().mockResolvedValue(mockStorage);
      mockInteraction.options.getString.mockReturnValue("invalid-poll-id");

      await handlePollEnd(mockInteraction, mockClient, true, {
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(callArgs).toBeDefined();
    });

    it("should handle permission denied", async () => {
      // Create mock storage manager
      const mockStorage = {
        getPollById: jest.fn().mockResolvedValueOnce({
          creatorId: "other-user",
          isActive: true,
        }),
      };

      // Inject mock directly
      const mockGetStorageManager = jest.fn().mockResolvedValue(mockStorage);
      mockInteraction.options.getString.mockReturnValue("poll123");

      await handlePollEnd(mockInteraction, mockClient, true, {
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe("handlePollCreateModal", () => {
    it("should show poll creation modal", async () => {
      // handlePollCreateModal calls editReply or reply, not showModal
      await handlePollCreateModal(mockInteraction, mockClient, false);

      // Should call reply when not deferred
      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });
});
