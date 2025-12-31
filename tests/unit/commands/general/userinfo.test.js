import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock logger
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock theme/config dependencies first
vi.mock("src/config/theme.js", () => ({
  THEME: {
    PRIMARY: 0x5865f2,
    ERROR: 0xed4245,
  },
  UI_COMPONENTS: {
    createFooter: vi.fn((text, icon) => ({ text, icon })),
  },
}));

// Mock MongoDB and storage manager (needed for getWarnCount)
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

const mockStorageManager = {
  read: vi.fn().mockResolvedValue({}),
  write: vi.fn().mockResolvedValue(true),
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(true),
  save: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
  initialize: vi.fn().mockResolvedValue(undefined),
  isInitialized: true,
};

vi.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue(mockStorageManager),
  StorageManager: vi.fn(() => mockStorageManager),
}));

// Mock moderation utils (needed for getWarnCount)
vi.mock("src/commands/admin/moderation/utils.js", () => ({
  getWarnCount: vi.fn().mockResolvedValue(0),
  canModerateMember: vi.fn(),
  botCanModerateMember: vi.fn(),
  validateTimeoutDuration: vi.fn(),
  formatDuration: vi.fn(),
  parseMultipleUsers: vi.fn(),
}));

// Mock embeds - define mocks outside factory (like help.test.js pattern)
const mockCreateUserInfoEmbed = vi.fn(() => ({
  data: {
    title: "User Information",
    description: "User info",
  },
}));
const mockCreateErrorEmbed = vi.fn(() => ({
  data: {
    title: "Error",
    description: "An error occurred",
  },
}));

vi.mock("src/commands/general/userinfo/embeds.js", () => ({
  createUserInfoEmbed: mockCreateUserInfoEmbed,
  createErrorEmbed: mockCreateErrorEmbed,
}));

import { execute } from "../../../../src/commands/general/userinfo/handlers.js";
import {
  formatUserFlags,
  formatRoles,
  formatUserStatus,
  formatUserActivity,
} from "../../../../src/commands/general/userinfo/utils.js";

describe("Userinfo Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
        username: "TestUser",
        displayName: "TestUser",
        bot: false,
        createdAt: new Date("2020-01-01"),
        displayAvatarURL: vi
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
        flags: {
          bitfield: 0,
          has: vi.fn().mockReturnValue(false),
        },
      },
      guild: {
        id: "guild123",
        name: "Test Guild",
        members: {
          cache: {
            get: vi.fn(),
          },
        },
        presences: {
          cache: {
            get: vi.fn(),
          },
        },
      },
      options: {
        getUser: vi.fn().mockReturnValue(null),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      user: {
        id: "bot123",
        tag: "TestBot#1234",
      },
      guilds: {
        cache: {
          get: vi.fn().mockReturnValue({
            id: "guild123",
            presences: {
              cache: {
                get: vi.fn(),
              },
            },
          }),
        },
      },
    };
  });

  describe("execute", () => {
    it("should display user info for current user", async () => {
      // Create a mock Collection for roles
      const mockRolesCollection = {
        size: 1,
        filter: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            map: vi.fn().mockReturnValue(["<@&role1>"]),
          }),
        }),
        get: vi.fn(),
      };

      const mockMember = {
        id: "user123",
        joinedAt: new Date("2021-01-01"),
        roles: {
          cache: mockRolesCollection,
        },
        permissions: {
          bitfield: 0,
          has: vi.fn().mockReturnValue(false),
        },
        displayName: "TestUser",
        nickname: null,
        premiumSince: null,
        communicationDisabledUntil: null,
        voice: {
          channel: null,
        },
        presence: null,
      };

      mockInteraction.guild.members.cache.get.mockReturnValue(mockMember);

      // Ensure editReply doesn't throw
      mockInteraction.editReply.mockResolvedValue(undefined);

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should display user info for specified user", async () => {
      const targetUser = {
        id: "target123",
        tag: "TargetUser#5678",
        username: "TargetUser",
        displayName: "TargetUser",
        bot: false,
        createdAt: new Date("2019-01-01"),
        displayAvatarURL: vi
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
        flags: {
          bitfield: 0,
          has: vi.fn().mockReturnValue(false),
        },
      };

      const mockRolesCollection = {
        size: 0,
        filter: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            map: vi.fn().mockReturnValue([]),
          }),
        }),
      };

      const mockMember = {
        id: "target123",
        joinedAt: new Date("2021-06-01"),
        roles: {
          cache: mockRolesCollection,
        },
        permissions: {
          bitfield: 0,
          has: vi.fn().mockReturnValue(false),
        },
        displayName: "TargetUser",
        nickname: "Target",
        premiumSince: null,
        communicationDisabledUntil: null,
        voice: {
          channel: null,
        },
        presence: null,
      };

      mockInteraction.options.getUser.mockReturnValue(targetUser);
      mockInteraction.guild.members.cache.get.mockReturnValue(mockMember);

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle user not in guild", async () => {
      const targetUser = {
        id: "target123",
        tag: "TargetUser#5678",
        username: "TargetUser",
        displayName: "TargetUser",
        bot: false,
        createdAt: new Date("2019-01-01"),
        displayAvatarURL: vi
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
        flags: {
          bitfield: 0,
          has: vi.fn().mockReturnValue(false),
        },
      };

      mockInteraction.options.getUser.mockReturnValue(targetUser);
      mockInteraction.guild.members.cache.get.mockReturnValue(undefined);

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockInteraction.deferReply.mockRejectedValue(new Error("Test error"));

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe("formatUserFlags", () => {
    it("should return None for empty flags", () => {
      const flags = {
        bitfield: 0,
        has: vi.fn().mockReturnValue(false),
      };

      const result = formatUserFlags(flags);
      expect(result).toEqual(["None"]);
    });

    it("should return None for null flags", () => {
      const result = formatUserFlags(null);
      expect(result).toEqual(["None"]);
    });

    it("should format valid flags", () => {
      const flags = {
        bitfield: 1,
        has: vi.fn(flag => flag === "Staff"),
      };

      const result = formatUserFlags(flags);
      expect(result).toContain("Discord Staff");
    });

    it("should handle invalid flags gracefully", () => {
      const flags = {
        bitfield: 1,
        has: vi.fn(() => {
          throw new Error("Invalid flag");
        }),
      };

      const result = formatUserFlags(flags);
      expect(result).toEqual(["None"]);
    });
  });

  describe("formatRoles", () => {
    it("should handle empty roles", () => {
      const roles = {
        size: 0,
      };
      const result = formatRoles(roles);
      expect(result).toBe("None");
    });

    it("should handle null roles", () => {
      const result = formatRoles(null);
      expect(result).toBe("None");
    });

    it("should call filter on roles collection", () => {
      const mockFiltered = {
        sort: vi.fn().mockReturnValue({
          map: vi.fn().mockReturnValue(["<@&role1>"]),
        }),
      };
      const roles = {
        size: 1,
        filter: vi.fn().mockReturnValue(mockFiltered),
      };

      formatRoles(roles);
      expect(roles.filter).toHaveBeenCalled();
    });
  });

  describe("formatUserStatus", () => {
    it("should return offline for null presence", () => {
      const result = formatUserStatus(null);
      expect(result).toEqual({
        label: "Offline",
        emoji: "⚫",
        status: "offline",
      });
    });

    it("should format online status", () => {
      const presence = {
        status: "online",
      };

      const result = formatUserStatus(presence);
      expect(result).toEqual({
        label: "Online",
        emoji: "🟢",
        status: "online",
      });
    });

    it("should format idle status", () => {
      const presence = {
        status: "idle",
      };

      const result = formatUserStatus(presence);
      expect(result).toEqual({
        label: "Idle",
        emoji: "🟡",
        status: "idle",
      });
    });

    it("should format dnd status", () => {
      const presence = {
        status: "dnd",
      };

      const result = formatUserStatus(presence);
      expect(result).toEqual({
        label: "Do Not Disturb",
        emoji: "🔴",
        status: "dnd",
      });
    });
  });

  describe("formatUserActivity", () => {
    it("should return null for no activities", () => {
      const presence = {
        activities: [],
      };

      const result = formatUserActivity(presence);
      expect(result).toBeNull();
    });

    it("should format playing activity", () => {
      const presence = {
        activities: [
          {
            type: 0, // Playing
            name: "Game Name",
            details: "Playing details",
            state: "Game state",
          },
        ],
      };

      const result = formatUserActivity(presence);
      expect(result).toContain("Playing:");
      expect(result).toContain("Playing details");
    });

    it("should format streaming activity", () => {
      const presence = {
        activities: [
          {
            type: 1, // Streaming
            name: "Stream Name",
            url: "https://twitch.tv/streamer",
          },
        ],
      };

      const result = formatUserActivity(presence);
      expect(result).toContain("Streaming:");
      expect(result).toContain("Stream Name");
    });

    it("should filter out custom status", () => {
      const presence = {
        activities: [
          {
            type: 4, // Custom Status
            state: "Custom status text",
          },
        ],
      };

      const result = formatUserActivity(presence);
      expect(result).toBe("**Custom Status:** Custom status text");
    });
  });
});
