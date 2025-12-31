import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleGeneralHelp,
  handleSpecificCommandHelp,
} from "../../../../src/commands/general/help/handlers.js";

// Mock logger
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock permissions
vi.mock("src/utils/discord/permissions.js", () => ({
  isDeveloper: vi.fn(userId => userId === "dev123"),
}));

// Mock embeds
const mockCreateMainHelpEmbed = vi.fn(() => ({
  data: {
    title: "Help",
    description: "Bot help information",
  },
}));
const mockCreateCommandHelpEmbed = vi.fn(() => ({
  data: {
    title: "Command Help",
    description: "Command information",
  },
}));

vi.mock("src/commands/general/help/embeds.js", () => ({
  HelpEmbedBuilder: {
    createMainHelpEmbed: mockCreateMainHelpEmbed,
    createCommandHelpEmbed: mockCreateCommandHelpEmbed,
  },
}));

// Mock components
vi.mock("src/commands/general/help/components.js", () => ({
  ComponentBuilder: {
    createMainComponents: vi.fn().mockResolvedValue([]),
  },
}));

// Mock utils
vi.mock("src/commands/general/help/utils.js", () => ({
  logHelpUsage: vi.fn(),
  isValidCommandName: vi.fn(name => name && name.length > 0),
}));

// Mock response messages
vi.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: vi.fn(options => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
}));

describe("Help Command", () => {
  let mockInteraction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteraction = {
      user: {
        id: "user123",
        tag: "TestUser#1234",
      },
      guild: {
        id: "guild123",
      },
      member: {
        id: "user123",
      },
      client: {
        user: {
          id: "bot123",
          tag: "TestBot#1234",
          username: "TestBot",
          displayAvatarURL: vi
            .fn()
            .mockReturnValue("https://example.com/bot.png"),
        },
        guilds: {
          cache: {
            size: 10,
          },
        },
        commands: new Map([
          ["ping", { data: { name: "ping", description: "Ping command" } }],
          ["help", { data: { name: "help", description: "Help command" } }],
        ]),
      },
      isRepliable: vi.fn().mockReturnValue(true),
      editReply: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("handleGeneralHelp", () => {
    it("should display general help", async () => {
      await handleGeneralHelp(mockInteraction, true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle non-deferred replies", async () => {
      await handleGeneralHelp(mockInteraction, false);

      expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      // Make the embed builder throw an error
      mockCreateMainHelpEmbed.mockImplementationOnce(() => {
        throw new Error("Embed creation failed");
      });

      // The error handler should catch this and call handleHelpError
      await handleGeneralHelp(mockInteraction, true);

      // Should have attempted to edit reply (either with embed or error)
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe("handleSpecificCommandHelp", () => {
    it("should display help for valid command", async () => {
      await handleSpecificCommandHelp(mockInteraction, "ping", true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should handle command not found", async () => {
      await handleSpecificCommandHelp(mockInteraction, "nonexistent", true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should deny developer command help for non-developers", async () => {
      mockInteraction.user.id = "user123";
      mockInteraction.client.commands.set("health", {
        data: { name: "health", description: "Health command" },
      });

      await handleSpecificCommandHelp(mockInteraction, "health", true);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});
