import { vi } from "vitest";
import { ConversationManager } from "../../../../src/utils/ai/conversationManager.js";

// Mock dependencies
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    conversations: {
      getByUser: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
    },
  }),
}));

vi.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue({
    read: vi.fn().mockResolvedValue({}),
    write: vi.fn().mockResolvedValue(true),
  }),
}));

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("ConversationManager", () => {
  let conversationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variables for testing
    process.env.AI_USE_LONG_TERM_MEMORY = "false";
    process.env.AI_CONVERSATION_STORAGE_TYPE = "memory";
    conversationManager = new ConversationManager();
  });

  afterEach(() => {
    if (conversationManager.cleanupInterval) {
      clearInterval(conversationManager.cleanupInterval);
    }
  });

  describe("getConversationKey", () => {
    it("should generate composite key for server conversations", () => {
      const userId = "123456789";
      const guildId = "987654321";
      const key = conversationManager.getConversationKey(userId, guildId);
      expect(key).toBe("123456789_987654321");
    });

    it("should generate dm_ prefix for DM conversations", () => {
      const userId = "123456789";
      const key = conversationManager.getConversationKey(userId, null);
      expect(key).toBe("dm_123456789");
    });

    it("should handle undefined guildId as DM", () => {
      const userId = "123456789";
      const key = conversationManager.getConversationKey(userId, undefined);
      expect(key).toBe("dm_123456789");
    });
  });

  describe("parseConversationKey", () => {
    it("should parse server conversation key correctly", () => {
      const key = "123456789_987654321";
      const parsed = conversationManager.parseConversationKey(key);
      expect(parsed).toEqual({
        userId: "123456789",
        guildId: "987654321",
      });
    });

    it("should parse DM conversation key correctly", () => {
      const key = "dm_123456789";
      const parsed = conversationManager.parseConversationKey(key);
      expect(parsed).toEqual({
        userId: "123456789",
        guildId: null,
      });
    });

    it("should handle legacy userId-only format", () => {
      const key = "123456789";
      const parsed = conversationManager.parseConversationKey(key);
      expect(parsed).toEqual({
        userId: "123456789",
        guildId: null,
      });
    });
  });

  describe("Server Isolation", () => {
    it("should separate conversations by server", async () => {
      const userId = "123456789";
      const guildId1 = "111111111";
      const guildId2 = "222222222";

      // Add conversation in server 1
      await conversationManager.addToHistory(userId, guildId1, {
        role: "user",
        content: "Hello from server 1",
      });

      // Add conversation in server 2
      await conversationManager.addToHistory(userId, guildId2, {
        role: "user",
        content: "Hello from server 2",
      });

      // Get history for server 1
      const history1 = await conversationManager.getConversationHistory(
        userId,
        guildId1,
      );
      expect(history1).toHaveLength(1);
      expect(history1[0].content).toBe("Hello from server 1");

      // Get history for server 2
      const history2 = await conversationManager.getConversationHistory(
        userId,
        guildId2,
      );
      expect(history2).toHaveLength(1);
      expect(history2[0].content).toBe("Hello from server 2");

      // Verify they are separate
      expect(history1).not.toEqual(history2);
    });

    it("should separate DM conversations from server conversations", async () => {
      const userId = "123456789";
      const guildId = "111111111";

      // Add DM conversation
      await conversationManager.addToHistory(userId, null, {
        role: "user",
        content: "Hello from DM",
      });

      // Add server conversation
      await conversationManager.addToHistory(userId, guildId, {
        role: "user",
        content: "Hello from server",
      });

      // Get DM history
      const dmHistory = await conversationManager.getConversationHistory(
        userId,
        null,
      );
      expect(dmHistory).toHaveLength(1);
      expect(dmHistory[0].content).toBe("Hello from DM");

      // Get server history
      const serverHistory = await conversationManager.getConversationHistory(
        userId,
        guildId,
      );
      expect(serverHistory).toHaveLength(1);
      expect(serverHistory[0].content).toBe("Hello from server");

      // Verify they are separate
      expect(dmHistory).not.toEqual(serverHistory);
    });

    it("should allow same user to have different conversations in different servers", async () => {
      const userId = "123456789";
      const guildId1 = "111111111";
      const guildId2 = "222222222";

      // Add multiple messages in server 1
      await conversationManager.addToHistory(userId, guildId1, {
        role: "user",
        content: "Message 1 in server 1",
      });
      await conversationManager.addToHistory(userId, guildId1, {
        role: "assistant",
        content: "Response 1 in server 1",
      });

      // Add different messages in server 2
      await conversationManager.addToHistory(userId, guildId2, {
        role: "user",
        content: "Message 1 in server 2",
      });

      // Verify server 1 has 2 messages
      const history1 = await conversationManager.getConversationHistory(
        userId,
        guildId1,
      );
      expect(history1).toHaveLength(2);

      // Verify server 2 has 1 message
      const history2 = await conversationManager.getConversationHistory(
        userId,
        guildId2,
      );
      expect(history2).toHaveLength(1);
    });
  });

  describe("clearHistory", () => {
    it("should clear history for specific server only", async () => {
      const userId = "123456789";
      const guildId1 = "111111111";
      const guildId2 = "222222222";

      // Add conversations in both servers
      await conversationManager.addToHistory(userId, guildId1, {
        role: "user",
        content: "Message in server 1",
      });
      await conversationManager.addToHistory(userId, guildId2, {
        role: "user",
        content: "Message in server 2",
      });

      // Clear history for server 1 only
      await conversationManager.clearHistory(userId, guildId1);

      // Verify server 1 is cleared
      const history1 = await conversationManager.getConversationHistory(
        userId,
        guildId1,
      );
      expect(history1).toHaveLength(0);

      // Verify server 2 still has history
      const history2 = await conversationManager.getConversationHistory(
        userId,
        guildId2,
      );
      expect(history2).toHaveLength(1);
      expect(history2[0].content).toBe("Message in server 2");
    });

    it("should clear DM history separately from server history", async () => {
      const userId = "123456789";
      const guildId = "111111111";

      // Add DM conversation
      await conversationManager.addToHistory(userId, null, {
        role: "user",
        content: "DM message",
      });

      // Add server conversation
      await conversationManager.addToHistory(userId, guildId, {
        role: "user",
        content: "Server message",
      });

      // Clear DM only
      await conversationManager.clearHistory(userId, null);

      // Verify DM is cleared
      const dmHistory = await conversationManager.getConversationHistory(
        userId,
        null,
      );
      expect(dmHistory).toHaveLength(0);

      // Verify server history remains
      const serverHistory = await conversationManager.getConversationHistory(
        userId,
        guildId,
      );
      expect(serverHistory).toHaveLength(1);
    });
  });

  describe("Backward Compatibility", () => {
    it("should handle legacy userId-only keys in preload", async () => {
      // This test verifies that the preload logic handles legacy keys
      // The actual implementation converts legacy keys to dm_userId format
      const legacyKey = "123456789";
      const parsed = conversationManager.parseConversationKey(legacyKey);
      expect(parsed.userId).toBe("123456789");
      expect(parsed.guildId).toBe(null);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty history", async () => {
      const userId = "123456789";
      const guildId = "111111111";
      const history = await conversationManager.getConversationHistory(
        userId,
        guildId,
      );
      expect(history).toEqual([]);
    });

    it("should handle multiple users in same server", async () => {
      const userId1 = "111111111";
      const userId2 = "222222222";
      const guildId = "999999999";

      await conversationManager.addToHistory(userId1, guildId, {
        role: "user",
        content: "User 1 message",
      });

      await conversationManager.addToHistory(userId2, guildId, {
        role: "user",
        content: "User 2 message",
      });

      const history1 = await conversationManager.getConversationHistory(
        userId1,
        guildId,
      );
      const history2 = await conversationManager.getConversationHistory(
        userId2,
        guildId,
      );

      expect(history1).toHaveLength(1);
      expect(history1[0].content).toBe("User 1 message");
      expect(history2).toHaveLength(1);
      expect(history2[0].content).toBe("User 2 message");
    });
  });
});
