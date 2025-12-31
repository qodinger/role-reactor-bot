import { describe, it, expect, beforeEach, vi } from "vitest";

// IMPORTANT: Mocks must be defined BEFORE importing the module under test

// Mock logger
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

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

// Mock database manager to prevent MongoDB connections
// This MUST be hoisted before any imports
const mockDbManager = {
  guildSettings: { exists: true }, // Non-empty object to prevent reconnect
  welcomeSettings: { exists: true }, // Non-empty object to prevent reconnect
  goodbyeSettings: {},
  connectionManager: {
    db: { collection: vi.fn() },
    connect: vi.fn().mockResolvedValue(undefined),
  },
  connect: vi.fn().mockResolvedValue(undefined),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
};

vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue(mockDbManager),
  DatabaseManager: vi.fn(() => mockDbManager),
}));

// Mock storage manager - prevent initialization to avoid MongoDB connection
// This MUST be hoisted before any imports
vi.mock("src/utils/storage/storageManager.js", () => {
  // Create mock functions inside the factory
  const mockGetPollById = vi.fn();
  const mockGetPollsByGuild = vi.fn().mockResolvedValue([]);
  const mockDeletePoll = vi.fn().mockResolvedValue(true);

  const mockInstance = {
    getPollById: mockGetPollById,
    getPollsByGuild: mockGetPollsByGuild,
    deletePoll: mockDeletePoll,
    read: vi.fn().mockResolvedValue({}),
    write: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
  };

  return {
    getStorageManager: vi.fn().mockResolvedValue(mockInstance),
    StorageManager: vi.fn(() => mockInstance),
  };
});

// Mock response messages
vi.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: vi.fn(options => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
  successEmbed: vi.fn(options => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
}));

// Mock modals
vi.mock("src/commands/general/poll/modals.js", () => {
  // Create mock functions inside the factory
  const mockCreatePollCreationMenuFn = vi.fn().mockReturnValue({
    embed: { data: { title: "Create Poll" } },
    components: [],
  });

  return {
    createPollCreationModal: vi.fn().mockReturnValue({
      data: { title: "Create Poll" },
    }),
    createPollCreationMenu: mockCreatePollCreationMenuFn,
    createPollCreationMenuWithSelections: vi.fn().mockReturnValue({
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
    vi.clearAllMocks();

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
      },
      guild: {
        id: "guild123",
        iconURL: vi.fn().mockReturnValue("https://example.com/icon.png"),
      },
      channel: {
        id: "channel123",
      },
      isRepliable: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn(),
        getInteger: vi.fn(),
        getBoolean: vi.fn(),
      },
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
      showModal: vi.fn().mockResolvedValue(undefined),
      member: {
        permissions: {
          has: vi.fn().mockReturnValue(false),
        },
      },
    };

    mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          messages: {
            fetch: vi.fn().mockResolvedValue({
              poll: {
                end: vi.fn().mockResolvedValue(undefined),
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
        getPollsByGuild: vi
          .fn()
          .mockResolvedValueOnce([
            { id: "poll1", question: "Test poll", isActive: true },
          ]),
      };

      // Inject mock directly
      const mockGetStorageManager = vi.fn().mockResolvedValue(mockStorage);

      await handlePollList(mockInteraction, mockClient, true, {
        getStorageManager: mockGetStorageManager,
      });

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Create mock storage manager
      const mockStorage = {
        getPollsByGuild: vi
          .fn()
          .mockRejectedValueOnce(new Error("Database error")),
      };

      // Inject mock directly
      const mockGetStorageManager = vi.fn().mockResolvedValue(mockStorage);

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
        getPollById: vi.fn().mockResolvedValueOnce(null),
      };

      // Inject mock directly
      const mockGetStorageManager = vi.fn().mockResolvedValue(mockStorage);
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
        getPollById: vi.fn().mockResolvedValueOnce({
          creatorId: "other-user",
          isActive: true,
        }),
      };

      // Inject mock directly
      const mockGetStorageManager = vi.fn().mockResolvedValue(mockStorage);
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
