import { vi } from "vitest";

// Vitest timeout is set in config, but we can set it here too if needed
// vi.setConfig({ testTimeout: 10000 });

// Vitest doesn't need console mocking by default
// If you need to mock console, use vi.spyOn instead
// vi.spyOn(console, 'log').mockImplementation(() => {});

process.env.NODE_ENV = "test";
process.env.DISCORD_TOKEN = "test-token";
process.env.DISCORD_CLIENT_ID = "test-client-id";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.PORT = "3001";

global.testUtils = {
  createMockInteraction: (options = {}) => ({
    commandName: options.commandName || "test-command",
    user: { id: options.userId || "123456789012345678" },
    guild: options.guild || { id: "guild123", name: "Test Guild" },
    channel: options.channel || { id: "channel123", name: "test-channel" },
    replied: false,
    deferred: false,
    reply: vi.fn(),
    editReply: vi.fn(),
    followUp: vi.fn(),
    options: {
      getString: vi.fn().mockReturnValue(options.getString || ""),
      getInteger: vi.fn().mockReturnValue(options.getInteger || 0),
      getBoolean: vi.fn().mockReturnValue(options.getBoolean || false),
      getUser: vi.fn().mockReturnValue(options.getUser || { id: "user123" }),
      getRole: vi.fn().mockReturnValue(options.getRole || { id: "role123" }),
      getChannel: vi
        .fn()
        .mockReturnValue(options.getChannel || { id: "channel123" }),
    },
    ...options,
  }),

  createMockGuild: (options = {}) => ({
    id: options.id || "guild123",
    name: options.name || "Test Guild",
    roles: {
      cache: new Map(options.roles || []),
    },
    members: {
      cache: new Map(options.members || []),
    },
    channels: {
      cache: new Map(options.channels || []),
    },
    ...options,
  }),

  createMockMember: (options = {}) => ({
    id: options.id || "member123",
    user: {
      id: options.userId || "member123",
      username: options.username || "TestUser",
      tag: options.tag || "TestUser#1234",
    },
    roles: {
      cache: new Map(options.roles || []),
      add: vi.fn(),
      remove: vi.fn(),
    },
    permissions: {
      has: vi.fn().mockReturnValue(options.hasPermission !== false),
    },
    ...options,
  }),

  createMockMessage: (options = {}) => ({
    id: options.id || "message123",
    content: options.content || "Test message",
    author: options.author || { id: "user123", username: "TestUser" },
    guild: options.guild || { id: "guild123" },
    channel: options.channel || { id: "channel123" },
    react: vi.fn(),
    ...options,
  }),

  createMockReaction: (options = {}) => ({
    emoji: { name: options.emojiName || "👍" },
    message: options.message || { id: "message123" },
    users: {
      fetch: vi.fn().mockResolvedValue({
        first: vi.fn().mockReturnValue({ id: "user123" }),
      }),
    },
    ...options,
  }),

  wait: ms =>
    new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      timer.unref(); // Prevent timer from keeping process alive
    }),

  createMockClient: (options = {}) => ({
    login: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    user: {
      tag: options.userTag || "TestBot#1234",
      id: options.userId || "bot123",
    },
    guilds: {
      cache: new Map(options.guilds || []),
    },
    destroy: vi.fn(),
    ...options,
  }),
};

// Vitest setup - hooks are defined in test files or config
// beforeAll/afterAll/beforeEach/afterEach are available from vitest
