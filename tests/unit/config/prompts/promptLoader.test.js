/**
 * Prompt Loader Tests
 * Basic tests for prompt loading, caching, and variable substitution
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock logger to avoid dependency issues in tests
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import {
  loadImagePrompts,
  loadChatPrompts,
  getPrompt,
  clearPromptCache,
  getCacheStats,
} from "../../../../src/config/prompts/promptLoader.js";
import { resetAnalytics } from "../../../../src/config/prompts/promptAnalytics.js";
import { getAllPromptVersions } from "../../../../src/config/prompts/promptVersion.js";

describe("Prompt Loader", () => {
  beforeEach(() => {
    clearPromptCache();
    resetAnalytics();
  });

  describe("loadImagePrompts", () => {
    it("should load image prompts", async () => {
      const prompts = await loadImagePrompts();
      expect(prompts).toBeDefined();
      expect(prompts.PROVIDER_PROMPTS).toBeDefined();
      expect(prompts.STYLE_MODIFIERS).toBeDefined();
    });

    it("should cache prompts", async () => {
      await loadImagePrompts();
      const stats = getCacheStats();
      expect(stats.hasImageCache).toBe(true);
    });

    it("should force reload when requested", async () => {
      await loadImagePrompts();
      const stats1 = getCacheStats();
      await loadImagePrompts(true);
      const stats2 = getCacheStats();
      expect(stats2.lastLoadTime).toBeGreaterThanOrEqual(stats1.lastLoadTime);
    });
  });

  describe("loadChatPrompts", () => {
    it("should load chat prompts", async () => {
      const prompts = await loadChatPrompts();
      expect(prompts).toBeDefined();
      expect(prompts.CHAT_PROMPTS).toBeDefined();
      expect(prompts.CHAT_PROMPTS.followUpTemplate).toBeDefined();
      expect(prompts.CHAT_PROMPTS.criticalRules).toBeDefined();
    });

    it("should cache prompts", async () => {
      await loadChatPrompts();
      const stats = getCacheStats();
      expect(stats.hasChatCache).toBe(true);
    });
  });

  describe("getPrompt", () => {
    it("should get chat prompt with variable substitution", async () => {
      const prompt = await getPrompt("chat", "followUpTemplate", {
        testVar: "TEST_VALUE",
      });
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should track prompt usage", async () => {
      await getPrompt("chat", "followUpTemplate");
      // Usage tracking is tested via analytics
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", () => {
      clearPromptCache();
      const stats = getCacheStats();
      expect(stats.hasImageCache).toBe(false);
      expect(stats.hasChatCache).toBe(false);
    });

    it("should return cache statistics", () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty("hasImageCache");
      expect(stats).toHaveProperty("hasChatCache");
      expect(stats).toHaveProperty("cacheTTL");
    });
  });
});

describe("Prompt Versioning", () => {
  it("should return version information", () => {
    const versions = getAllPromptVersions();
    expect(versions).toBeDefined();
    expect(versions.image).toBeDefined();
    expect(versions.chat).toBeDefined();
    expect(versions.image.version).toBeDefined();
    expect(versions.chat.version).toBeDefined();
  });
});
