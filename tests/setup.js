import { jest } from "@jest/globals";

jest.setTimeout(10000);

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

process.env.NODE_ENV = "test";
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "test-client-id";
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
    reply: jest.fn(),
    editReply: jest.fn(),
    followUp: jest.fn(),
    options: {
      getString: jest.fn().mockReturnValue(options.getString || ""),
      getInteger: jest.fn().mockReturnValue(options.getInteger || 0),
      getBoolean: jest.fn().mockReturnValue(options.getBoolean || false),
      getUser: jest.fn().mockReturnValue(options.getUser || { id: "user123" }),
      getRole: jest.fn().mockReturnValue(options.getRole || { id: "role123" }),
      getChannel: jest
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
      add: jest.fn(),
      remove: jest.fn(),
    },
    permissions: {
      has: jest.fn().mockReturnValue(options.hasPermission !== false),
    },
    ...options,
  }),

  createMockMessage: (options = {}) => ({
    id: options.id || "message123",
    content: options.content || "Test message",
    author: options.author || { id: "user123", username: "TestUser" },
    guild: options.guild || { id: "guild123" },
    channel: options.channel || { id: "channel123" },
    react: jest.fn(),
    ...options,
  }),

  createMockReaction: (options = {}) => ({
    emoji: { name: options.emojiName || "👍" },
    message: options.message || { id: "message123" },
    users: {
      fetch: jest.fn().mockResolvedValue({
        first: jest.fn().mockReturnValue({ id: "user123" }),
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
    login: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    user: {
      tag: options.userTag || "TestBot#1234",
      id: options.userId || "bot123",
    },
    guilds: {
      cache: new Map(options.guilds || []),
    },
    destroy: jest.fn(),
    ...options,
  }),
};

beforeAll(() => {
  process.env.NODE_ENV = "test";
});

afterAll(async () => {
  jest.clearAllMocks();
  // Clear any remaining timers
  jest.clearAllTimers();

  // Force cleanup of any remaining handles
  if (global.gc) {
    global.gc();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});
