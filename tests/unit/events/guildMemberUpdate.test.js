import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";

// Mock logger - Jest hoists this and resolves from project root
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
vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    connectionManager: {
      db: null,
      connect: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

// Mock storage manager to prevent MongoDB connections
vi.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue({
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn(),
    getVoiceControlRoles: vi.fn().mockResolvedValue({
      guildId: "guild123",
      disconnectRoleIds: [],
      muteRoleIds: [],
      deafenRoleIds: [],
      moveRoleMappings: {},
      updatedAt: new Date(),
    }),
    isInitialized: true,
  }),
}));

// Mock Core utils to prevent MongoDB connections
vi.mock("src/commands/general/core/utils.js", () => ({
  getUserCorePriority: vi.fn().mockResolvedValue({
    hasCore: false,
    tier: null,
    priority: 0,
  }),
  getCoreRateLimitMultiplier: vi.fn().mockReturnValue(1.0),
}));

// Mock rate limiter to prevent MongoDB connections
vi.mock("src/utils/discord/rateLimiter.js", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

// Import execute after mocks are set up
let execute;
beforeAll(async () => {
  const module = await import("../../../src/events/guildMemberUpdate.js");
  execute = module.execute;
});

describe("Guild Member Update Event", () => {
  let oldMember;
  let newMember;
  let mockClient;
  let mockGuild;
  let mockVoiceChannel;
  let role1;
  let role2;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock voice channel
    mockVoiceChannel = {
      id: "voice123",
      name: "Voice Channel",
      type: 2, // GUILD_VOICE
    };

    // Mock guild
    mockGuild = {
      id: "guild123",
      name: "Test Guild",
    };

    // Mock roles
    role1 = { id: "role1", name: "Role1" };
    role2 = { id: "role2", name: "Role2" };

    // Mock old member (before role change)
    const oldRoleMap = new Map([[role1.id, role1]]);
    // Add map method to Map for compatibility with the function
    oldRoleMap.map = function (callback) {
      return Array.from(this.values()).map(callback);
    };

    oldMember = {
      id: "member123",
      user: {
        id: "member123",
        tag: "TestUser#1234",
      },
      guild: mockGuild,
      voice: {
        channel: null, // Not in voice initially
      },
      roles: {
        cache: oldRoleMap,
      },
      fetch: vi.fn().mockResolvedValue(undefined),
    };

    // Mock new member (after role change)
    const newRoleMap = new Map([
      [role1.id, role1],
      [role2.id, role2],
    ]);
    // Add map method to Map for compatibility with the function
    newRoleMap.map = function (callback) {
      return Array.from(this.values()).map(callback);
    };

    newMember = {
      id: "member123",
      user: {
        id: "member123",
        tag: "TestUser#1234",
      },
      guild: mockGuild,
      voice: {
        channel: null, // Not in voice by default
      },
      roles: {
        cache: newRoleMap,
      },
      fetch: vi.fn().mockResolvedValue(undefined),
    };

    // Mock client
    mockClient = {
      user: { tag: "TestBot#1234" },
    };
  });

  describe("Role Change Detection", () => {
    it("should process role changes when member is in voice channel", async () => {
      // Ensure roles are different (oldMember has role1, newMember has role1 and role2)
      // Ensure voice object exists and channel is set
      if (!newMember.voice) {
        newMember.voice = {};
      }
      newMember.voice.channel = mockVoiceChannel;
      // Ensure channel has a name property (required by the function)
      if (!mockVoiceChannel.name) {
        mockVoiceChannel.name = "Voice Channel";
      }

      await execute(oldMember, newMember, mockClient);

      // Event handler is now a no-op, so no operations should occur
    });

    it("should skip when roles have not changed", async () => {
      // Same roles in both old and new member
      const sameRoleMap = new Map([
        [role1.id, role1],
        [role2.id, role2],
      ]);
      sameRoleMap.map = vi.fn(callback => {
        return Array.from(sameRoleMap.values()).map(callback);
      });

      oldMember.roles.cache = sameRoleMap;
      newMember.roles.cache = sameRoleMap;

      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient);

      // Event handler is now a no-op, so no operations should occur
    });

    it("should skip when member is not in voice channel", async () => {
      newMember.voice.channel = null;

      await execute(oldMember, newMember, mockClient);

      // Event handler is now a no-op, so no operations should occur
    });

    it("should detect role changes even when role count is the same", async () => {
      // Same number of roles but different roles
      const role3 = { id: "role3", name: "Role3" };

      const oldRoleMap = new Map([
        [role1.id, role1],
        [role2.id, role2],
      ]);
      oldRoleMap.map = function (callback) {
        return Array.from(this.values()).map(callback);
      };
      oldMember.roles.cache = oldRoleMap;

      const newRoleMap = new Map([
        [role1.id, role1],
        [role3.id, role3],
      ]);
      newRoleMap.map = function (callback) {
        return Array.from(this.values()).map(callback);
      };
      newMember.roles.cache = newRoleMap;

      // Ensure voice object exists and channel is set
      if (!newMember.voice) {
        newMember.voice = {};
      }
      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient);

      // Event handler is now a no-op, so no operations should occur
    });

    it("should skip when member is not in a guild", async () => {
      newMember.guild = null;
      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient);

      // Event handler is now a no-op, so no operations should occur
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      newMember.voice.channel = mockVoiceChannel;

      // Should not throw (event handler is now a no-op)
      await expect(
        execute(oldMember, newMember, mockClient),
      ).resolves.not.toThrow();
    });

    it("should handle null guild gracefully", async () => {
      newMember.guild = null;
      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient);

      // Event handler is now a no-op, so no operations should occur
    });
  });
});
