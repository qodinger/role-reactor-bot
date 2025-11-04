import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { handlePerformanceCheck } from "../../src/commands/developer/performance/handlers.js";

// Mock logger
jest.mock("src/utils/logger.js", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock permissions
jest.mock("src/utils/discord/permissions.js", () => ({
  isDeveloper: jest.fn(userId => userId === "dev123"),
}));

// Mock embeds
jest.mock("src/commands/developer/performance/embeds.js", () => ({
  createPerformanceEmbed: jest.fn().mockResolvedValue({
    data: {
      title: "Performance Metrics",
      description: "Bot performance statistics",
    },
  }),
}));

describe("Performance Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInteraction = {
      user: {
        id: "dev123",
        tag: "Developer#1234",
      },
      guild: {
        id: "guild123",
      },
      isRepliable: jest.fn().mockReturnValue(true),
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      user: {
        id: "bot123",
        tag: "TestBot#1234",
      },
      ws: {
        ping: 50,
      },
      uptime: 3600000,
      guilds: {
        cache: {
          size: 10,
        },
      },
    };
  });

  describe("handlePerformanceCheck", () => {
    it("should allow developer users to execute performance check", async () => {
      mockInteraction.user.id = "dev123";

      await handlePerformanceCheck(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should deny non-developer users", async () => {
      mockInteraction.user.id = "user123";

      await handlePerformanceCheck(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("Permission Denied"),
        flags: expect.any(Number),
      });
    });

    it("should handle errors gracefully", async () => {
      mockInteraction.editReply.mockRejectedValue(new Error("Edit failed"));

      await expect(
        handlePerformanceCheck(mockInteraction, mockClient, true),
      ).resolves.not.toThrow();
    });

    it("should handle non-deferred replies", async () => {
      mockInteraction.user.id = "dev123";

      await handlePerformanceCheck(mockInteraction, mockClient, false);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });
  });
});
