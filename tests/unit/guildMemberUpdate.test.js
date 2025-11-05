import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
} from "@jest/globals";

// Mock logger - Jest hoists this and resolves from project root
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
jest.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: jest.fn().mockResolvedValue({
    connectionManager: {
      db: null,
      connect: jest.fn().mockResolvedValue(undefined),
    },
  }),
}));

// Mock storage manager to prevent MongoDB connections
jest.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: jest.fn().mockResolvedValue({
    save: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn(),
    isInitialized: true,
  }),
}));

// Mock Core utils to prevent MongoDB connections
jest.mock("src/commands/general/core/utils.js", () => ({
  getUserCorePriority: jest.fn().mockResolvedValue({
    hasCore: false,
    tier: null,
    priority: 0,
  }),
  getCoreRateLimitMultiplier: jest.fn().mockReturnValue(1.0),
}));

// Mock rate limiter to prevent MongoDB connections
jest.mock("src/utils/discord/rateLimiter.js", () => ({
  isVoiceOperationRateLimited: jest.fn().mockResolvedValue(false),
  getVoiceOperationRemainingTime: jest.fn().mockReturnValue(0),
  isRateLimited: jest.fn().mockResolvedValue(false),
}));

// Mock voice restrictions utility
const mockEnforceVoiceRestrictions = jest.fn();
jest.mock("src/utils/discord/voiceRestrictions.js", () => ({
  enforceVoiceRestrictions: jest.fn((...args) =>
    mockEnforceVoiceRestrictions(...args),
  ),
}));

// Import execute after mocks are set up
let execute;
beforeAll(async () => {
  const module = await import("../../src/events/guildMemberUpdate.js");
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
    jest.clearAllMocks();

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
    oldRoleMap.map = jest.fn(callback => {
      return Array.from(oldRoleMap.values()).map(callback);
    });

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
      fetch: jest.fn().mockResolvedValue(undefined),
    };

    // Mock new member (after role change)
    const newRoleMap = new Map([
      [role1.id, role1],
      [role2.id, role2],
    ]);
    newRoleMap.map = jest.fn(callback => {
      return Array.from(newRoleMap.values()).map(callback);
    });

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
      fetch: jest.fn().mockResolvedValue(undefined),
    };

    // Mock client
    mockClient = {
      user: { tag: "TestBot#1234" },
    };

    // Default mock for enforceVoiceRestrictions
    mockEnforceVoiceRestrictions.mockResolvedValue({
      disconnected: false,
      muted: false,
      unmuted: false,
    });
  });

  describe("Role Change Detection", () => {
    it("should process role changes when member is in voice channel", async () => {
      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(newMember.fetch).toHaveBeenCalled();
      expect(mockEnforceVoiceRestrictions).toHaveBeenCalledWith(
        newMember,
        "Role change detected",
      );
    });

    it("should skip when roles have not changed", async () => {
      // Same roles in both old and new member
      const sameRoleMap = new Map([
        [role1.id, role1],
        [role2.id, role2],
      ]);
      sameRoleMap.map = jest.fn(callback => {
        return Array.from(sameRoleMap.values()).map(callback);
      });

      oldMember.roles.cache = sameRoleMap;
      newMember.roles.cache = sameRoleMap;

      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });

    it("should skip when member is not in voice channel", async () => {
      newMember.voice.channel = null;

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });

    it("should detect role changes even when role count is the same", async () => {
      // Same number of roles but different roles
      const role3 = { id: "role3", name: "Role3" };

      const oldRoleMap = new Map([
        [role1.id, role1],
        [role2.id, role2],
      ]);
      oldRoleMap.map = jest.fn(callback => {
        return Array.from(oldRoleMap.values()).map(callback);
      });
      oldMember.roles.cache = oldRoleMap;

      const newRoleMap = new Map([
        [role1.id, role1],
        [role3.id, role3],
      ]);
      newRoleMap.map = jest.fn(callback => {
        return Array.from(newRoleMap.values()).map(callback);
      });
      newMember.roles.cache = newRoleMap;

      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(newMember.fetch).toHaveBeenCalled();
      expect(mockEnforceVoiceRestrictions).toHaveBeenCalled();
    });

    it("should skip when member is not in a guild", async () => {
      newMember.guild = null;
      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });
  });

  describe("Voice Restriction Enforcement", () => {
    it("should handle successful voice restriction enforcement", async () => {
      newMember.voice.channel = mockVoiceChannel;
      mockEnforceVoiceRestrictions.mockResolvedValue({
        disconnected: false,
        muted: true,
        unmuted: false,
      });

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).toHaveBeenCalledWith(
        newMember,
        "Role change detected",
      );
    });

    it("should handle unmute result from voice restriction enforcement", async () => {
      newMember.voice.channel = mockVoiceChannel;
      mockEnforceVoiceRestrictions.mockResolvedValue({
        disconnected: false,
        muted: false,
        unmuted: true,
      });

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).toHaveBeenCalled();
    });

    it("should handle errors from voice restriction enforcement gracefully", async () => {
      // Ensure roles changed so the event handler processes
      const role3 = { id: "role3", name: "Role3" };
      const newRoleMap = new Map([
        [role1.id, role1],
        [role2.id, role2],
        [role3.id, role3],
      ]);
      newRoleMap.map = jest.fn(callback => {
        return Array.from(newRoleMap.values()).map(callback);
      });
      newMember.roles.cache = newRoleMap;
      newMember.voice.channel = mockVoiceChannel;

      mockEnforceVoiceRestrictions.mockResolvedValue({
        disconnected: false,
        muted: false,
        unmuted: false,
        error: "Missing permissions",
      });

      // Should not throw
      await expect(
        execute(oldMember, newMember, mockClient, {
          enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
        }),
      ).resolves.not.toThrow();

      expect(mockEnforceVoiceRestrictions).toHaveBeenCalled();
    });

    it("should handle member fetch errors gracefully", async () => {
      newMember.voice.channel = mockVoiceChannel;
      newMember.fetch.mockRejectedValue(new Error("Fetch failed"));

      // Should not throw
      await expect(
        execute(oldMember, newMember, mockClient, {
          enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
        }),
      ).resolves.not.toThrow();

      // Should still try to enforce restrictions
      expect(mockEnforceVoiceRestrictions).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      newMember.voice.channel = mockVoiceChannel;
      mockEnforceVoiceRestrictions.mockRejectedValue(
        new Error("Unexpected error"),
      );

      // Should not throw
      await expect(
        execute(oldMember, newMember, mockClient),
      ).resolves.not.toThrow();
    });

    it("should handle null guild gracefully", async () => {
      newMember.guild = null;
      newMember.voice.channel = mockVoiceChannel;

      await execute(oldMember, newMember, mockClient, {
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });
  });
});
