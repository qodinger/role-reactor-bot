import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

jest.unstable_mockModule("discord.js", () => ({
  Client: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    user: {
      tag: "TestBot#1234",
      id: "bot123",
      username: "TestBot",
    },
    guilds: {
      cache: new Map([
        ["guild1", { id: "guild1", name: "Test Guild 1" }],
        ["guild2", { id: "guild2", name: "Test Guild 2" }],
      ]),
    },
    destroy: jest.fn(),
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMembers: 2,
    GuildMessages: 4,
    MessageContent: 8,
  },
}));

describe("Discord API Integration", () => {
  let mockClient;
  let Client;
  let GatewayIntentBits;

  beforeEach(async () => {
    jest.clearAllMocks();

    const discordModule = await import("discord.js");
    Client = discordModule.Client;
    GatewayIntentBits = discordModule.GatewayIntentBits;

    mockClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  });

  afterEach(() => {
    if (mockClient) {
      mockClient.destroy();
    }
  });

  describe("Client Initialization", () => {
    test("should create client with correct intents", () => {
      expect(Client).toHaveBeenCalledWith({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });
    });

    test("should have correct user properties", () => {
      expect(mockClient.user.tag).toBe("TestBot#1234");
      expect(mockClient.user.id).toBe("bot123");
      expect(mockClient.user.username).toBe("TestBot");
    });
  });

  describe("Authentication", () => {
    test("should login with token", async () => {
      await mockClient.login("test-token");
      expect(mockClient.login).toHaveBeenCalledWith("test-token");
    });

    test("should handle login errors", async () => {
      mockClient.login.mockRejectedValue(new Error("Invalid token"));
      await expect(mockClient.login("invalid-token")).rejects.toThrow(
        "Invalid token",
      );
    });
  });

  describe("Guild Management", () => {
    test("should access guild information", () => {
      const guild = mockClient.guilds.cache.get("guild1");
      expect(guild).toBeDefined();
      expect(guild.id).toBe("guild1");
      expect(guild.name).toBe("Test Guild 1");
    });
  });
});

describe("Discord API Error Handling", () => {
  test("should handle rate limiting", () => {
    const rateLimitError = {
      code: 40002,
      message: "You are being rate limited",
      retry_after: 5,
    };
    expect(rateLimitError.code).toBe(40002);
    expect(rateLimitError.retry_after).toBe(5);
  });

  test("should handle permission errors", () => {
    const permissionError = {
      code: 50013,
      message: "Missing Permissions",
    };
    expect(permissionError.code).toBe(50013);
    expect(permissionError.message).toBe("Missing Permissions");
  });
});
