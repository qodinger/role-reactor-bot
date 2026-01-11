/**
 * AI System Integration Tests
 * Tests the actual AI system components working together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationManager } from '../../../src/utils/ai/conversationManager.js';
import { getAIConfig } from '../../../src/config/ai.js';

// Mock external dependencies that require API keys
vi.mock('../../../src/utils/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../src/utils/storage/databaseManager.js', () => ({
  getDatabaseManager: vi.fn(() => null),
}));

// Mock storage manager with in-memory implementation
const mockStorage = new Map();
vi.mock('../../../src/utils/storage/storageManager.js', () => ({
  getStorageManager: vi.fn(() => ({
    read: vi.fn((key) => Promise.resolve(mockStorage.get(key) || {})),
    write: vi.fn((key, data) => {
      mockStorage.set(key, data);
      return Promise.resolve();
    }),
  })),
}));

describe('AI System Integration', () => {
  let conversationManager;

  beforeEach(async () => {
    // Clear mock storage
    mockStorage.clear();
    
    // Create fresh conversation manager
    conversationManager = new ConversationManager();
    
    // Wait for initialization
    await new Promise(resolve => {
      setTimeout(resolve, 50);
    });
  });

  afterEach(() => {
    if (conversationManager) {
      conversationManager.stopCleanup();
    }
  });

  describe('AI Configuration', () => {
    it('should load AI configuration correctly', () => {
      const config = getAIConfig();

      expect(config).toBeDefined();
      expect(config.models).toBeDefined();
      expect(config.models.features).toBeDefined();
      expect(config.featureCosts).toBeDefined();
    });

    it('should have correct AI chat configuration', () => {
      const config = getAIConfig();
      const aiChatConfig = config.models.features.aiChat;

      expect(aiChatConfig).toBeDefined();
      expect(aiChatConfig.enabled).toBe(true);
      expect(aiChatConfig.provider).toBe('openrouter');
      expect(aiChatConfig.model).toBe('openai/gpt-4o-mini');
    });

    it('should have correct provider configuration', () => {
      const config = getAIConfig();
      const openRouterConfig = config.models.providers.openrouter;

      expect(openRouterConfig).toBeDefined();
      expect(openRouterConfig.enabled).toBe(true);
      expect(openRouterConfig.capabilities).toContain('text');
      expect(openRouterConfig.safetyLevel).toBe('safe');
      expect(openRouterConfig.models.text['openai/gpt-4o-mini']).toBeDefined();
    });

    it('should have correct feature costs', () => {
      const config = getAIConfig();
      
      expect(config.featureCosts.aiChat).toBe(0.08); // Updated to match new pricing
      expect(config.featureCosts.aiImage).toBe(1.2); // Updated to match new pricing
    });
  });

  describe('Conversation Management', () => {
    it('should create conversation keys correctly', () => {
      const guildKey = conversationManager.getConversationKey('user123', 'guild456');
      const dmKey = conversationManager.getConversationKey('user123', null);

      expect(guildKey).toBe('user123_guild456');
      expect(dmKey).toBe('dm_user123');
    });

    it('should parse conversation keys correctly', () => {
      const guildParsed = conversationManager.parseConversationKey('user123_guild456');
      const dmParsed = conversationManager.parseConversationKey('dm_user123');

      expect(guildParsed).toEqual({ userId: 'user123', guildId: 'guild456' });
      expect(dmParsed).toEqual({ userId: 'user123', guildId: null });
    });

    it('should manage conversation history', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Initially empty
      let history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toEqual([]);

      // Add messages
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Hello!',
      });

      await conversationManager.addToHistory(userId, guildId, {
        role: 'assistant',
        content: 'Hi there!',
      });

      // Check history
      history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Hello!');
      expect(history[1].content).toBe('Hi there!');
    });

    it('should separate guild and DM conversations', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Add guild message
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Guild message',
      });

      // Add DM message
      await conversationManager.addToHistory(userId, null, {
        role: 'user',
        content: 'DM message',
      });

      // Check separation
      const guildHistory = await conversationManager.getConversationHistory(userId, guildId);
      const dmHistory = await conversationManager.getConversationHistory(userId, null);

      expect(guildHistory).toHaveLength(1);
      expect(guildHistory[0].content).toBe('Guild message');

      expect(dmHistory).toHaveLength(1);
      expect(dmHistory[0].content).toBe('DM message');
    });

    it('should persist conversations to storage', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Add message
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Persistent message',
      });

      // Wait for async storage
      await new Promise(resolve => {
        setTimeout(resolve, 100);
      });

      // Check storage
      const storedData = mockStorage.get('ai_conversations');
      expect(storedData).toBeDefined();
      expect(storedData['user123_guild456']).toBeDefined();
      expect(storedData['user123_guild456'].messages).toHaveLength(1);
      expect(storedData['user123_guild456'].messages[0].content).toBe('Persistent message');
    });

    it('should not persist system messages to storage', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Add system message
      await conversationManager.addToHistory(userId, guildId, {
        role: 'system',
        content: 'System prompt',
      });

      // Add user message
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'User message',
      });

      // Wait for async storage
      await new Promise(resolve => {
        setTimeout(resolve, 100);
      });

      // Check storage - should only have user message
      const storedData = mockStorage.get('ai_conversations');
      expect(storedData).toBeDefined();
      expect(storedData['user123_guild456'].messages).toHaveLength(1);
      expect(storedData['user123_guild456'].messages[0].content).toBe('User message');
      expect(storedData['user123_guild456'].messages[0].role).toBe('user');
    });

    it('should limit conversation history length', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Set small limit for testing
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

    it('should clear conversation history', async () => {
      const userId = 'user123';
      const guildId = 'guild456';

      // Add messages
      await conversationManager.addToHistory(userId, guildId, {
        role: 'user',
        content: 'Message to clear',
      });

      // Verify message exists
      let history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(1);

      // Clear history
      await conversationManager.clearHistory(userId, guildId);

      // Verify cleared
      history = await conversationManager.getConversationHistory(userId, guildId);
      expect(history).toHaveLength(0);
    });
  });

  describe('Configuration Management', () => {
    it('should allow runtime configuration changes', () => {
      const originalLength = conversationManager.maxHistoryLength;
      
      conversationManager.setConfig({
        maxHistoryLength: 15,
        conversationTimeout: 3600000, // 1 hour
      });

      expect(conversationManager.maxHistoryLength).toBe(15);
      expect(conversationManager.conversationTimeout).toBe(3600000);
      expect(conversationManager.maxHistoryLength).not.toBe(originalLength);
    });

    it('should handle partial configuration updates', () => {
      const originalTimeout = conversationManager.conversationTimeout;
      const originalMaxConversations = conversationManager.maxConversations;

      conversationManager.setConfig({
        maxHistoryLength: 25,
      });

      expect(conversationManager.maxHistoryLength).toBe(25);
      expect(conversationManager.conversationTimeout).toBe(originalTimeout);
      expect(conversationManager.maxConversations).toBe(originalMaxConversations);
    });
  });

  describe('Memory Management', () => {
    it('should handle multiple concurrent conversations', async () => {
      const conversations = [
        { userId: 'user1', guildId: 'guild1', message: 'User 1 message' },
        { userId: 'user2', guildId: 'guild1', message: 'User 2 message' },
        { userId: 'user1', guildId: 'guild2', message: 'User 1 in guild 2' },
        { userId: 'user1', guildId: null, message: 'User 1 DM' },
      ];

      // Add all conversations
      for (const conv of conversations) {
        await conversationManager.addToHistory(conv.userId, conv.guildId, {
          role: 'user',
          content: conv.message,
        });
      }

      // Verify all conversations are separate
      for (const conv of conversations) {
        const history = await conversationManager.getConversationHistory(
          conv.userId,
          conv.guildId
        );
        expect(history).toHaveLength(1);
        expect(history[0].content).toBe(conv.message);
      }
    });

    it('should handle conversation capacity configuration', async () => {
      // Test that capacity configuration works
      const originalCapacity = conversationManager.maxConversations;
      
      conversationManager.setConfig({ maxConversations: 500 });
      expect(conversationManager.maxConversations).toBe(500);
      
      conversationManager.setConfig({ maxConversations: originalCapacity });
      expect(conversationManager.maxConversations).toBe(originalCapacity);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs gracefully', async () => {
      const history = await conversationManager.getConversationHistory('', 'guild123');
      expect(history).toEqual([]);

      const history2 = await conversationManager.getConversationHistory(null, 'guild123');
      expect(history2).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      // Mock storage to fail
      const { getStorageManager } = await import('../../../src/utils/storage/storageManager.js');
      getStorageManager.mockResolvedValueOnce({
        read: vi.fn().mockRejectedValue(new Error('Storage read error')),
        write: vi.fn().mockRejectedValue(new Error('Storage write error')),
      });

      const newManager = new ConversationManager();
      
      // Should not throw errors
      const history = await newManager.getConversationHistory('user123', 'guild456');
      expect(history).toEqual([]);

      await expect(newManager.addToHistory('user123', 'guild456', {
        role: 'user',
        content: 'Test message',
      })).resolves.not.toThrow();

      newManager.stopCleanup();
    });
  });

  describe('System Integration', () => {
    it('should integrate conversation manager with AI configuration', () => {
      const config = getAIConfig();
      
      // Verify configuration is compatible with conversation manager
      expect(config.models.features.aiChat.enabled).toBe(true);
      expect(conversationManager.useLongTermMemory).toBe(true);
      expect(conversationManager.storageType).toBe('file');
    });

    it('should handle environment-based configuration', () => {
      // Test that conversation manager respects environment variables
      expect(conversationManager.maxHistoryLength).toBe(20); // DEFAULT_MAX_HISTORY_LENGTH
      expect(conversationManager.conversationTimeout).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
      expect(conversationManager.maxConversations).toBe(1000); // DEFAULT_MAX_CONVERSATIONS
    });
  });
});