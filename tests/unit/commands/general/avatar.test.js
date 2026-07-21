import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("../../../../src/config/theme.js", () => ({
  THEME: { PRIMARY: 0x5865f2, ERROR: 0xed4245 },
  EMOJIS: {},
}));

vi.mock("../../../../src/config/emojis.js", () => ({
  emojiConfig: { customEmojis: { core: "⚡" } },
}));

vi.mock("../../../../src/utils/ai/multiProviderAIService.js", () => ({
  multiProviderAIService: {
    isEnabled: vi.fn().mockReturnValue(true),
    getImageProvider: vi.fn().mockReturnValue('stability'),
  },
}));

vi.mock("../../../../src/utils/ai/avatarService.js", () => ({
  generateAvatar: vi.fn().mockResolvedValue({
    imageBuffer: Buffer.alloc(5000, 0xff),
    provider: "stability",
    model: "sd3.5-large-turbo",
  }),
}));

vi.mock("../../../../src/utils/ai/aiCreditManager.js", () => ({
  checkAIImageCredits: vi.fn().mockResolvedValue({
    userData: { credits: 10 },
    creditsNeeded: 1,
    hasCredits: true,
  }),
  checkAndDeductAIImageCredits: vi.fn().mockResolvedValue({
    success: true,
    creditsDeducted: 1,
    creditsRemaining: 9,
    deductionBreakdown: {},
  }),
  refundAIImageCredits: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../../../src/utils/ai/errorMessages.js", () => ({
  getUserFacingErrorMessage: vi.fn().mockReturnValue("Something went wrong."),
}));

vi.mock("../../../../src/commands/general/avatar/utils/generationHistory.js", () => ({
  GenerationHistory: {
    recordGeneration: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../src/commands/general/avatar/embeds.js", () => ({
  createErrorEmbed: vi.fn().mockReturnValue({ data: { title: "Error" } }),
  createCoreEmbed: vi.fn().mockReturnValue({ data: { title: "Insufficient Credits" } }),
  createHelpEmbed: vi.fn().mockReturnValue({ data: { title: "Help" } }),
  createLoadingEmbed: vi.fn().mockReturnValue({ data: { title: "Loading..." } }),
  createSuccessEmbed: vi.fn().mockReturnValue({ data: { title: "Success" } }),
  createWarningEmbed: vi.fn().mockReturnValue({ data: { title: "Warning" } }),
  createAvatarValidationEmbed: vi.fn().mockReturnValue({ data: { title: "Validation" } }),
}));

vi.mock("../../../../src/commands/general/avatar/utils.js", () => ({
  validatePrompt: vi.fn().mockResolvedValue({ isValid: true, prompt: "a cat" }),
  getExplicitNSFWKeywords: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../../src/config/ai.js", () => ({
  getAIConfig: vi.fn().mockReturnValue({
    models: {
      features: {
        avatar: { provider: "stability", model: "sd3.5-large-turbo" },
      },
    },
  }),
}));

import { handleAvatarGeneration } from "../../../../src/commands/general/avatar/handlers.js";

describe("Avatar Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      options: {
        getString: vi.fn((name) => (name === "prompt" ? "a cool cat" : null)),
        getInteger: vi.fn().mockReturnValue(null),
        getBoolean: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(null),
        getChannel: vi.fn().mockReturnValue(null),
      },
      channel: {
        id: "channel123",
        name: "general",
        type: 0,
        nsfw: false,
        send: vi.fn().mockResolvedValue({}),
        isThread: vi.fn().mockReturnValue(false),
      },
      guild: {
        id: "guild123",
        name: "Test Guild",
        explicitContentFilter: 0,
        features: [],
        iconURL: vi.fn().mockReturnValue("https://example.com/icon.png"),
        members: { cache: { get: vi.fn() }, me: { permissions: { has: vi.fn().mockReturnValue(true) } } },
        channels: { cache: { get: vi.fn() } },
      },
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      isRepliable: vi.fn().mockReturnValue(true),
    });

    mockClient = createMockClient();
  });

  describe("handleAvatarGeneration", () => {
    it("should send validation embed when AI is disabled", async () => {
      const { multiProviderAIService } = await import("../../../../src/utils/ai/multiProviderAIService.js"
      );
      multiProviderAIService.isEnabled.mockReturnValue(false);

      await handleAvatarGeneration(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should send validation embed when prompt is invalid", async () => {
      const { validatePrompt } = await import("../../../../src/commands/general/avatar/utils.js"
      );
      validatePrompt.mockResolvedValue({
        isValid: false,
        reason: "Prompt contains disallowed content",
      });

      await handleAvatarGeneration(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should send insufficient credits embed when user has no credits", async () => {
      const { checkAIImageCredits } = await import("../../../../src/utils/ai/aiCreditManager.js"
      );
      checkAIImageCredits.mockResolvedValue({
        userData: { credits: 0 },
        creditsNeeded: 1,
        hasCredits: false,
      });

      await handleAvatarGeneration(mockInteraction, mockClient, true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle generation errors gracefully", async () => {
      const { generateAvatar } = await import("../../../../src/utils/ai/avatarService.js"
      );
      generateAvatar.mockRejectedValue(new Error("API error"));

      await expect(
        handleAvatarGeneration(mockInteraction, mockClient, true),
      ).resolves.not.toThrow();
    });
  });
});
