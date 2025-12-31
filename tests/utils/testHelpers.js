/**
 * Test Helper Utilities
 * 
 * Common utilities for creating mocks and test data
 * Based on Discord.js testing best practices
 */

import { vi } from "vitest";

/**
 * Creates a mock Discord interaction
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock interaction object
 */
export function createMockInteraction(overrides = {}) {
  return {
    id: "interaction123",
    user: {
      id: "user123",
      tag: "TestUser#1234",
      username: "TestUser",
      displayName: "TestUser",
      displayAvatarURL: vi.fn().mockReturnValue("https://example.com/avatar.png"),
      bot: false,
    },
    guild: {
      id: "guild123",
      name: "Test Guild",
      iconURL: vi.fn().mockReturnValue("https://example.com/guild-icon.png"),
      members: {
        cache: {
          get: vi.fn().mockReturnValue(null),
        },
        me: {
          permissions: {
            has: vi.fn().mockReturnValue(true),
          },
        },
      },
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    },
    channel: {
      id: "channel123",
      name: "test-channel",
      type: 0, // TEXT_CHANNEL
      send: vi.fn().mockResolvedValue({}),
    },
    isRepliable: vi.fn().mockReturnValue(true),
    isCommand: vi.fn().mockReturnValue(true),
    isButton: vi.fn().mockReturnValue(false),
    isModalSubmit: vi.fn().mockReturnValue(false),
    options: {
      getString: vi.fn().mockReturnValue(null),
      getInteger: vi.fn().mockReturnValue(null),
      getBoolean: vi.fn().mockReturnValue(null),
      getUser: vi.fn().mockReturnValue(null),
      getRole: vi.fn().mockReturnValue(null),
      getChannel: vi.fn().mockReturnValue(null),
    },
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock Discord client
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock client object
 */
export function createMockClient(overrides = {}) {
  return {
    user: {
      id: "bot123",
      tag: "TestBot#1234",
      username: "TestBot",
      displayAvatarURL: vi.fn().mockReturnValue("https://example.com/bot-avatar.png"),
    },
    guilds: {
      cache: new Map(),
    },
    channels: {
      cache: new Map(),
      fetch: vi.fn().mockResolvedValue(null),
    },
    users: {
      cache: new Map(),
      fetch: vi.fn().mockResolvedValue(null),
    },
    login: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock Discord guild
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock guild object
 */
export function createMockGuild(overrides = {}) {
  return {
    id: "guild123",
    name: "Test Guild",
    description: "Test server description",
    ownerId: "owner123",
    createdAt: new Date("2020-01-01"),
    memberCount: 100,
    iconURL: vi.fn().mockReturnValue("https://example.com/guild-icon.png"),
    members: {
      cache: new Map(),
      fetch: vi.fn().mockResolvedValue(undefined),
      me: {
        permissions: {
          has: vi.fn().mockReturnValue(true),
        },
      },
    },
    channels: {
      cache: new Map(),
    },
    roles: {
      cache: new Map(),
    },
    fetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock Discord member
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock member object
 */
export function createMockMember(overrides = {}) {
  return {
    id: "member123",
    user: {
      id: "member123",
      tag: "TestUser#1234",
      username: "TestUser",
      bot: false,
    },
    guild: createMockGuild(),
    roles: {
      cache: new Map(),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    permissions: {
      has: vi.fn().mockReturnValue(true),
    },
    voice: {
      channel: null,
      setMute: vi.fn().mockResolvedValue(undefined),
      setDeaf: vi.fn().mockResolvedValue(undefined),
      setChannel: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
    fetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock Discord voice state
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock voice state object
 */
export function createMockVoiceState(overrides = {}) {
  return {
    guild: createMockGuild(),
    member: createMockMember(),
    channelId: null,
    channel: null,
    mute: false,
    selfMute: false,
    deaf: false,
    selfDeaf: false,
    ...overrides,
  };
}

/**
 * Creates a mock Discord channel
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock channel object
 */
export function createMockChannel(overrides = {}) {
  return {
    id: "channel123",
    name: "test-channel",
    type: 0, // TEXT_CHANNEL
    guild: createMockGuild(),
    send: vi.fn().mockResolvedValue({}),
    permissionsFor: vi.fn().mockReturnValue({
      has: vi.fn().mockReturnValue(true),
    }),
    ...overrides,
  };
}

/**
 * Creates a mock Discord voice channel
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock voice channel object
 */
export function createMockVoiceChannel(overrides = {}) {
  return {
    id: "voice123",
    name: "Voice Channel",
    type: 2, // GUILD_VOICE
    guild: createMockGuild(),
    permissionsFor: vi.fn().mockReturnValue({
      has: vi.fn().mockReturnValue(true),
    }),
    permissionOverwrites: {
      cache: new Map(),
    },
    ...overrides,
  };
}

/**
 * Creates a mock storage manager
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock storage manager object
 */
export function createMockStorageManager(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn().mockResolvedValue(true),
    isInitialized: true,
    initialize: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock database manager
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock database manager object
 */
export function createMockDatabaseManager(overrides = {}) {
  return {
    guildSettings: {
      getByGuild: vi.fn().mockResolvedValue({
        experienceSystem: {
          enabled: true,
        },
      }),
    },
    welcomeSettings: { exists: true },
    goodbyeSettings: {},
    experienceSystem: {},
    connectionManager: {
      db: { collection: vi.fn() },
      connect: vi.fn().mockResolvedValue(undefined),
    },
    connect: vi.fn().mockResolvedValue(undefined),
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
    ...overrides,
  };
}

/**
 * Creates a mock experience manager
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock experience manager object
 */
export function createMockExperienceManager(overrides = {}) {
  return {
    getUserData: vi.fn().mockResolvedValue({
      totalXP: 1000,
      level: 5,
    }),
    calculateProgress: vi.fn().mockReturnValue({
      currentLevel: 5,
      totalXP: 1000,
      xpInCurrentLevel: 500,
      xpNeededForNextLevel: 1000,
      progress: 50,
      xpForNextLevel: 2000,
    }),
    isInitialized: true,
    initialize: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock voice tracker
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock voice tracker object
 */
export function createMockVoiceTracker(overrides = {}) {
  return {
    startVoiceTracking: vi.fn().mockResolvedValue(undefined),
    stopVoiceTracking: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Sets up common mocks for Discord.js and MongoDB
 * Call this at the top of test files before imports
 */
export function setupCommonMocks() {
  // Mock logger
  vi.mock("src/utils/logger.js", () => ({
    getLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  }));

  // Mock MongoDB
  vi.mock("mongodb", () => {
    const mockCollection = {
      find: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
      findOne: vi.fn().mockResolvedValue(null),
      insertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      replaceOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      createIndex: vi.fn().mockResolvedValue({}),
    };

    const mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
      admin: vi.fn().mockReturnValue({
        ping: vi.fn().mockResolvedValue({}),
      }),
    };

    const mockMongoClient = {
      connect: vi.fn().mockResolvedValue({
        db: vi.fn().mockReturnValue(mockDb),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      db: vi.fn().mockReturnValue(mockDb),
      close: vi.fn().mockResolvedValue(undefined),
    };

    class MongoClient {
      constructor() {
        Object.assign(this, mockMongoClient);
      }
    }

    return { MongoClient };
  });
}

/**
 * Waits for a specified amount of time
 * Useful for testing async operations
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after the delay
 */
export function waitFor(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref(); // Prevent timer from keeping process alive
  });
}

