import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleHealthCheck } from "../../../../src/commands/developer/health/handlers.js";
import {
  formatMemory,
  formatDuration,
  isHealthy,
  getHealthEmoji,
} from "../../../../src/commands/developer/health/utils.js";

// Mock logger
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock permissions
vi.mock("src/utils/discord/permissions.js", () => ({
  isDeveloper: vi.fn(userId => userId === "dev123"),
}));

// Mock embeds
vi.mock("src/commands/developer/health/embeds.js", () => ({
  createHealthEmbed: vi.fn().mockResolvedValue({
    data: {
      title: "Bot Health Status",
      description: "All systems are operating normally! 🚀",
    },
  }),
}));

describe("Health Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = {
      user: {
        id: "dev123",
        tag: "Developer#1234",
      },
      guild: {
        id: "guild123",
        members: {
          me: {
            roles: { highest: { position: 10 } },
          },
        },
      },
      isRepliable: vi.fn().mockReturnValue(true),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      user: {
        id: "bot123",
        tag: "TestBot#1234",
        displayAvatarURL: vi
          .fn()
          .mockReturnValue("https://example.com/avatar.png"),
      },
      ws: {
        ping: 50,
      },
      uptime: 3600000, // 1 hour
      guilds: {
        cache: {
          size: 10,
        },
      },
    };
  });

  describe("handleHealthCheck", () => {
    it("should allow developer users to execute health check", async () => {
      mockInteraction.user.id = "dev123";

      await handleHealthCheck(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should deny non-developer users", async () => {
      mockInteraction.user.id = "user123";

      await handleHealthCheck(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("Permission Denied"),
        flags: expect.any(Number),
      });
    });

    it("should handle errors gracefully", async () => {
      mockInteraction.editReply.mockRejectedValue(new Error("Edit failed"));

      await expect(
        handleHealthCheck(mockInteraction, mockClient, true),
      ).resolves.not.toThrow();
    });
  });

  describe("Health Utilities", () => {
    describe("formatMemory", () => {
      it("should format bytes correctly", () => {
        expect(formatMemory(0)).toBe("0 B");
        expect(formatMemory(1024)).toBe("1 KB");
        expect(formatMemory(1048576)).toBe("1 MB");
        expect(formatMemory(1073741824)).toBe("1 GB");
      });

      it("should format decimal values correctly", () => {
        const result = formatMemory(1536);
        expect(result).toContain("KB");
        expect(parseFloat(result)).toBeCloseTo(1.5, 1);
      });
    });

    describe("formatDuration", () => {
      it("should format milliseconds correctly", () => {
        expect(formatDuration(500)).toBe("500ms");
        expect(formatDuration(1500)).toContain("s");
        expect(formatDuration(65000)).toContain("m");
      });

      it("should format minutes and seconds correctly", () => {
        const result = formatDuration(125000);
        expect(result).toContain("m");
        expect(result).toContain("s");
      });
    });

    describe("isHealthy", () => {
      it("should return true for healthy string values", () => {
        expect(isHealthy("✅ Ready")).toBe(true);
        expect(isHealthy("Good")).toBe(true);
        expect(isHealthy("Ready")).toBe(true);
      });

      it("should return true for healthy number values", () => {
        expect(isHealthy(50)).toBe(true);
        expect(isHealthy(100)).toBe(true);
        expect(isHealthy(500)).toBe(true);
      });

      it("should return false for unhealthy values", () => {
        expect(isHealthy(2000)).toBe(false);
        expect(isHealthy("❌ Error")).toBe(false);
      });

      it("should return true for truthy boolean values", () => {
        expect(isHealthy(true)).toBe(true);
        expect(isHealthy(false)).toBe(false);
      });
    });

    describe("getHealthEmoji", () => {
      it("should return success emoji for healthy values", () => {
        const emoji = getHealthEmoji("✅ Ready");
        expect(emoji).toBeDefined();
      });

      it("should return warning emoji for warning values", () => {
        const emoji = getHealthEmoji("⚠️ High");
        expect(emoji).toBeDefined();
      });

      it("should return error emoji for error values", () => {
        const emoji = getHealthEmoji("❌ Error");
        expect(emoji).toBeDefined();
      });
    });
  });
});
