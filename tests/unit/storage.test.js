import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { handleStorageCheck } from "../../src/commands/developer/storage/handlers.js";

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
  isDeveloper: jest.fn((userId) => userId === "dev123"),
}));

// Mock embeds
jest.mock("src/commands/developer/storage/embeds.js", () => ({
  createStorageEmbed: jest.fn().mockResolvedValue({
    data: {
      title: "Storage Status",
      description: "Storage configuration and status",
    },
  }),
}));

describe("Storage Command", () => {
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
    };
  });

  describe("handleStorageCheck", () => {
    it("should allow developer users to execute storage check", async () => {
      mockInteraction.user.id = "dev123";

      await handleStorageCheck(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should deny non-developer users", async () => {
      mockInteraction.user.id = "user123";

      await handleStorageCheck(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("Permission Denied"),
        flags: expect.any(Number),
      });
    });

    it("should handle errors gracefully", async () => {
      mockInteraction.editReply.mockRejectedValue(new Error("Edit failed"));

      await expect(
        handleStorageCheck(mockInteraction, mockClient, true),
      ).resolves.not.toThrow();
    });
  });
});

