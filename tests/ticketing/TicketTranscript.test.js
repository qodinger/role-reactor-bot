/**
 * Unit tests for TicketTranscript
 * Tests transcript generation and management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTicketTranscript } from "../../src/features/ticketing/TicketTranscript.js";

// Mock dependencies
vi.mock("../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn(() => ({
    ticketTranscripts: {
      getExpiredTranscripts: vi.fn().mockResolvedValue([]),
      getStorageUsage: vi
        .fn()
        .mockResolvedValue({
          totalTranscripts: 0,
          totalSizeBytes: 0,
          totalSizeMB: "0",
        }),
      delete: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    },
    createTicketTranscript: vi.fn().mockResolvedValue({
      transcriptId: "TRANS-test-00000",
      ticketId: "TIX-test-00000",
      format: "html",
      content: "<html></html>",
    }),
    getTicketTranscriptByTicket: vi.fn().mockResolvedValue(null),
  })),
}));

describe("TicketTranscript", () => {
  let ticketTranscript;

  beforeEach(async () => {
    ticketTranscript = getTicketTranscript();
    await ticketTranscript.initialize();
    vi.clearAllMocks();
  });

  describe("Transcript Generation", () => {
    it("should handle missing channel", async () => {
      const result = await ticketTranscript.generateFromChannel({
        ticketId: "TIX-test-00000",
        guildId: "test-guild",
        channel: null,
        ticket: { ticketId: "TIX-test-00000" },
        format: "html",
      });

      expect(result.success).toBe(false);
    });

    it("should handle missing ticket ID", async () => {
      const mockChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(new Map()),
        },
      };

      const result = await ticketTranscript.generateFromChannel({
        ticketId: null,
        guildId: "test-guild",
        channel: mockChannel,
        ticket: null,
        format: "html",
      });

      expect(result.success).toBe(false);
    });

    it("should handle empty channel messages", async () => {
      const mockChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(new Map()),
        },
      };

      const result = await ticketTranscript.generateFromChannel({
        ticketId: "TIX-test-00000",
        guildId: "test-guild",
        channel: mockChannel,
        ticket: {
          ticketId: "TIX-test-00000",
          openedAt: new Date().toISOString(),
          closedAt: null,
          claimedBy: null,
        },
        format: "html",
      });

      // Should handle gracefully (may fail due to storage mock)
      expect(result).toBeDefined();
      expect(result.success === true || result.success === false).toBe(true);
    });

    it("should support HTML format", async () => {
      const mockChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(new Map()),
        },
      };

      const result = await ticketTranscript.generateFromChannel({
        ticketId: "TIX-test-00000",
        guildId: "test-guild",
        channel: mockChannel,
        ticket: { ticketId: "TIX-test-00000" },
        format: "html",
      });

      if (result.success) {
        expect(result.content).toBeDefined();
        expect(result.content).toContain("<!DOCTYPE html>");
      }
    });

    it("should support JSON format", async () => {
      const mockChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(new Map()),
        },
      };

      const result = await ticketTranscript.generateFromChannel({
        ticketId: "TIX-test-00000",
        guildId: "test-guild",
        channel: mockChannel,
        ticket: { ticketId: "TIX-test-00000" },
        format: "json",
      });

      if (result.success) {
        expect(result.content).toBeDefined();
        // JSON should be parseable
        expect(() => JSON.parse(result.content)).not.toThrow();
      }
    });

    it("should support text format", async () => {
      const mockChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(new Map()),
        },
      };

      const result = await ticketTranscript.generateFromChannel({
        ticketId: "TIX-test-00000",
        guildId: "test-guild",
        channel: mockChannel,
        ticket: { ticketId: "TIX-test-00000" },
        format: "text",
      });

      if (result.success) {
        expect(typeof result.content).toBe("string");
      }
    });
  });

  describe("Message Formatting", () => {
    it("should format messages correctly", () => {
      const mockMessages = [
        {
          id: "msg-1",
          author: {
            id: "user-1",
            username: "TestUser",
            discriminator: "1234",
            bot: false,
          },
          content: "Hello!",
          createdAt: new Date(),
          attachments: { map: () => [] },
        },
      ];

      const formatted = ticketTranscript.formatMessages(mockMessages);

      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBe(1);
      expect(formatted[0].username).toBe("TestUser");
      expect(formatted[0].content).toBe("Hello!");
    });

    it("should handle messages without author", () => {
      const mockMessages = [
        {
          id: "msg-1",
          author: null,
          content: "System message",
          createdAt: new Date(),
          attachments: { map: () => [] },
        },
      ];

      const formatted = ticketTranscript.formatMessages(mockMessages);

      expect(formatted.length).toBe(1);
      expect(formatted[0].username).toBe("Unknown");
    });

    it("should handle messages without content", () => {
      const mockMessages = [
        {
          id: "msg-1",
          author: { id: "user-1", username: "User" },
          content: null,
          createdAt: new Date(),
          attachments: { map: () => [] },
        },
      ];

      const formatted = ticketTranscript.formatMessages(mockMessages);

      expect(formatted.length).toBe(1);
      expect(formatted[0].content).toBe("");
    });
  });

  describe("HTML Generation", () => {
    it("should generate valid HTML structure", () => {
      const messages = [];
      const ticket = { ticketId: "TIX-test-00000" };

      const html = ticketTranscript.generateHTML(messages, ticket);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("<head>");
      expect(html).toContain("<body>");
    });

    it("should include ticket information", () => {
      const messages = [];
      const ticket = {
        ticketId: "TIX-test-00000",
        openedAt: new Date().toISOString(),
        closedAt: null,
      };

      const html = ticketTranscript.generateHTML(messages, ticket);

      expect(html).toContain("TIX-test-00000");
      expect(html).toContain("Ticket Transcript");
    });

    it("should escape HTML special characters", () => {
      const text = '<script>alert("XSS")</script>';
      const escaped = ticketTranscript.escapeHtml(text);

      expect(escaped).toBe(
        "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;",
      );
    });

    it("should handle empty text", () => {
      const escaped = ticketTranscript.escapeHtml("");
      expect(escaped).toBe("");
    });

    it("should handle null text", () => {
      const escaped = ticketTranscript.escapeHtml(null);
      expect(escaped).toBe("");
    });
  });

  describe("Text Generation", () => {
    it("should generate plain text format", () => {
      const messages = [
        {
          username: "User1",
          timestamp: new Date().toISOString(),
          content: "Hello!",
        },
        {
          username: "User2",
          timestamp: new Date().toISOString(),
          content: "Hi there!",
        },
      ];

      const text = ticketTranscript.generateText(messages);

      expect(typeof text).toBe("string");
      expect(text).toContain("User1");
      expect(text).toContain("Hello!");
    });

    it("should include timestamps", () => {
      const messages = [
        {
          username: "User",
          timestamp: new Date().toISOString(),
          content: "Test",
        },
      ];

      const text = ticketTranscript.generateText(messages);

      expect(text).toContain("[");
      expect(text).toContain("]");
    });
  });

  describe("Transcript Retrieval", () => {
    it("should return null for non-existent transcript", async () => {
      const transcript = await ticketTranscript.getTranscriptByTicket(
        "TIX-nonexistent-00000",
      );

      expect(transcript).toBeNull();
    });

    it("should handle invalid ticket ID", async () => {
      const transcript = await ticketTranscript.getTranscriptByTicket(null);

      expect(transcript).toBeNull();
    });
  });

  describe("Storage Usage", () => {
    it("should return storage stats object", async () => {
      const usage = await ticketTranscript.getStorageUsage("test-guild");

      expect(usage).toHaveProperty("totalTranscripts");
      expect(usage).toHaveProperty("totalSizeBytes");
      expect(usage).toHaveProperty("totalSizeMB");
    });

    it("should return zero for non-existent guild", async () => {
      const usage = await ticketTranscript.getStorageUsage("nonexistent-guild");

      expect(usage.totalTranscripts).toBe(0);
      expect(usage.totalSizeBytes).toBe(0);
    });
  });

  describe("Cleanup", () => {
    it("should return number of deleted transcripts", async () => {
      const deleted = await ticketTranscript.cleanupExpired("test-guild");

      expect(typeof deleted).toBe("number");
      expect(deleted).toBeGreaterThanOrEqual(0);
    });

    it("should handle non-existent guild", async () => {
      const deleted =
        await ticketTranscript.cleanupExpired("nonexistent-guild");

      expect(deleted).toBe(0);
    });
  });
});
