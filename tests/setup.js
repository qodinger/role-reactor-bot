// Jest setup file for RoleReactor Bot tests

// Mock environment variables
process.env.DISCORD_TOKEN = "test-token";
process.env.CLIENT_ID = "test-client-id";
process.env.GUILD_ID = "test-guild-id";

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock Discord.js
jest.mock("discord.js", () => ({
  Client: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
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
    generateInvite: jest
      .fn()
      .mockReturnValue("https://discord.com/invite/test"),
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    GuildMessageReactions: 4,
    GuildMembers: 8,
    MessageContent: 16,
  },
  Partials: {
    Message: 1,
    Channel: 2,
    Reaction: 4,
    User: 8,
    GuildMember: 16,
  },
  Collection: jest.fn().mockImplementation(() => new Map()),
  Events: {
    ClientReady: "ready",
    InteractionCreate: "interactionCreate",
    MessageReactionAdd: "messageReactionAdd",
    MessageReactionRemove: "messageReactionRemove",
  },
  ActivityType: {
    Playing: 0,
    Streaming: 1,
    Listening: 2,
    Watching: 3,
    Competing: 5,
  },
  OAuth2Scopes: {
    Bot: "bot",
    ApplicationsCommands: "applications.commands",
  },
  PermissionFlagsBits: {
    ManageRoles: 1n << 28n,
    ManageMessages: 1n << 13n,
    AddReactions: 1n << 6n,
    ReadMessageHistory: 1n << 4n,
    ViewChannel: 1n << 10n,
  },
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addUserOption: jest.fn().mockReturnThis(),
    addRoleOption: jest.fn().mockReturnThis(),
    addChannelOption: jest.fn().mockReturnThis(),
    addBooleanOption: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis(),
    addNumberOption: jest.fn().mockReturnThis(),
    addAttachmentOption: jest.fn().mockReturnThis(),
    addMentionableOption: jest.fn().mockReturnThis(),
    setDefaultMemberPermissions: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({}),
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({}),
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => ({
    addComponents: jest.fn().mockReturnThis(),
  })),
  ButtonBuilder: jest.fn().mockImplementation(() => ({
    setLabel: jest.fn().mockReturnThis(),
    setURL: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setCustomId: jest.fn().mockReturnThis(),
  })),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
  },
}));

// Mock fs module
jest.mock("fs", () => ({
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
  statSync: jest.fn(),
}));

// Mock path module
jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
}));

// Mock dotenv
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

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
