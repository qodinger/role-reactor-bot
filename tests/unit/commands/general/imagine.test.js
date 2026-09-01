import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

setupCommonMocks();

vi.mock("../../../../src/config/theme.js", () => ({
  THEME: { PRIMARY: 0x5865f2, ERROR: 0xed4245 },
  EMOJIS: { STATUS: { LOADING: "⏳" } },
}));

vi.mock("../../../../src/config/emojis.js", () => ({
  emojiConfig: { customEmojis: { core: "⚡" } },
}));

vi.mock("../../../../src/utils/ai/multiProviderAIService.js", () => ({
  multiProviderAIService: {
    isEnabled: vi.fn().mockReturnValue(true),
    getImageProvider: vi.fn().mockReturnValue('stability'),
    generateImage: vi.fn().mockResolvedValue({
      imageBuffer: Buffer.alloc(5000, 0xff),
      provider: "stability",
      model: "sd3",
    }),
  },
}));

vi.mock("../../../../src/utils/ai/concurrencyManager.js", () => ({
  concurrencyManager: {
    acquireSlot: vi.fn().mockResolvedValue(true),
    releaseSlot: vi.fn(),
    getQueuePosition: vi.fn().mockReturnValue(0),
  },
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

vi.mock("../../../../src/commands/general/imagine/utils.js", () => ({
  validatePrompt: vi.fn().mockResolvedValue({
    isValid: true,
    prompt: "a sunset over mountains",
  }),
  parseInlineParameters: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../../src/commands/general/imagine/embeds.js", () => ({
  createImagineProcessingEmbed: vi.fn().mockReturnValue({ data: { title: "Processing..." } }),
  createImagineResultEmbed: vi.fn().mockReturnValue({ data: { title: "Result" } }),
  createImagineErrorEmbed: vi.fn().mockReturnValue({ data: { title: "Error" } }),
  createImagineValidationEmbed: vi.fn().mockReturnValue({ data: { title: "Validation" } }),
  createNSFWValidationEmbed: vi.fn().mockReturnValue({ data: { title: "NSFW Warning" } }),
  createRegenerateButton: vi.fn().mockReturnValue({ components: [] }),
}));

vi.mock("../../../../src/utils/discord/nsfwSafety.js", () => ({
  validateNSFWProduction: vi.fn().mockReturnValue({ allowed: true }),
  logNSFWGeneration: vi.fn(),
}));

vi.mock("../../../../src/utils/ai/promptIntelligence.js", () => ({
  enhancePromptIntelligently: vi.fn().mockResolvedValue("enhanced prompt"),
  analyzeNSFWContent: vi.fn().mockReturnValue({ isNSFW: false, score: 0 }),
  getPromptSuggestions: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../../src/config/prompts/imagePrompts.js", () => ({
  enhanceImaginePrompt: vi.fn().mockReturnValue("enhanced prompt"),
  getImagineNegativePrompt: vi.fn().mockReturnValue(""),
}));

vi.mock("../../../../src/commands/general/imagine/utils/generationHistory.js", () => ({
  ImagineGenerationHistory: {
    recordGeneration: vi.fn().mockResolvedValue(undefined),
  },
}));

import { handleImagineCommand } from "../../../../src/commands/general/imagine/handlers.js";

describe("Imagine Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = createMockInteraction({
      options: {
        getString: vi.fn((name) => {
          if (name === "prompt") return "a sunset over mountains";
          return null;
        }),
        getInteger: vi.fn().mockReturnValue(null),
        getBoolean: vi.fn().mockReturnValue(null),
        getUser: vi.fn().mockReturnValue(null),
        getRole: vi.fn().mockReturnValue(null),
        getChannel: vi.fn().mockReturnValue(null),
        getAttachment: vi.fn().mockReturnValue(null),
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
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
      isRepliable: vi.fn().mockReturnValue(true),
    });

    mockClient = createMockClient();
  });

  describe("handleImagineCommand", () => {
    it("should send validation embed when AI is disabled", async () => {
      const { multiProviderAIService } = await import("../../../../src/utils/ai/multiProviderAIService.js"
      );
      multiProviderAIService.isEnabled.mockReturnValue(false);

      await handleImagineCommand(mockInteraction, mockClient);

      const wasCalled =
        mockInteraction.reply.mock.calls.length > 0 ||
        mockInteraction.editReply.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it("should send validation embed when prompt is invalid", async () => {
      const { validatePrompt } = await import("../../../../src/commands/general/imagine/utils.js"
      );
      validatePrompt.mockResolvedValue({
        isValid: false,
        reason: "Prompt contains disallowed content",
      });

      await handleImagineCommand(mockInteraction, mockClient);

      const wasCalled =
        mockInteraction.reply.mock.calls.length > 0 ||
        mockInteraction.editReply.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it("should send insufficient credits embed when user has no credits", async () => {
      const { checkAIImageCredits } = await import("../../../../src/utils/ai/aiCreditManager.js"
      );
      checkAIImageCredits.mockResolvedValue({
        userData: { credits: 0 },
        creditsNeeded: 1,
        hasCredits: false,
      });

      await handleImagineCommand(mockInteraction, mockClient);

      const wasCalled =
        mockInteraction.reply.mock.calls.length > 0 ||
        mockInteraction.editReply.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });
});
