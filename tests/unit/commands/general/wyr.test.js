import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/config/theme.js", () => ({
  EMOJIS: {
    MISC: { HEART: "❤️" },
    NUMBERS: { ONE: "1️⃣", TWO: "2️⃣" },
  },
  THEME: { PRIMARY: 0x5865f2 },
}));

vi.mock("src/commands/general/wyr/embeds.js", () => ({
  createWYREmbed: vi.fn().mockReturnValue({ data: { title: "Would You Rather?" } }),
  createErrorEmbed: vi.fn().mockReturnValue({ data: { title: "Error" } }),
}));

vi.mock("src/commands/general/wyr/utils.js", () => ({
  getRandomWYRQuestion: vi.fn().mockReturnValue({
    option1: "Fly",
    option2: "Be invisible",
  }),
  getUserTitle: vi.fn().mockReturnValue("The Thinker"),
}));

import { execute } from "../../../../src/commands/general/wyr/handlers.js";

describe("WYR Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient();
  });

  describe("execute", () => {
    it("should send a WYR question embed", async () => {
      await execute(mockInteraction, mockClient);

      const wasCalled =
        mockInteraction.reply.mock.calls.length > 0 ||
        mockInteraction.editReply.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      const { getRandomWYRQuestion } = await import(
        "src/commands/general/wyr/utils.js"
      );
      getRandomWYRQuestion.mockImplementation(() => {
        throw new Error("No questions available");
      });

      await expect(
        execute(mockInteraction, mockClient),
      ).resolves.not.toThrow();
    });
  });
});
