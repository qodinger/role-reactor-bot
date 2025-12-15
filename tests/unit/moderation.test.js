import { describe, test, expect, beforeEach, jest } from "@jest/globals";

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

// Mock database manager to prevent MongoDB connections
const mockDbManager = {
  guildSettings: { exists: true },
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

// Mock storage manager to prevent MongoDB connections
const mockStorageManager = {
  read: jest.fn().mockResolvedValue({}),
  write: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue({}),
  set: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true),
  initialize: jest.fn().mockResolvedValue(undefined),
  isInitialized: true,
};

jest.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: jest.fn().mockResolvedValue(mockStorageManager),
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

// Mock theme
jest.mock("src/config/theme.js", () => ({
  THEME: {
    PRIMARY: 0x5865f2,
    ERROR: 0xed4245,
    SUCCESS: 0x57f287,
    WARNING: 0xfee75c,
  },
  EMOJIS: {
    MODERATION: {
      WARN: "⚠️",
      TIMEOUT: "⏱️",
      BAN: "🚫",
      KICK: "👢",
      UNBAN: "🔓",
      DEFAULT: "📝",
    },
  },
}));

// Test file for moderation functionality

import {
  canModerateMember,
  botCanModerateMember,
  validateTimeoutDuration,
  formatDuration,
  parseMultipleUsers,
} from "../../src/commands/admin/moderation/utils.js";

describe("Moderation - Core Functionality", () => {
  describe("canModerateMember", () => {
    test("should allow moderating when moderator has higher role", () => {
      const moderator = {
        id: "mod123",
        permissions: {
          has: jest.fn().mockReturnValue(false), // Not admin
        },
        roles: {
          highest: {
            position: 10,
            name: "Moderator",
          },
        },
      };

      const target = {
        id: "target123",
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const result = canModerateMember(moderator, target);
      expect(result.canModerate).toBe(true);
    });

    test("should reject moderating yourself", () => {
      const moderator = {
        id: "user123",
        permissions: {
          has: jest.fn().mockReturnValue(false),
        },
        roles: {
          highest: {
            position: 10,
            name: "Moderator",
          },
        },
      };

      const target = {
        id: "user123", // Same ID
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const result = canModerateMember(moderator, target);
      expect(result.canModerate).toBe(false);
      expect(result.reason).toContain("cannot moderate yourself");
    });

    test("should reject moderating bots", () => {
      const moderator = {
        id: "mod123",
        permissions: {
          has: jest.fn().mockReturnValue(false),
        },
        roles: {
          highest: {
            position: 10,
            name: "Moderator",
          },
        },
      };

      const target = {
        id: "bot123",
        user: {
          bot: true, // Bot user
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const result = canModerateMember(moderator, target);
      expect(result.canModerate).toBe(false);
      expect(result.reason).toContain("cannot moderate bots");
    });

    test("should reject moderating server owner", () => {
      const moderator = {
        id: "mod123",
        permissions: {
          has: jest.fn().mockReturnValue(false),
        },
        roles: {
          highest: {
            position: 10,
            name: "Moderator",
          },
        },
      };

      const target = {
        id: "owner123",
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123", // Same as target ID
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const result = canModerateMember(moderator, target);
      expect(result.canModerate).toBe(false);
      expect(result.reason).toContain("cannot moderate the server owner");
    });

    test("should allow admin to moderate regardless of hierarchy", () => {
      const moderator = {
        id: "admin123",
        permissions: {
          has: jest.fn().mockReturnValue(true), // Has admin permission
        },
        roles: {
          highest: {
            position: 5, // Lower position
            name: "Admin",
          },
        },
      };

      const target = {
        id: "target123",
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 10, // Higher position
            name: "VIP",
          },
        },
      };

      const result = canModerateMember(moderator, target);
      expect(result.canModerate).toBe(true);
    });

    test("should reject when moderator has equal or lower role", () => {
      const moderator = {
        id: "mod123",
        permissions: {
          has: jest.fn().mockReturnValue(false),
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const target = {
        id: "target123",
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 10, // Higher position
            name: "VIP",
          },
        },
      };

      const result = canModerateMember(moderator, target);
      expect(result.canModerate).toBe(false);
      expect(result.reason).toContain("equal or higher roles");
    });

    test("should handle invalid member data", () => {
      const result1 = canModerateMember(null, {});
      expect(result1.canModerate).toBe(false);
      expect(result1.reason).toContain("Invalid member data");

      const result2 = canModerateMember({}, null);
      expect(result2.canModerate).toBe(false);
      expect(result2.reason).toContain("Invalid member data");
    });
  });

  describe("botCanModerateMember", () => {
    test("should allow bot to moderate when bot has higher role", () => {
      const botMember = {
        roles: {
          highest: {
            position: 10,
            name: "Bot Role",
          },
        },
      };

      const target = {
        id: "target123",
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const result = botCanModerateMember(botMember, target);
      expect(result.canModerate).toBe(true);
    });

    test("should reject moderating bots", () => {
      const botMember = {
        roles: {
          highest: {
            position: 10,
            name: "Bot Role",
          },
        },
      };

      const target = {
        id: "bot123",
        user: {
          bot: true,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const result = botCanModerateMember(botMember, target);
      expect(result.canModerate).toBe(false);
      expect(result.reason).toContain("Cannot moderate bots");
    });

    test("should reject moderating server owner", () => {
      const botMember = {
        roles: {
          highest: {
            position: 10,
            name: "Bot Role",
          },
        },
      };

      const target = {
        id: "owner123",
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 5,
            name: "Member",
          },
        },
      };

      const result = botCanModerateMember(botMember, target);
      expect(result.canModerate).toBe(false);
      expect(result.reason).toContain("Cannot moderate the server owner");
    });

    test("should reject when bot has equal or lower role", () => {
      const botMember = {
        roles: {
          highest: {
            position: 5,
            name: "Bot Role",
          },
        },
      };

      const target = {
        id: "target123",
        user: {
          bot: false,
        },
        guild: {
          ownerId: "owner123",
        },
        roles: {
          highest: {
            position: 10,
            name: "VIP",
          },
        },
      };

      const result = botCanModerateMember(botMember, target);
      expect(result.canModerate).toBe(false);
      expect(result.reason).toContain("not above");
    });

    test("should handle invalid member data", () => {
      const result1 = botCanModerateMember(null, {});
      expect(result1.canModerate).toBe(false);
      expect(result1.reason).toContain("Invalid member data");

      const result2 = botCanModerateMember({}, null);
      expect(result2.canModerate).toBe(false);
      expect(result2.reason).toContain("Invalid member data");
    });
  });

  describe("validateTimeoutDuration", () => {
    test("should validate correct duration formats", () => {
      const validDurations = [
        "10s",
        "30s",
        "1m",
        "30m",
        "1h",
        "2h",
        "1d",
        "7d",
        "1w",
        "2w",
      ];

      validDurations.forEach(duration => {
        const result = validateTimeoutDuration(duration);
        expect(result.valid).toBe(true);
      });
    });

    test("should reject invalid duration formats", () => {
      const invalidDurations = [
        "invalid",
        "1x",
        "abc",
        "1",
        "m",
        "",
        "0s",
        "-1h",
      ];

      invalidDurations.forEach(duration => {
        const result = validateTimeoutDuration(duration);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test("should reject durations too short (less than 10 seconds)", () => {
      const result = validateTimeoutDuration("5s");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 10 seconds");
    });

    test("should reject durations too long (more than 28 days)", () => {
      const result = validateTimeoutDuration("29d");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("28 days");
    });

    test("should accept minimum duration (10 seconds)", () => {
      const result = validateTimeoutDuration("10s");
      expect(result.valid).toBe(true);
    });

    test("should accept maximum duration (28 days)", () => {
      const result = validateTimeoutDuration("28d");
      expect(result.valid).toBe(true);
    });

    test("should parse duration correctly", () => {
      const result1 = validateTimeoutDuration("1h");
      expect(result1.valid).toBe(true);
      expect(result1.milliseconds).toBe(3600000); // 1 hour in ms

      const result2 = validateTimeoutDuration("1d");
      expect(result2.valid).toBe(true);
      expect(result2.milliseconds).toBe(86400000); // 1 day in ms

      const result3 = validateTimeoutDuration("1w");
      expect(result3.valid).toBe(true);
      expect(result3.milliseconds).toBe(604800000); // 1 week in ms
    });
  });

  describe("formatDuration", () => {
    test("should format milliseconds correctly", () => {
      expect(formatDuration(1000)).toBe("1 second");
      expect(formatDuration(60000)).toBe("1 minute");
      expect(formatDuration(3600000)).toBe("1 hour");
      expect(formatDuration(86400000)).toBe("1 day");
      expect(formatDuration(604800000)).toBe("1 week");
    });

    test("should format plural durations", () => {
      expect(formatDuration(2000)).toBe("2 seconds");
      expect(formatDuration(120000)).toBe("2 minutes");
      expect(formatDuration(7200000)).toBe("2 hours");
      expect(formatDuration(172800000)).toBe("2 days");
      expect(formatDuration(1209600000)).toBe("2 weeks");
    });

    test("should prioritize weeks over days", () => {
      expect(formatDuration(604800000)).toBe("1 week"); // 7 days
      expect(formatDuration(1209600000)).toBe("2 weeks"); // 14 days
    });

    test("should prioritize days over hours", () => {
      expect(formatDuration(86400000)).toBe("1 day"); // 24 hours
      expect(formatDuration(172800000)).toBe("2 days"); // 48 hours
    });

    test("should handle zero duration", () => {
      expect(formatDuration(0)).toBe("0 seconds");
    });

    test("should handle large durations", () => {
      expect(formatDuration(2419200000)).toBe("4 weeks"); // 28 days
    });
  });

  describe("parseMultipleUsers", () => {
    let mockGuild;
    let mockClient;

    beforeEach(() => {
      mockGuild = {
        id: "guild123",
        members: {
          cache: new Map(),
          fetch: jest.fn(),
        },
      };

      mockClient = {
        users: {
          fetch: jest.fn(),
        },
      };
    });

    test("should parse single user mention", async () => {
      const user = {
        id: "123456789",
        tag: "TestUser#1234",
        username: "TestUser",
      };

      mockClient.users.fetch.mockResolvedValue(user);

      const result = await parseMultipleUsers(
        "<@123456789>",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(1);
      expect(result.validUsers[0].user.id).toBe("123456789");
    });

    test("should parse multiple user mentions separated by commas", async () => {
      const user1 = {
        id: "123456789",
        tag: "TestUser1#1234",
        username: "TestUser1",
      };
      const user2 = {
        id: "987654321",
        tag: "TestUser2#5678",
        username: "TestUser2",
      };

      mockClient.users.fetch
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      const result = await parseMultipleUsers(
        "<@123456789>, <@987654321>",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(2);
    });

    test("should parse multiple user mentions separated by semicolons", async () => {
      const user1 = {
        id: "123456789",
        tag: "TestUser1#1234",
        username: "TestUser1",
      };
      const user2 = {
        id: "987654321",
        tag: "TestUser2#5678",
        username: "TestUser2",
      };

      mockClient.users.fetch
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      const result = await parseMultipleUsers(
        "<@123456789>; <@987654321>",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(2);
    });

    test("should parse user IDs (17-19 digits)", async () => {
      const user = {
        id: "123456789012345678",
        tag: "TestUser#1234",
        username: "TestUser",
      };

      mockClient.users.fetch.mockResolvedValue(user);
      mockGuild.members.fetch = jest
        .fn()
        .mockRejectedValue(new Error("Member not found"));

      const result = await parseMultipleUsers(
        "123456789012345678",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(1);
      expect(result.validUsers[0].user.id).toBe("123456789012345678");
    });

    test("should reject user IDs that are too short", async () => {
      const result = await parseMultipleUsers(
        "123456789",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain("No valid users found");
    });

    test("should handle concatenated mentions without spaces", async () => {
      const user1 = {
        id: "123456789",
        tag: "TestUser1#1234",
        username: "TestUser1",
      };
      const user2 = {
        id: "987654321",
        tag: "TestUser2#5678",
        username: "TestUser2",
      };

      mockClient.users.fetch
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      const result = await parseMultipleUsers(
        "<@123456789><@987654321>",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(2);
    });

    test("should reject empty input", async () => {
      const result = await parseMultipleUsers("", mockGuild, mockClient);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("No users provided");
    });

    test("should reject invalid user IDs", async () => {
      mockClient.users.fetch.mockRejectedValue(new Error("Unknown User"));

      const result = await parseMultipleUsers(
        "invalid123",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should handle mixed valid and invalid users", async () => {
      const user1 = {
        id: "123456789",
        tag: "TestUser1#1234",
        username: "TestUser1",
      };

      mockClient.users.fetch
        .mockResolvedValueOnce(user1)
        .mockRejectedValueOnce(new Error("Unknown User"));

      const result = await parseMultipleUsers(
        "<@123456789>, <@invalid>",
        mockGuild,
        mockClient,
      );

      // Should return valid with only the valid user
      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(1);
      expect(result.validUsers[0].user.id).toBe("123456789");
    });

    test("should handle users in guild (member fetch succeeds)", async () => {
      const user = {
        id: "123456789012345678",
        tag: "TestUser#1234",
        username: "TestUser",
      };

      const member = {
        id: "123456789012345678",
        user,
      };

      mockClient.users.fetch.mockResolvedValue(user);
      mockGuild.members.fetch = jest.fn().mockResolvedValue(member);

      const result = await parseMultipleUsers(
        "<@123456789012345678>",
        mockGuild,
        mockClient,
      );

      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(1);
      expect(result.validUsers[0].member).toBe(member);
      expect(mockClient.users.fetch).toHaveBeenCalled();
    });
  });
});
