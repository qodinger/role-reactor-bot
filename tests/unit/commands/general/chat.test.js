import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("src/config/theme.js", () => ({
  THEME: { PRIMARY: 0x5865f2, ERROR: 0xed4245 },
  EMOJIS: { STATUS: { LOADING: "⏳" } },
}));

vi.mock("src/config/emojis.js", () => ({
  emojiConfig: { customEmojis: { core: "⚡" } },
}));

vi.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: vi.fn(opts => ({ embeds: [{ data: opts }] })),
  successEmbed: vi.fn(opts => ({ embeds: [{ data: opts }] })),
}));

vi.mock("src/utils/ai/constants.js", () => ({
  STREAMING_ENABLED: false,
}));

vi.mock("src/utils/ai/chatService.js", () => ({
  chatService: {
    aiService: { isEnabled: vi.fn().mockReturnValue(true) },
    chat: vi.fn().mockResolvedValue({
      content: "This is a test response.",
      requestId: "req-123",
    }),
    cancelRequest: vi.fn(),
  },
}));

vi.mock("src/utils/ai/aiCreditManager.js", () => ({
  checkAICredits: vi.fn().mockResolvedValue({
    hasCredits: true,
    creditsNeeded: 0.1,
  }),
  getAICreditInfo: vi.fn().mockResolvedValue({
    credits: 10,
    requestsRemaining: 100,
  }),
  deductAICredits: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("src/commands/general/balance/utils.js", () => ({
  getUserData: vi.fn().mockResolvedValue({ credits: 5, userId: "user123" }),
}));

import { execute } from "../../../../src/commands/general/chat/handlers.js";

describe("Chat Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      options: {
        getString: vi.fn().mockReturnValue("What is 2+2?"),
        getInteger: vi.fn().mockReturnValue(null),
        getBoolean: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(null),
        getChannel: vi.fn().mockReturnValue(null),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient();
  });

  describe("execute", () => {
    it("should reply with error when AI is disabled", async () => {
      const { chatService } = await import("src/utils/ai/chatService.js");
      chatService.aiService.isEnabled.mockReturnValue(false);

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should reply with error when user has insufficient credits", async () => {
      const { checkAICredits } = await import(
        "src/utils/ai/aiCreditManager.js"
      );
      checkAICredits.mockResolvedValue({
        hasCredits: false,
        creditsNeeded: 0.1,
      });

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const { chatService } = await import("src/utils/ai/chatService.js");
      chatService.chat.mockRejectedValue(new Error("AI service error"));

      await expect(
        execute(mockInteraction, mockClient),
      ).resolves.not.toThrow();
    });
  });
});
