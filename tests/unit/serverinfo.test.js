import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock logger
jest.mock("src/utils/logger.js", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock theme/config dependencies first
jest.mock("src/config/theme.js", () => ({
  THEME: {
    PRIMARY: 0x5865f2,
    ERROR: 0xed4245,
  },
  UI_COMPONENTS: {
    createFooter: jest.fn((text, icon) => ({ text, icon })),
  },
}));

// Mock embeds - define mocks outside factory (like help.test.js pattern)
const mockCreateServerInfoEmbed = jest.fn(() => ({
  data: {
    title: "Server Information",
    description: "Server info",
  },
}));
const mockCreateErrorEmbed = jest.fn(() => ({
  data: {
    title: "Error",
    description: "An error occurred",
  },
}));

jest.mock("src/commands/general/serverinfo/embeds.js", () => ({
  createServerInfoEmbed: mockCreateServerInfoEmbed,
  createErrorEmbed: mockCreateErrorEmbed,
}));

import { execute } from "../../src/commands/general/serverinfo/handlers.js";
import {
  formatNumber,
  getChannelCounts,
  getMemberCounts,
  calculateServerAge,
  formatFeatures,
} from "../../src/commands/general/serverinfo/utils.js";

describe("Serverinfo Command", () => {
  let mockInteraction;
  let mockClient;
  let mockGuild;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGuild = {
      id: "guild123",
      name: "Test Guild",
      description: "Test server description",
      ownerId: "owner123",
      createdAt: new Date("2020-01-01"),
      memberCount: 100,
      fetch: jest.fn().mockResolvedValue(undefined),
      members: {
        cache: (() => {
          const member1 = {
            id: "member1",
            user: { id: "member1", bot: false },
            presence: { status: "online" },
          };
          const member2 = {
            id: "member2",
            user: { id: "member2", bot: true },
            presence: { status: "offline" },
          };
          const members = [member1, member2];
          return {
            size: members.length,
            filter: jest.fn(callback => {
              const filtered = members.filter(callback);
              return {
                size: filtered.length,
              };
            }),
          };
        })(),
        fetch: jest.fn().mockResolvedValue(undefined),
      },
      channels: {
        cache: (() => {
          const channel1 = {
            id: "channel1",
            type: 0,
            isTextBased: jest.fn().mockReturnValue(true),
            isThread: jest.fn().mockReturnValue(false),
            isVoiceBased: jest.fn().mockReturnValue(false),
          };
          const channel2 = {
            id: "channel2",
            type: 2,
            isTextBased: jest.fn().mockReturnValue(false),
            isThread: jest.fn().mockReturnValue(false),
            isVoiceBased: jest.fn().mockReturnValue(true),
          };
          const channels = [channel1, channel2];
          return {
            size: channels.length,
            filter: jest.fn(callback => {
              const filtered = channels.filter(callback);
              return {
                size: filtered.length,
              };
            }),
          };
        })(),
      },
      roles: {
        cache: new Map([
          ["role1", { id: "role1", name: "Member" }],
          ["role2", { id: "role2", name: "Admin" }],
        ]),
        size: 2,
      },
      emojis: {
        cache: new Map(),
        size: 0,
      },
      stickers: {
        cache: new Map(),
        size: 0,
      },
      premiumTier: 0,
      premiumSubscriptionCount: 0,
      iconURL: jest.fn().mockReturnValue("https://example.com/icon.png"),
      bannerURL: jest.fn().mockReturnValue(null),
    };

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
        displayAvatarURL: jest
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
      },
      guild: mockGuild,
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      user: {
        id: "bot123",
        tag: "TestBot#1234",
        displayAvatarURL: jest
          .fn()
          .mockReturnValue("https://example.com/bot.png"),
      },
    };
  });

  describe("execute", () => {
    it("should display server info successfully", async () => {
      // Set memberCount to match cache size so fetch is skipped
      mockGuild.memberCount = mockGuild.members.cache.size;

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockGuild.fetch).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle missing guild", async () => {
      mockInteraction.guild = null;

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should fetch members for accurate counts", async () => {
      mockGuild.memberCount = 5000;
      mockGuild.members.cache.size = 100;

      await execute(mockInteraction, mockClient);

      expect(mockGuild.members.fetch).toHaveBeenCalled();
    });

    it("should handle member fetch timeout", async () => {
      mockGuild.memberCount = 10000;
      mockGuild.members.cache.size = 100;
      mockGuild.members.fetch.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve(undefined);
            }, 100);
          }),
      );

      // Mock setTimeout to simulate timeout
      jest.useFakeTimers();
      const executePromise = execute(mockInteraction, mockClient);
      jest.advanceTimersByTime(35000); // Exceed timeout
      jest.useRealTimers();

      await executePromise;

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Mock editReply to succeed even when deferReply fails
      mockInteraction.editReply.mockResolvedValue(undefined);
      // Make deferReply throw an error
      mockInteraction.deferReply.mockRejectedValue(new Error("Test error"));

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe("formatNumber", () => {
    it("should format numbers with commas", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1000000)).toBe("1,000,000");
      expect(formatNumber(123)).toBe("123");
    });
  });

  describe("getChannelCounts", () => {
    it("should count channels correctly", () => {
      const counts = getChannelCounts(mockGuild);
      expect(counts.total).toBe(2);
      expect(mockGuild.channels.cache.filter).toHaveBeenCalled();
    });

    it("should handle empty channels", () => {
      mockGuild.channels.cache = {
        size: 0,
        filter: jest.fn().mockReturnValue({ size: 0 }),
      };
      const counts = getChannelCounts(mockGuild);
      expect(counts.total).toBe(0);
    });
  });

  describe("getMemberCounts", () => {
    it("should count members correctly", () => {
      const counts = getMemberCounts(mockGuild);
      expect(counts.total).toBe(100);
      expect(counts.cached).toBe(2);
      expect(counts.uncached).toBe(98);
      expect(mockGuild.members.cache.filter).toHaveBeenCalled();
    });

    it("should handle empty members cache", () => {
      mockGuild.members.cache = {
        size: 0,
        filter: jest.fn().mockReturnValue({ size: 0 }),
      };
      const counts = getMemberCounts(mockGuild);
      expect(counts.total).toBe(100);
      expect(counts.cached).toBe(0);
      expect(counts.uncached).toBe(100);
    });
  });

  describe("calculateServerAge", () => {
    it("should calculate age in years", () => {
      const createdAt = new Date("2020-01-01");
      const result = calculateServerAge(createdAt);
      expect(result).toContain("year");
    });

    it("should calculate age in months", () => {
      const createdAt = new Date();
      createdAt.setMonth(createdAt.getMonth() - 2);
      const result = calculateServerAge(createdAt);
      expect(result).toContain("month");
    });

    it("should calculate age in days", () => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 5);
      const result = calculateServerAge(createdAt);
      expect(result).toContain("day");
    });

    it("should return Unknown for null date", () => {
      const result = calculateServerAge(null);
      expect(result).toBe("Unknown");
    });
  });

  describe("formatFeatures", () => {
    it("should format features correctly", () => {
      const features = ["COMMUNITY", "PARTNERED", "VERIFIED"];
      const result = formatFeatures(features);
      expect(result).toContain("Community");
      expect(result).toContain("Partnered");
      expect(result).toContain("Verified");
    });

    it("should return None for empty features", () => {
      const result = formatFeatures([]);
      expect(result).toBe("None");
    });

    it("should return None for null features", () => {
      const result = formatFeatures(null);
      expect(result).toBe("None");
    });

    it("should handle unknown features", () => {
      const features = ["UNKNOWN_FEATURE"];
      const result = formatFeatures(features);
      expect(result).toContain("UNKNOWN_FEATURE");
    });
  });
});
