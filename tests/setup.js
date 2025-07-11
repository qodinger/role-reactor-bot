// Jest setup file for RoleReactor Bot tests
import { jest } from "@jest/globals";

// Mock environment variables
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "test-client-id";
process.env.GUILD_ID = "test-guild-id";

// Global test utilities
global.createMockInteraction = (options = {}) => ({
  reply: jest.fn(),
  editReply: jest.fn(),
  deferReply: jest.fn(),
  options: {
    getString: jest.fn(),
    getUser: jest.fn(),
    getRole: jest.fn(),
    getChannel: jest.fn(),
    getBoolean: jest.fn(),
    getInteger: jest.fn(),
    getNumber: jest.fn(),
    getAttachment: jest.fn(),
    getMentionable: jest.fn(),
  },
  member: {
    permissions: {
      has: jest.fn(),
    },
  },
  guild: {
    members: {
      fetchMe: jest.fn(),
    },
    roles: {
      cache: new Map(),
    },
  },
  channel: {
    send: jest.fn(),
  },
  ...options,
});

global.createMockClient = () => ({
  user: {
    tag: "RoleReactor#0000",
    id: "123456789",
    setActivity: jest.fn(),
    displayAvatarURL: jest
      .fn()
      .mockReturnValue("https://example.com/avatar.png"),
  },
  guilds: {
    cache: {
      size: 1,
      toLocaleString: jest.fn().mockReturnValue("1"),
    },
  },
  users: {
    cache: {
      size: 10,
      toLocaleString: jest.fn().mockReturnValue("10"),
    },
  },
  commands: new Map(),
  events: new Map(),
  uptime: 1000,
  generateInvite: jest.fn().mockReturnValue("https://discord.com/invite/test"),
});
