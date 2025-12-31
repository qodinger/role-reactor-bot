import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

// Setup common mocks before imports
setupCommonMocks();

// Mock theme config
vi.mock("src/config/theme.js", () => ({
  EMOJIS: {
    EIGHTBALL: {
      VERY_POSITIVE: "✨",
      POSITIVE: "🌟",
      NEUTRAL: "🔮",
      NEGATIVE: "💫",
      VERY_NEGATIVE: "⚡",
      STARS: "⭐",
      CRYSTAL: "💎",
      DESTINY: "🎯",
      UNIVERSE: "🌌",
      MAGIC: "🔮",
      ENERGY: "⚡",
      FORTUNE: "🍀",
      COSMIC: "🌠",
      MYSTICAL: "🔮",
      ENIGMA: "❓",
      MYSTERY: "🔍",
      WISDOM: "📜",
      FATE: "🎲",
      PROPHECY: "🔮",
    },
  },
}));

// Mock embeds
vi.mock("src/commands/general/8ball/embeds.js", () => ({
  create8BallEmbed: vi.fn((question, response, _category, _user) => ({
    data: {
      title: "Magic 8-Ball",
      description: `**Question:** ${question}\n**Answer:** ${response.text}`,
      color: 0x5865f2,
    },
  })),
  createErrorEmbed: vi.fn(() => ({
    data: {
      title: "Error",
      description: "An error occurred",
      color: 0xed4245,
    },
  })),
}));

import { execute } from "../../../../src/commands/general/8ball/handlers.js";

describe("8ball Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue("Will I succeed?"),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient();
  });

  describe("execute", () => {
    it("should respond with a magic 8-ball answer", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({
        ephemeral: false,
      });
      expect(mockInteraction.options.getString).toHaveBeenCalledWith(
        "question",
      );
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle different question types", async () => {
      const questions = [
        "Will I succeed?",
        "Should I do this?",
        "Can I win?",
        "What should I do?",
        "When will this happen?",
        "Why is this happening?",
        "How can I do this?",
      ];

      for (const question of questions) {
        mockInteraction.options.getString.mockReturnValue(question);
        await execute(mockInteraction, mockClient);
        expect(mockInteraction.editReply).toHaveBeenCalled();
      }
    });

    it("should analyze positive sentiment questions", async () => {
      mockInteraction.options.getString.mockReturnValue(
        "Will I have great success and achieve my dreams?",
      );

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(callArgs.embeds).toBeDefined();
    });

    it("should analyze negative sentiment questions", async () => {
      mockInteraction.options.getString.mockReturnValue(
        "Will I fail and have terrible problems?",
      );

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle personal questions", async () => {
      mockInteraction.options.getString.mockReturnValue(
        "Will I have a good career in my future?",
      );

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle urgent questions", async () => {
      mockInteraction.options.getString.mockReturnValue(
        "This is urgent! Should I do this immediately?",
      );

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle neutral questions", async () => {
      mockInteraction.options.getString.mockReturnValue("What is the weather?");

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Mock an error during question processing
      mockInteraction.options.getString.mockImplementation(() => {
        throw new Error("Test error");
      });

      await expect(execute(mockInteraction, mockClient)).resolves.not.toThrow();

      // Should attempt to send error embed
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should defer reply before processing", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalledBefore(
        mockInteraction.editReply,
      );
    });
  });
});
