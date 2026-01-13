/**
 * Conversation Manager Tests
 * Tests for AI conversation history management and long-term memory
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationManager } from '../../../../src/utils/ai/conversationManager.js';

// Mock dependencies
vi.mock('../../../../src/utils/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../../src/utils/storage/databaseManager.js', () => ({
  getDatabaseManager: vi.fn(() => null),
}));

vi.mock('../../../../src/utils/storage/storageManager.js', () => ({
  getStorageManager: vi.fn(() => ({
    read: vi.fn(),
    write: vi.fn(),
  })),
}));

describe('ConversationManager', () => {
  let conversationManager;
  let mockStorageManager;

  beforeEach(async () => {
    // Reset environment variables
    delete process.env.AI_USE_LONG_TERM_MEMORY;
    delete process.env.AI_CONVERSATION_STORAGE_TYPE;
    delete process.env.AI_CONVERSATION_HISTORY_LENGTH;
    delete process.env.AI_CONVERSATION_TIMEOUT;
    delete process.env.AI_MAX_CONVERSATIONS;

    // Create mock storage manager
    mockStorageManager = {
      read: vi.fn(),
      write: vi.fn(),
    };

    // Mock getStorageManager to return our mock
    const { getStorageManager } = await import('../../../../src/utils/storage/storageManager.js');
    getStorageManager.mockResolvedValue(mockStorageManager);

    conversationManager = new ConversationManager();
  });

  afterEach(() => {
    if (conversationManager) {
      conversationManager.stopCleanup();
    }
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(conversationManager.useLongTermMemory).toBe(true);
      expect(conversationManager.storageType).toBe('file');
      expect(conversationManager.maxHistoryLength).toBe(20);
      expect(conversationManager.conversationTimeout).toBe(24 * 60 * 60 * 1000);
      expect(conversationManager.maxConversations).toBe(1000);
    });

    it('should respect environment variable configuration', () => {
      process.env.AI_USE_LONG_TERM_MEMORY = 'false';
      process.env.AI_CONVERSATION_STORAGE_TYPE = 'memory';
      process.env.AI_CONVERSATION_HISTORY_LENGTH = '15';
      process.env.AI_CONVERSATION_TIMEOUT = '86400000'; // 1 day
      process.env.AI_MAX_CONVERSATIONS = '500';

      const manager = new ConversationManager();
      
      expect(manager.useLongTermMemory).toBe(false);
      expect(manager.storageType).toBe('memory');
      expect(manager.maxHistoryLength).toBe(15);
      expect(manager.conversationTimeout).toBe(86400000);
      expect(manager.maxConversations).toBe(500);

      manager.stopCleanup();
    });
  });

  describe('Conversation Key Management', () => {
    it('should generate correct conversation keys for guild conversations', () => {
      const key = conversationManager.getConversationKey('user123', 'guild456');
      expect(key).toBe('user123_guild456');
    });

    it('should generate correct conversation keys for DM conversations', () => {
      const key = conversationManager.getConversationKey('user123', null);
      expect(key).toBe('dm_user123');
    });

    it('should parse conversation keys correctly', () => {
      const guildKey = conversationManager.parseConversationKey('user123_guild456');
      expect(guildKey).toEqual({ userId: 'user123', guildId: 'guild456' });

      const dmKey = conversationManager.parseConversationKey('dm_user123');
      expect(dmKey).toEqual({ userId: 'user123', guildId: null });
    });

    it('should handle legacy conversation keys', () => {
      const legacyKey = conversationManager.parseConversationKey('user123');
      expect(legacyKey).toEqual({ userId: 'user123', guildId: null });
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      conversationManager.setConfig({
        maxHistoryLength: 25,
        conversationTimeout: 3600000, // 1 hour
        maxConversations: 2000,
      });

      expect(conversationManager.maxHistoryLength).toBe(25);
      expect(conversationManager.conversationTimeout).toBe(3600000);
      expect(conversationManager.maxConversations).toBe(2000);
    });

    it('should allow partial configuration updates', () => {
      const originalTimeout = conversationManager.conversationTimeout;
      
      conversationManager.setConfig({
        maxHistoryLength: 30,
      });

      expect(conversationManager.maxHistoryLength).toBe(30);
      expect(conversationManager.conversationTimeout).toBe(originalTimeout);
    });
  });

  describe('Conversation History Management', () => {
    it('should return empty array for new conversations', async () => {
      mockStorageManager.read.mockResolvedValue({});
      
      const history = await conversationManager.getConversationHistory('user123', 'guild456');
      expect(history).toEqual([]);
    });

    it('should add messages to conversation history', async () => {
      const userId = 'user123';
      const guildId = 'guild456';
      const message = { role: 'user', content: 'Hello!' };

      await conversationManager.addToHistory(userId, guildId, message);

      const history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(message);
    });

    it('should not persist system messages to storage', async () => {
      const userId = 'user123';
      const guildId = 'guild456';
      const systemMessage = { role: 'system', content: 'System prompt' };
      const userMessage = { role: 'user', content: 'Hello!' };

      await conversationManager.addToHistory(userId, guildId, systemMessage);
      await conversationManager.addToHistory(userId, guildId, userMessage);

      // System message should be in memory but not saved to storage
      expect(mockStorageManager.write).toHaveBeenCalledWith(
        'ai_conversations',
        expect.objectContaining({
          'user123_guild456': expect.objectContaining({
            messages: [userMessage], // Only user message, no system message
          }),
        })
      );
    });

    it('should limit conversation history length', async () => {
      const userId = 'user123';
      const guildId = 'guild456';
      
      // Set a small limit for testing
      conversationManager.setConfig({ maxHistoryLength: 3 });

      // Add 5 messages
      for (let i = 1; i <= 5; i++) {
        await conversationManager.addToHistory(userId, guildId, {
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('Message 3');
      expect(history[2].content).toBe('Message 5');
    });

    it('should handle DM conversations separately from guild conversations', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Add message to guild conversation
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Guild message',
      });

      // Add message to DM conversation
      await conversationManager.addToHistory(userId, null, {
        role: 'user',
        content: 'DM message',
      });

      const guildHistory = await conversationManager.getConversationHistory(userId, guildId);
      const dmHistory = await conversationManager.getConversationHistory(userId, null);

      expect(guildHistory).toHaveLength(1);
      expect(guildHistory[0].content).toBe('Guild message');
      
      expect(dmHistory).toHaveLength(1);
      expect(dmHistory[0].content).toBe('DM message');
    });
  });

  describe('Conversation Expiration', () => {
    it('should expire old conversations', async () => {
      const userId = 'user123';
      const guildId = 'guild456';
      
      // Set short timeout for testing
      conversationManager.setConfig({ conversationTimeout: 1000 }); // 1 second

      // Add a message
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Test message',
      });

      // Verify message exists
      let history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(1);

      // Wait for expiration
      await new Promise(resolve => {
        setTimeout(resolve, 1100);
      });

      // Message should be expired and removed
      history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(0);
    });
  });

  describe('Conversation Clearing', () => {
    it('should clear conversation history', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Add messages
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Message 1',
      });
      await conversationManager.addToHistory(userId, guildId, {
        role: 'assistant',
        content: 'Response 1',
      });

      // Verify messages exist
      let history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(2);

      // Clear history
      await conversationManager.clearHistory(userId, guildId);

      // Verify history is cleared
      history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(0);
    });

    it('should call clear callback when clearing history', async () => {
      const userId = 'user123';
      const guildId = 'guild456';
      const clearCallback = vi.fn();

      conversationManager.setClearCallback(clearCallback);

      await conversationManager.clearHistory(userId, guildId, clearCallback);

      expect(clearCallback).toHaveBeenCalledWith(userId, guildId);
    });
  });

  describe('Storage Integration', () => {
    it('should save conversations to file storage', async () => {
      const userId = 'user123';
      const guildId = 'guild456';
      const message = { role: 'user', content: 'Test message' };

      await conversationManager.addToHistory(userId, guildId, message);

      expect(mockStorageManager.write).toHaveBeenCalledWith(
        'ai_conversations',
        expect.objectContaining({
          'user123_guild456': expect.objectContaining({
            messages: [message],
            lastActivity: expect.any(Number),
          }),
        })
      );
    });

    it('should load conversations from file storage', async () => {
      const userId = 'user123';
      const guildId = 'guild456';
      const storedData = {
        'user123_guild456': {
          messages: [{ role: 'user', content: 'Stored message' }],
          lastActivity: Date.now(),
        },
      };

      mockStorageManager.read.mockResolvedValue(storedData);

      const history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Stored message');
    });

    it('should handle storage errors gracefully', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      mockStorageManager.read.mockRejectedValue(new Error('Storage error'));
      mockStorageManager.write.mockRejectedValue(new Error('Storage error'));

      // Should not throw errors
      const history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toEqual([]);

      await expect(conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Test',
      })).resolves.not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should evict oldest conversation when at capacity', async () => {
      // Set small capacity for testing
      conversationManager.setConfig({ maxConversations: 2 });

      // Add conversations
      await conversationManager.addToHistory('user1', 'guild1', {
        role: 'user',
        content: 'Message 1',
      });

      await conversationManager.addToHistory('user2', 'guild2', {
        role: 'user',
        content: 'Message 2',
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => {
        setTimeout(resolve, 10);
      });

      // Add third conversation (should evict oldest)
      await conversationManager.addToHistory('user3', 'guild3', {
        role: 'user',
        content: 'Message 3',
      });

      // First conversation should be evicted
      const history1 = await conversationManager.getConversationHistory('user1', 'guild1');
      const history2 = await conversationManager.getConversationHistory('user2', 'guild2');
      const history3 = await conversationManager.getConversationHistory('user3', 'guild3');

      expect(history1).toHaveLength(0); // Evicted
      expect(history2).toHaveLength(1); // Still exists
      expect(history3).toHaveLength(1); // Still exists
    });
  });

  describe('Cleanup Process', () => {
    it('should start and stop cleanup interval', () => {
      const manager = new ConversationManager();
      expect(manager.cleanupInterval).toBeTruthy();

      manager.stopCleanup();
      expect(manager.cleanupInterval).toBeNull();
    });
  });
});