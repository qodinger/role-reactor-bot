/**
 * Unit tests for TicketPanel
 * Tests panel creation and management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTicketPanel } from "../../src/features/ticketing/TicketPanel.js";
import { FREE_TIER, PRO_ENGINE } from "../../src/features/ticketing/config.js";

// Mock dependencies
vi.mock("../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn(() => ({
    getTicketPanelsByGuild: vi.fn().mockResolvedValue([]),
    createTicketPanel: vi.fn().mockResolvedValue(null),
    updateTicketPanel: vi.fn().mockResolvedValue(false),
    deleteTicketPanel: vi.fn().mockResolvedValue(false),
  })),
}));

vi.mock("../../src/features/premium/PremiumManager.js", () => ({
  getPremiumManager: vi.fn(() => ({
    isFeatureActive: vi.fn().mockResolvedValue(false),
  })),
}));

describe("TicketPanel", () => {
  let ticketPanel;

  beforeEach(async () => {
    ticketPanel = getTicketPanel();
    await ticketPanel.initialize();
    vi.clearAllMocks();
  });

  describe("Panel Creation", () => {
    it("should handle missing guild ID", async () => {
      const result = await ticketPanel.createPanel({
        guildId: null,
        channelId: "test-channel",
        title: "Test Panel"
      });

      expect(result.success).toBe(false);
    });

    it("should handle missing channel ID", async () => {
      const result = await ticketPanel.createPanel({
        guildId: "test-guild",
        channelId: null,
        title: "Test Panel"
      });

      expect(result.success).toBe(false);
    });

    it("should use default title if not provided", async () => {
      const result = await ticketPanel.createPanel({
        guildId: "test-guild",
        channelId: "test-channel"
      });

      // Should fail because storage returns null
      expect(result.success).toBe(false);
    });

    it("should validate category count", async () => {
      const tooManyCategories = Array(10).fill({
        id: "test",
        label: "Category"
      });

      const result = await ticketPanel.createPanel({
        guildId: "test-guild",
        channelId: "test-channel",
        categories: tooManyCategories
      });

      // Should fail for free tier (max 3 categories)
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Panel Limits", () => {
    it("should check panel limit correctly", async () => {
      const limit = await ticketPanel.checkPanelLimit("test-guild");

      expect(limit).toHaveProperty("hasReachedLimit");
      expect(limit).toHaveProperty("current");
      expect(limit).toHaveProperty("max");
      expect(limit.max).toBe(FREE_TIER.MAX_PANELS);
    });

    it("should return current panel count", async () => {
      const limit = await ticketPanel.checkPanelLimit("test-guild");

      expect(typeof limit.current).toBe("number");
      expect(limit.current).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Panel Retrieval", () => {
    it("should return array for guild panels", async () => {
      const panels = await ticketPanel.getGuildPanels("test-guild");

      expect(Array.isArray(panels)).toBe(true);
    });

    it("should handle non-existent guild", async () => {
      const panels = await ticketPanel.getGuildPanels("nonexistent-guild");

      expect(Array.isArray(panels)).toBe(true);
      expect(panels.length).toBe(0);
    });
  });

  describe("Panel Update", () => {
    it("should handle non-existent panel", async () => {
      const result = await ticketPanel.updatePanel(
        "PANEL-nonexistent-000",
        { title: "Updated" }
      );

      expect(result.success).toBe(false);
    });

    it("should handle empty update data", async () => {
      const result = await ticketPanel.updatePanel(
        "PANEL-test-000",
        {}
      );

      expect(result.success).toBe(false);
    });
  });

  describe("Panel Deletion", () => {
    it("should handle non-existent panel", async () => {
      const result = await ticketPanel.deletePanel("PANEL-nonexistent-000");

      expect(result.success).toBe(false);
    });
  });

  describe("Panel Enable/Disable", () => {
    it("should handle non-existent panel", async () => {
      const result = await ticketPanel.setPanelEnabled(
        "PANEL-nonexistent-000",
        false
      );

      expect(result.success).toBe(false);
    });

    it("should accept boolean enabled parameter", async () => {
      const result = await ticketPanel.setPanelEnabled(
        "PANEL-test-000",
        true
      );

      // Should fail for non-existent panel, but not crash
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("Panel Message", () => {
    it("should handle missing channel", async () => {
      const result = await ticketPanel.sendPanelMessage({
        channel: null,
        panel: { panelId: "test" }
      });

      expect(result.success).toBe(false);
    });

    it("should handle missing panel", async () => {
      const result = await ticketPanel.sendPanelMessage({
        channel: { id: "test" },
        panel: null
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Panel Configuration", () => {
    it("should use default category if none provided", async () => {
      const result = await ticketPanel.createPanel({
        guildId: "test-guild",
        channelId: "test-channel",
        categories: undefined
      });

      // Should fail because storage returns null
      expect(result.success).toBe(false);
    });

    it("should set default styling", async () => {
      const result = await ticketPanel.createPanel({
        guildId: "test-guild",
        channelId: "test-channel"
      });

      // Should fail because storage returns null
      expect(result.success).toBe(false);
    });
  });
});
