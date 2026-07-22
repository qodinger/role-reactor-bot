import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StarboardManager } from '../../../../src/features/starboard/StarboardManager.js';
import { getDatabaseManager } from '../../../../src/utils/storage/databaseManager.js';

// Mock dependencies
vi.mock('../../../../src/utils/storage/databaseManager.js', () => ({
  getDatabaseManager: vi.fn(),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('StarboardManager', () => {
  let mockReaction, mockUser, mockDb, mockMessage, mockStarboardChannel, mockGuild;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGuild = {
      id: 'guild-123',
      channels: {
        cache: {
          get: vi.fn(),
        },
        fetch: vi.fn(),
      },
    };

    mockStarboardChannel = {
      id: 'channel-star',
      send: vi.fn().mockResolvedValue({ id: 'new-star-msg' }),
      messages: {
        fetch: vi.fn(),
      },
    };

    mockMessage = {
      id: 'msg-123',
      channel: { id: 'channel-regular' },
      guild: mockGuild,
      author: {
        id: 'user-123',
        bot: false,
        username: 'TestUser',
        displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png'),
      },
      content: 'Hello World',
      createdAt: new Date(),
      attachments: {
        find: vi.fn().mockReturnValue(undefined),   // No attachments by default
        filter: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue([]) }),
      },
      reference: undefined, // Not a reply by default
      url: 'https://discord.com/channels/1/2/3',
      partial: false,
      fetch: vi.fn(),
    };


    mockReaction = {
      emoji: { name: '⭐', id: null },
      count: 3,
      message: mockMessage,
      partial: false,
      fetch: vi.fn(),
    };

    mockUser = { id: 'user-456', bot: false };

    mockDb = {
      starboardSettings: {
        getSettings: vi.fn().mockResolvedValue({
          enabled: true,
          channelId: 'channel-star',
          emoji: '⭐',
          threshold: 3,
        }),
      },
      starboardMessages: {
        getMessageMapping: vi.fn().mockResolvedValue(null),
        upsertMessageMapping: vi.fn(),
        deleteMessageMapping: vi.fn(),
      },
    };

    getDatabaseManager.mockResolvedValue(mockDb);
    mockGuild.channels.cache.get.mockReturnValue(mockStarboardChannel);
  });

  it('should ignore if disabled', async () => {
    mockDb.starboardSettings.getSettings.mockResolvedValue({ enabled: false });
    await StarboardManager.handleReaction(mockReaction, mockUser);
    expect(mockStarboardChannel.send).not.toHaveBeenCalled();
  });

  it('should ignore if wrong emoji', async () => {
    mockReaction.emoji.name = '👍';
    await StarboardManager.handleReaction(mockReaction, mockUser);
    expect(mockStarboardChannel.send).not.toHaveBeenCalled();
  });

  it('should create new starboard message when threshold reached', async () => {
    await StarboardManager.handleReaction(mockReaction, mockUser);
    
    expect(mockStarboardChannel.send).toHaveBeenCalledTimes(1);
    const sendArgs = mockStarboardChannel.send.mock.calls[0][0];
    
    // Check embed
    expect(sendArgs.embeds).toBeDefined();
    expect(sendArgs.embeds[0].data.description).toBe('Hello World');
    
    // Check DB upsert
    expect(mockDb.starboardMessages.upsertMessageMapping).toHaveBeenCalledWith(
      'guild-123',
      'msg-123',
      {
        channelId: 'channel-regular',
        starboardMessageId: 'new-star-msg',
        stars: 3,
        authorId: 'user-123',
      }
    );
  });

  it('should update existing starboard message when stars change', async () => {
    const mockExistingStarMsg = {
      edit: vi.fn().mockResolvedValue(true),
    };
    
    mockDb.starboardMessages.getMessageMapping.mockResolvedValue({
      starboardMessageId: 'existing-star-msg',
    });
    mockStarboardChannel.messages.fetch.mockResolvedValue(mockExistingStarMsg);
    
    mockReaction.count = 5;

    await StarboardManager.handleReaction(mockReaction, mockUser);
    
    expect(mockExistingStarMsg.edit).toHaveBeenCalledTimes(1);
    expect(mockStarboardChannel.send).not.toHaveBeenCalled();
  });

  it('should delete starboard message if stars drop below threshold', async () => {
    const mockExistingStarMsg = {
      delete: vi.fn().mockResolvedValue(true),
    };
    
    mockDb.starboardMessages.getMessageMapping.mockResolvedValue({
      starboardMessageId: 'existing-star-msg',
    });
    mockStarboardChannel.messages.fetch.mockResolvedValue(mockExistingStarMsg);
    
    mockReaction.count = 2; // Below threshold of 3

    await StarboardManager.handleReaction(mockReaction, mockUser);
    
    expect(mockExistingStarMsg.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.starboardMessages.deleteMessageMapping).toHaveBeenCalledWith('guild-123', 'msg-123');
  });
});
