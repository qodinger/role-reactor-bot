/**
 * MultiProviderAIService Tests
 *
 * Covers:
 *  - Provider initialization (all 5 providers, including civitai)
 *  - generate() — routing, missing provider, API key enforcement, error propagation
 *  - generateImage() — feature/model resolution, provider dispatch
 *  - generateText() — model resolution, provider dispatch
 *  - generateTextStreaming() — validation, provider dispatch
 *  - getConfig() — shape of returned config
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Shared config fixture ────────────────────────────────────────────────────

const makeConfig = (overrides = {}) => ({
  providers: {
    openrouter: { enabled: true, apiKey: "or-key", name: "OpenRouter" },
    stability: { enabled: true, apiKey: "stab-key", name: "Stability" },
    runpod: {
      enabled: true,
      apiKey: "rp-key",
      endpointId: "ep-1",
      name: "RunPod",
    },
    civitai: { enabled: true, apiKey: "civ-key", name: "Civitai" },
    ...overrides.providers,
  },
  features: {
    aiChat: { enabled: true, provider: "openrouter", model: "gpt-4o" },
    avatar: { enabled: false, provider: "stability", model: "sd3" },
    imagineGeneral: {
      enabled: true,
      provider: "stability",
      model: "stable-diffusion-xl-1024-v1-0",
    },
    imagineNSFW: { enabled: true, provider: "civitai", model: "animagine-xl" },
    ...overrides.features,
  },
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../../../../src/utils/ai/performanceMonitor.js", () => ({
  performanceMonitor: { recordRequest: vi.fn() },
}));

vi.mock("../../../../src/utils/ai/statusMessages.js", () => ({
  AI_STATUS_MESSAGES: {
    MULTIPROVIDER_INITIALIZING: "Initializing...",
  },
}));

// Mock the AI config so loadConfig() always returns our test config
// and configCache is set to the same reference that service.config receives.
vi.mock("../../../../src/config/ai.js", () => ({
  getAIModels: () => makeConfig(),
}));

// Provider mock factory
const mockGenerateImage = vi.fn();
const mockGenerateText = vi.fn();
const mockGenerateTextStreaming = vi.fn();

const makeProviderClass = (name) =>
  vi.fn().mockImplementation(() => ({
    _name: name,
    generateImage: mockGenerateImage,
    generateText: mockGenerateText,
    generateTextStreaming: mockGenerateTextStreaming,
  }));

const MockOpenRouterProvider = makeProviderClass("openrouter");
const MockStabilityProvider = makeProviderClass("stability");
const MockRunPodProvider = makeProviderClass("runpod");
const MockCivitaiProvider = makeProviderClass("civitai");

vi.mock("../../../../src/utils/ai/providers/openRouterProvider.js", () => ({
  OpenRouterProvider: MockOpenRouterProvider,
}));
vi.mock("../../../../src/utils/ai/providers/stabilityProvider.js", () => ({
  StabilityProvider: MockStabilityProvider,
}));
vi.mock(
  "../../../../src/utils/ai/providers/runpodServerlessProvider.js",
  () => ({
    RunPodServerlessProvider: MockRunPodProvider,
  }),
);
vi.mock("../../../../src/utils/ai/providers/civitaiProvider.js", () => ({
  CivitaiProvider: MockCivitaiProvider,
}));

// ProviderManager mock
const mockIsEnabled = vi.fn().mockReturnValue(true);
const mockGetPrimaryProvider = vi.fn().mockReturnValue("stability");
const mockGetImageProvider = vi.fn().mockReturnValue("stability");
const mockGetTextProvider = vi.fn().mockReturnValue("openrouter");

vi.mock("../../../../src/utils/ai/providers/providerManager.js", () => ({
  ProviderManager: vi.fn().mockImplementation(() => ({
    isEnabled: mockIsEnabled,
    getPrimaryProvider: mockGetPrimaryProvider,
    getImageProvider: mockGetImageProvider,
    getTextProvider: mockGetTextProvider,
  })),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MultiProviderAIService", () => {
  let MultiProviderAIService;
  let service;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Re-apply mocks after resetModules
    MockOpenRouterProvider.mockImplementation(() => ({
      _name: "openrouter",
      generateImage: mockGenerateImage,
      generateText: mockGenerateText,
      generateTextStreaming: mockGenerateTextStreaming,
    }));
    MockStabilityProvider.mockImplementation(() => ({
      _name: "stability",
      generateImage: mockGenerateImage,
      generateText: mockGenerateText,
      generateTextStreaming: mockGenerateTextStreaming,
    }));
    MockRunPodProvider.mockImplementation(() => ({
      _name: "runpod",
      generateImage: mockGenerateImage,
      generateText: mockGenerateText,
      generateTextStreaming: mockGenerateTextStreaming,
    }));
    MockCivitaiProvider.mockImplementation(() => ({
      _name: "civitai",
      generateImage: mockGenerateImage,
      generateText: mockGenerateText,
      generateTextStreaming: mockGenerateTextStreaming,
    }));

    mockIsEnabled.mockReturnValue(true);
    mockGetPrimaryProvider.mockReturnValue("stability");
    mockGetImageProvider.mockReturnValue("stability");
    mockGetTextProvider.mockReturnValue("openrouter");

    ({ MultiProviderAIService } = await import(
      "../../../../src/utils/ai/multiProviderAIService.js"
    ));
    service = new MultiProviderAIService();

    // Wait one tick for the async loadConfig() in the constructor to complete
    await new Promise((r) => setTimeout(r, 0));
  });

  // ── 1. Initialization ──────────────────────────────────────────────────────

  describe("constructor — provider initialization", () => {
    it("initialises all 4 provider instances", () => {
      const keys = Object.keys(service.providers);
      expect(keys).toEqual(
        expect.arrayContaining([
          "openrouter",
          "stability",
          "runpod",
          "civitai",
        ]),
      );
    });

    it("includes a civitai provider instance", () => {
      expect(service.providers.civitai).toBeDefined();
    });

    it("creates exactly 4 providers (no extras)", () => {
      expect(Object.keys(service.providers)).toHaveLength(4);
    });
  });

  // ── 2. Delegating methods ──────────────────────────────────────────────────

  describe("delegating methods", () => {
    it("isEnabled() delegates to ProviderManager", () => {
      mockIsEnabled.mockReturnValue(false);
      expect(service.isEnabled()).toBe(false);
    });

    it("getPrimaryProvider() delegates to ProviderManager", () => {
      mockGetPrimaryProvider.mockReturnValue("civitai");
      expect(service.getPrimaryProvider()).toBe("civitai");
    });

    it("getImageProvider(false) delegates to ProviderManager", () => {
      mockGetImageProvider.mockReturnValue("stability");
      expect(service.getImageProvider(false)).toBe("stability");
    });

    it("getImageProvider(true) passes isNSFW=true to ProviderManager", () => {
      mockGetImageProvider.mockReturnValue("civitai");
      expect(service.getImageProvider(true)).toBe("civitai");
      expect(mockGetImageProvider).toHaveBeenCalledWith(true);
    });

    it("getTextProvider() delegates to ProviderManager", () => {
      mockGetTextProvider.mockReturnValue("openrouter");
      expect(service.getTextProvider()).toBe("openrouter");
    });
  });

  // ── 3. getProvider() ───────────────────────────────────────────────────────

  describe("getProvider()", () => {
    it("returns the civitai provider instance", async () => {
      const p = await service.getProvider("civitai");
      expect(p).toBeDefined();
      expect(p._name).toBe("civitai");
    });

    it("returns null for an unknown provider key", async () => {
      const p = await service.getProvider("unknown");
      expect(p).toBeNull();
    });

    it("returns all expected providers", async () => {
      for (const key of [
        "openrouter",
        "stability",
        "runpod",
        "civitai",
      ]) {
        const p = await service.getProvider(key);
        expect(p).not.toBeNull();
      }
    });
  });

  // ── 4. generate() ─────────────────────────────────────────────────────────

  describe("generate()", () => {
    // generate() calls loadConfig() and then checks `configCache !== this.config`.
    // Since we mock src/config/ai.js to return makeConfig(), configCache will be
    // populated with that value. After the constructor's async loadConfig() resolves
    // (we await a tick in beforeEach), service.config === configCache, so the
    // hot-reload branch is skipped and our service.config assignments are honoured.

    it("throws when no image provider is available", async () => {
      mockGetImageProvider.mockReturnValue(null);
      await expect(
        service.generate({ type: "image", prompt: "a cat" }),
      ).rejects.toThrow(/image generation is currently unavailable/i);
    });

    it("throws when no text provider is available", async () => {
      mockGetTextProvider.mockReturnValue(null);
      await expect(
        service.generate({ type: "text", prompt: "hello" }),
      ).rejects.toThrow(/AI chat is currently unavailable/i);
    });

    it("throws for unknown type with no primary provider", async () => {
      mockGetPrimaryProvider.mockReturnValue(null);
      await expect(
        service.generate({ type: "video", prompt: "fly" }),
      ).rejects.toThrow(/AI features are currently disabled/i);
    });

    it("throws when explicitly forced provider is disabled", async () => {
      // Temporarily override config so civitai is disabled
      service.config.providers.civitai = {
        enabled: false,
        apiKey: "civ-key",
        name: "Civitai",
      };
      await expect(
        service.generate({
          type: "image",
          prompt: "art",
          provider: "civitai",
        }),
      ).rejects.toThrow(/temporarily disabled/i);
    });

    it("throws when provider has no apiKey", async () => {
      // Remove apiKey from stability
      service.config.providers.stability = {
        enabled: true,
        name: "Stability",
      };
      mockGetImageProvider.mockReturnValue("stability");
      await expect(
        service.generate({ type: "image", prompt: "art" }),
      ).rejects.toThrow(/not properly configured/i);
    });

    it("routes image generation to generateImage()", async () => {
      const spy = vi
        .spyOn(service, "generateImage")
        .mockResolvedValue({ imageBuffer: Buffer.from("img"), imageUrl: "url" });
      mockGetImageProvider.mockReturnValue("stability");

      await service.generate({
        type: "image",
        prompt: "a dog",
        config: { featureName: "imagineGeneral" },
      });

      expect(spy).toHaveBeenCalledWith(
        "a dog",
        expect.any(Object),
        "stability",
        null,
      );
    });

    it("routes text generation to generateText()", async () => {
      const spy = vi
        .spyOn(service, "generateText")
        .mockResolvedValue({ text: "hello" });
      mockGetTextProvider.mockReturnValue("openrouter");

      await service.generate({ type: "text", prompt: "greet me" });

      expect(spy).toHaveBeenCalledWith(
        "greet me",
        expect.any(Object),
        "openrouter",
      );
    });

    it("throws when image prompt is not a string", async () => {
      mockGetImageProvider.mockReturnValue("stability");
      await expect(
        service.generate({ type: "image", prompt: ["not", "a", "string"] }),
      ).rejects.toThrow(/must be a string/i);
    });

    it("propagates errors from the provider (no fallback)", async () => {
      vi.spyOn(service, "generateImage").mockRejectedValue(
        new Error("Provider exploded"),
      );
      mockGetImageProvider.mockReturnValue("stability");

      await expect(
        service.generate({ type: "image", prompt: "landscape" }),
      ).rejects.toThrow("Provider exploded");
    });

    it("passes progressCallback through to generateImage", async () => {
      const spy = vi
        .spyOn(service, "generateImage")
        .mockResolvedValue({ imageBuffer: Buffer.from("x"), imageUrl: "u" });
      const cb = vi.fn();
      mockGetImageProvider.mockReturnValue("stability");

      await service.generate({
        type: "image",
        prompt: "sky",
        config: { featureName: "imagineGeneral" },
        progressCallback: cb,
      });

      expect(spy).toHaveBeenCalledWith(
        "sky",
        expect.any(Object),
        "stability",
        cb,
      );
    });
  });

  // ── 5. generateImage() ────────────────────────────────────────────────────

  describe("generateImage()", () => {
    it("throws when no model is configured for the feature", async () => {
      service.config.features.imagineGeneral = {
        enabled: true,
        provider: "stability",
        // no model
      };

      await expect(
        service.generateImage(
          "art",
          { featureName: "imagineGeneral" },
          "stability",
        ),
      ).rejects.toThrow(/no model configured/i);
    });

    it("throws when provider instance is not found", async () => {
      service.providers = {}; // wipe all providers
      await expect(
        service.generateImage(
          "art",
          { featureName: "imagineGeneral" },
          "stability",
        ),
      ).rejects.toThrow(/internal error/i);
    });

    it("dispatches to the provider's generateImage with correct args", async () => {
      mockGenerateImage.mockResolvedValue({
        imageBuffer: Buffer.from("img"),
        imageUrl: "http://example.com/img.png",
      });

      const result = await service.generateImage(
        "a sunset",
        { featureName: "imagineGeneral" },
        "stability",
        null,
      );

      expect(mockGenerateImage).toHaveBeenCalledWith(
        "a sunset",
        "stable-diffusion-xl-1024-v1-0",
        expect.objectContaining({ featureName: "imagineGeneral" }),
        null,
      );
      expect(result.imageUrl).toBe("http://example.com/img.png");
    });

    it("derives featureName from isNSFW flag when not provided", async () => {
      mockGenerateImage.mockResolvedValue({
        imageBuffer: Buffer.from("x"),
        imageUrl: "u",
      });

      await service.generateImage("nsfw art", { isNSFW: true }, "civitai");

      expect(mockGenerateImage).toHaveBeenCalledWith(
        "nsfw art",
        "animagine-xl",
        expect.objectContaining({ featureName: "imagineNSFW" }),
        null,
      );
    });
  });

  // ── 6. generateText() ─────────────────────────────────────────────────────

  describe("generateText()", () => {
    it("throws when no model is configured", async () => {
      service.config.features.aiChat = {
        enabled: true,
        provider: "openrouter",
        // no model
      };

      await expect(
        service.generateText("hello", {}, "openrouter"),
      ).rejects.toThrow(/no model configured for AI chat/i);
    });

    it("throws when provider instance is missing", async () => {
      service.providers = {};
      await expect(
        service.generateText("hello", {}, "openrouter"),
      ).rejects.toThrow(/internal error/i);
    });

    it("uses model from config.model when provided", async () => {
      mockGenerateText.mockResolvedValue({ text: "hi" });

      await service.generateText("hello", { model: "claude-3" }, "openrouter");

      expect(mockGenerateText).toHaveBeenCalledWith(
        "hello",
        "claude-3",
        expect.any(Object),
      );
    });

    it("falls back to feature model when config.model is absent", async () => {
      mockGenerateText.mockResolvedValue({ text: "hi" });

      await service.generateText("hello", {}, "openrouter");

      expect(mockGenerateText).toHaveBeenCalledWith(
        "hello",
        "gpt-4o",
        expect.any(Object),
      );
    });
  });

  // ── 7. generateTextStreaming() ─────────────────────────────────────────────

  describe("generateTextStreaming()", () => {
    it("throws when onChunk is missing", async () => {
      await expect(
        service.generateTextStreaming({
          prompt: "hi",
          model: "gpt-4o",
          provider: "openrouter",
        }),
      ).rejects.toThrow(/onChunk callback is required/i);
    });

    it("throws when provider is missing", async () => {
      await expect(
        service.generateTextStreaming({
          prompt: "hi",
          model: "gpt-4o",
          onChunk: vi.fn(),
        }),
      ).rejects.toThrow(/provider is required/i);
    });

    it("throws when provider does not support streaming", async () => {
      // Override openrouter to have no streaming method
      service.providers.openrouter = { generateText: vi.fn() };

      await expect(
        service.generateTextStreaming({
          prompt: "hi",
          model: "gpt-4o",
          provider: "openrouter",
          onChunk: vi.fn(),
        }),
      ).rejects.toThrow(/streaming not supported/i);
    });

    it("dispatches to provider.generateTextStreaming with correct args", async () => {
      mockGenerateTextStreaming.mockResolvedValue({ text: "streamed" });
      const onChunk = vi.fn();

      const result = await service.generateTextStreaming({
        prompt: "tell me a story",
        model: "gpt-4o",
        config: { temperature: 0.7 },
        provider: "openrouter",
        onChunk,
      });

      expect(mockGenerateTextStreaming).toHaveBeenCalledWith(
        "tell me a story",
        "gpt-4o",
        { temperature: 0.7 },
        onChunk,
      );
      expect(result.text).toBe("streamed");
    });
  });

  // ── 8. getConfig() ────────────────────────────────────────────────────────

  describe("getConfig()", () => {
    it("returns an object with primary, providers, and enabledProviders", () => {
      const cfg = service.getConfig();
      expect(cfg).toHaveProperty("primary");
      expect(cfg).toHaveProperty("providers");
      expect(cfg).toHaveProperty("enabledProviders");
    });

    it("enabledProviders lists only providers with enabled=true", () => {
      service.config.providers.stability.enabled = false;
      service.config.providers.runpod.enabled = false;

      const { enabledProviders } = service.getConfig();
      expect(enabledProviders).toEqual(
        expect.arrayContaining(["openrouter", "civitai"]),
      );
      expect(enabledProviders).not.toContain("stability");
      expect(enabledProviders).not.toContain("runpod");
    });

    it("providers lists all provider keys", () => {
      const { providers } = service.getConfig();
      expect(providers).toEqual(
        expect.arrayContaining([
          "openrouter",
          "stability",
          "runpod",
          "civitai",
        ]),
      );
    });
  });
});
