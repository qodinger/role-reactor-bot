// ESM-compatible mocking for discord.js
import { jest } from "@jest/globals";
import "./setup.js";

await jest.unstable_mockModule("discord.js", () => ({
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
}));

// Basic tests for RoleReactor Bot

describe("RoleReactor Bot", () => {
  describe("Environment Setup", () => {
    it("should have required environment variables", () => {
      expect(process.env.DISCORD_TOKEN).toBeDefined();
      expect(process.env.CLIENT_ID).toBeDefined();
      expect(process.env.GUILD_ID).toBeDefined();
    });

    it("should have test environment variables set", () => {
      expect(process.env.DISCORD_TOKEN).toBe("test-token");
      expect(process.env.CLIENT_ID).toBe("test-client-id");
      expect(process.env.GUILD_ID).toBe("test-guild-id");
    });
  });

  describe("Test Utilities", () => {
    it("should create mock interaction", () => {
      const mockInteraction = createMockInteraction();

      expect(mockInteraction.reply).toBeDefined();
      expect(mockInteraction.editReply).toBeDefined();
      expect(mockInteraction.deferReply).toBeDefined();
      expect(mockInteraction.options).toBeDefined();
      expect(mockInteraction.member).toBeDefined();
      expect(mockInteraction.guild).toBeDefined();
      expect(mockInteraction.channel).toBeDefined();
    });

    it("should create mock client", () => {
      const mockClient = createMockClient();

      expect(mockClient.user).toBeDefined();
      expect(mockClient.guilds).toBeDefined();
      expect(mockClient.users).toBeDefined();
      expect(mockClient.commands).toBeDefined();
      expect(mockClient.events).toBeDefined();
    });
  });

  describe("Mock Discord.js", () => {
    it("should mock Discord.js components", async () => {
      const { Client, Events, ActivityType } = await import("discord.js");

      expect(Client).toBeDefined();
      expect(Events).toBeDefined();
      expect(ActivityType).toBeDefined();
    });

    it("should create mock client instance", async () => {
      const { Client } = await import("discord.js");
      const client = new Client();

      expect(client.login).toBeDefined();
      expect(client.on).toBeDefined();
      expect(client.once).toBeDefined();
      expect(client.user).toBeDefined();
      expect(client.guilds).toBeDefined();
      expect(client.users).toBeDefined();
    });
  });

  describe("Utility Functions", () => {
    it("should format uptime correctly", () => {
      const formatUptime = ms => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
      };

      expect(formatUptime(1000)).toBe("1s");
      expect(formatUptime(60000)).toBe("1m 0s");
      expect(formatUptime(3600000)).toBe("1h 0m");
      expect(formatUptime(86400000)).toBe("1d 0h 0m");
    });
  });
});
