import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleStorageCheck } from "../../../../src/commands/developer/storage/handlers.js";

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
vi.mock("src/commands/developer/storage/embeds.js", () => ({
  createStorageEmbed: vi.fn().mockResolvedValue({
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
    vi.clearAllMocks();

    mockInteraction = {
      user: {
        id: "dev123",
        tag: "Developer#1234",
      },
      guild: {
        id: "guild123",
      },
      isRepliable: vi.fn().mockReturnValue(true),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
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
