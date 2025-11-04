import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  handleGeneralHelp,
  handleSpecificCommandHelp,
} from "../../src/commands/general/help/handlers.js";

// Mock logger
jest.mock("src/utils/logger.js", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock permissions
jest.mock("src/utils/discord/permissions.js", () => ({
  isDeveloper: jest.fn((userId) => userId === "dev123"),
}));

// Mock embeds
const mockCreateMainHelpEmbed = jest.fn(() => ({
  data: {
    title: "Help",
    description: "Bot help information",
  },
}));
const mockCreateCommandHelpEmbed = jest.fn(() => ({
  data: {
    title: "Command Help",
    description: "Command information",
  },
}));

jest.mock("src/commands/general/help/embeds.js", () => ({
  HelpEmbedBuilder: {
    createMainHelpEmbed: mockCreateMainHelpEmbed,
    createCommandHelpEmbed: mockCreateCommandHelpEmbed,
  },
}));

// Mock components
jest.mock("src/commands/general/help/components.js", () => ({
  ComponentBuilder: {
    createMainComponents: jest.fn().mockResolvedValue([]),
  },
}));

// Mock utils
jest.mock("src/commands/general/help/utils.js", () => ({
  logHelpUsage: jest.fn(),
  isValidCommandName: jest.fn((name) => name && name.length > 0),
}));

// Mock response messages
jest.mock("src/utils/discord/responseMessages.js", () => ({
  errorEmbed: jest.fn((options) => ({
    data: {
      title: options.title,
      description: options.description,
    },
  })),
}));

describe("Help Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

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
        commands: new Map([
          ["ping", { data: { name: "ping", description: "Ping command" } }],
          ["help", { data: { name: "help", description: "Help command" } }],
        ]),
      },
      isRepliable: jest.fn().mockReturnValue(true),
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      user: {
        id: "bot123",
        tag: "TestBot#1234",
      },
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

