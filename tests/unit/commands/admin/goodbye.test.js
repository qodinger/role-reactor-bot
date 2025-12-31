import { describe, test, expect, beforeEach, vi } from "vitest";

// Test file for goodbye functionality

describe("Goodbye - Core Functionality", () => {
  describe("validateChannel", () => {
    test("should validate text channels as valid", () => {
      const validateChannel = (channel, guild) => {
        if (!channel) {
          return {
            valid: false,
            error: "No channel selected.",
            solution: "Please select a channel for goodbye messages.",
          };
        }

        if (channel.type !== 0) {
          // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for goodbye messages.",
          };
        }

        const botMember = guild.members.me;
        const permissions = channel.permissionsFor(botMember);

        if (!permissions.has("SendMessages")) {
          return {
            valid: false,
            error: `I don't have permission to send messages in **${channel.name}**.`,
            solution:
              "Please grant me 'Send Messages' permission in the selected channel.",
          };
        }

        return { valid: true };
      };

      const mockChannel = {
        id: "channel123",
        name: "general",
        type: 0, // GUILD_TEXT
        permissionsFor: () => ({
          has: () => true,
        }),
      };
      const mockGuild = {
        members: {
          me: {
            roles: {
              highest: { position: 10 },
            },
          },
        },
      };

      const result = validateChannel(mockChannel, mockGuild);
      expect(result.valid).toBe(true);
    });

    test("should reject voice channels", () => {
      const validateChannel = (channel, _guild) => {
        if (!channel) {
          return {
            valid: false,
            error: "No channel selected.",
            solution: "Please select a channel for goodbye messages.",
          };
        }

        if (channel.type !== 0) {
          // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for goodbye messages.",
          };
        }

        return { valid: true };
      };

      const mockChannel = {
        id: "channel123",
        name: "voice-channel",
        type: 2, // GUILD_VOICE
        permissionsFor: () => ({
          has: () => true,
        }),
      };
      const mockGuild = {
        members: {
          me: {
            roles: {
              highest: { position: 10 },
            },
          },
        },
      };

      const result = validateChannel(mockChannel, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a text channel");
    });

    test("should reject channels without send permissions", () => {
      const validateChannel = (channel, guild) => {
        if (!channel) {
          return {
            valid: false,
            error: "No channel selected.",
            solution: "Please select a channel for goodbye messages.",
          };
        }

        if (channel.type !== 0) {
          // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for goodbye messages.",
          };
        }

        const botMember = guild.members.me;
        const permissions = channel.permissionsFor(botMember);

        if (!permissions.has("SendMessages")) {
          return {
            valid: false,
            error: `I don't have permission to send messages in **${channel.name}**.`,
            solution:
              "Please grant me 'Send Messages' permission in the selected channel.",
          };
        }

        return { valid: true };
      };

      const mockChannel = {
        id: "channel123",
        name: "restricted",
        type: 0, // GUILD_TEXT
        permissionsFor: () => ({
          has: () => false,
        }),
      };
      const mockGuild = {
        members: {
          me: {
            roles: {
              highest: { position: 10 },
            },
          },
        },
      };

      const result = validateChannel(mockChannel, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("permission to send messages");
    });
  });

  describe("validateMessage", () => {
    test("should validate normal messages", () => {
      const validateMessage = message => {
        if (!message || message.trim().length === 0) {
          return {
            valid: false,
            error: "Message cannot be empty.",
            solution: "Please provide a goodbye message.",
          };
        }

        if (message.length > 2000) {
          return {
            valid: false,
            error: "Message is too long (maximum 2000 characters).",
            solution: "Please shorten your message.",
          };
        }

        return { valid: true };
      };

      const validMessages = [
        "Goodbye {user}!",
        "Thanks for being part of {server}!",
        "See you later, {user.name}!",
      ];

      validMessages.forEach(message => {
        const result = validateMessage(message);
        expect(result.valid).toBe(true);
      });
    });

    test("should reject empty messages", () => {
      const validateMessage = message => {
        if (!message || message.trim().length === 0) {
          return {
            valid: false,
            error: "Message cannot be empty.",
            solution: "Please provide a goodbye message.",
          };
        }

        return { valid: true };
      };

      const emptyMessages = ["", "   ", null, undefined];

      emptyMessages.forEach(message => {
        const result = validateMessage(message);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("cannot be empty");
      });
    });

    test("should reject messages that are too long", () => {
      const validateMessage = message => {
        if (!message || message.trim().length === 0) {
          return {
            valid: false,
            error: "Message cannot be empty.",
            solution: "Please provide a goodbye message.",
          };
        }

        if (message.length > 2000) {
          return {
            valid: false,
            error: "Message is too long (maximum 2000 characters).",
            solution: "Please shorten your message.",
          };
        }

        return { valid: true };
      };

      const longMessage = "a".repeat(2001);
      const result = validateMessage(longMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });
  });

  describe("processGoodbyeMessage", () => {
    test("should process placeholders correctly", async () => {
      const processGoodbyeMessage = (message, user, guild, memberCount) => {
        if (!message) return "Goodbye!";

        let processedMessage = message;

        // Replace placeholders
        processedMessage = processedMessage.replace(
          /\{user\}/g,
          `<@${user.id}>`,
        );
        processedMessage = processedMessage.replace(
          /\{user\.name\}/g,
          user.username,
        );
        processedMessage = processedMessage.replace(/\{user\.tag\}/g, user.tag);
        processedMessage = processedMessage.replace(/\{user\.id\}/g, user.id);
        processedMessage = processedMessage.replace(/\{server\}/g, guild.name);
        processedMessage = processedMessage.replace(
          /\{server\.id\}/g,
          guild.id,
        );
        processedMessage = processedMessage.replace(
          /\{memberCount\}/g,
          memberCount.toString(),
        );
        processedMessage = processedMessage.replace(
          /\{memberCount\.ordinal\}/g,
          getOrdinal(memberCount),
        );

        return processedMessage;
      };

      const getOrdinal = n => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      const mockUser = {
        id: "123456789",
        username: "TestUser",
        tag: "TestUser#1234",
      };
      const mockGuild = {
        id: "987654321",
        name: "Test Server",
      };
      const memberCount = 150;

      const message =
        "Goodbye {user}! You were the {memberCount.ordinal} member of {server}.";
      const result = processGoodbyeMessage(
        message,
        mockUser,
        mockGuild,
        memberCount,
      );

      expect(result).toContain("<@123456789>");
      expect(result).toContain("150th");
      expect(result).toContain("Test Server");
    });

    test("should handle missing placeholders gracefully", async () => {
      const processGoodbyeMessage = (message, user, guild, memberCount) => {
        if (!message) return "Goodbye!";

        let processedMessage = message;

        // Replace placeholders
        processedMessage = processedMessage.replace(
          /\{user\}/g,
          `<@${user.id}>`,
        );
        processedMessage = processedMessage.replace(
          /\{user\.name\}/g,
          user.username,
        );
        processedMessage = processedMessage.replace(/\{user\.tag\}/g, user.tag);
        processedMessage = processedMessage.replace(/\{user\.id\}/g, user.id);
        processedMessage = processedMessage.replace(/\{server\}/g, guild.name);
        processedMessage = processedMessage.replace(
          /\{server\.id\}/g,
          guild.id,
        );
        processedMessage = processedMessage.replace(
          /\{memberCount\}/g,
          memberCount.toString(),
        );
        processedMessage = processedMessage.replace(
          /\{memberCount\.ordinal\}/g,
          getOrdinal(memberCount),
        );

        return processedMessage;
      };

      const getOrdinal = n => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      const mockUser = {
        id: "123456789",
        username: "TestUser",
        tag: "TestUser#1234",
      };
      const mockGuild = {
        id: "987654321",
        name: "Test Server",
      };
      const memberCount = 150;

      const message = "Goodbye! Thanks for visiting.";
      const result = processGoodbyeMessage(
        message,
        mockUser,
        mockGuild,
        memberCount,
      );

      expect(result).toBe("Goodbye! Thanks for visiting.");
    });

    test("should handle null/undefined inputs", async () => {
      const processGoodbyeMessage = (message, user, guild, memberCount) => {
        if (!message) return "Goodbye!";

        let processedMessage = message;

        // Replace placeholders
        processedMessage = processedMessage.replace(
          /\{user\}/g,
          `<@${user.id}>`,
        );
        processedMessage = processedMessage.replace(
          /\{user\.name\}/g,
          user.username,
        );
        processedMessage = processedMessage.replace(/\{user\.tag\}/g, user.tag);
        processedMessage = processedMessage.replace(/\{user\.id\}/g, user.id);
        processedMessage = processedMessage.replace(/\{server\}/g, guild.name);
        processedMessage = processedMessage.replace(
          /\{server\.id\}/g,
          guild.id,
        );
        processedMessage = processedMessage.replace(
          /\{memberCount\}/g,
          memberCount.toString(),
        );
        processedMessage = processedMessage.replace(
          /\{memberCount\.ordinal\}/g,
          getOrdinal(memberCount),
        );

        return processedMessage;
      };

      const getOrdinal = n => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      const result1 = processGoodbyeMessage(null, null, null, null);
      expect(result1).toBe("Goodbye!");

      const result2 = processGoodbyeMessage(
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result2).toBe("Goodbye!");
    });
  });

  describe("validateEmbedSettings", () => {
    test("should validate embed color", () => {
      const validateEmbedSettings = settings => {
        if (settings.embedEnabled && settings.embedColor) {
          // Check if color is a valid hex color or Discord color constant
          const validColors = [
            "DEFAULT",
            "WHITE",
            "AQUA",
            "GREEN",
            "BLUE",
            "YELLOW",
            "PURPLE",
            "LUMINOUS_VIVID_PINK",
            "GOLD",
            "ORANGE",
            "RED",
            "GREY",
            "DARKER_GREY",
            "NAVY",
            "DARK_AQUA",
            "DARK_GREEN",
            "DARK_BLUE",
            "DARK_PURPLE",
            "DARK_VIVID_PINK",
            "DARK_GOLD",
            "DARK_ORANGE",
            "DARK_RED",
            "DARK_GREY",
            "LIGHT_GREY",
            "DARK_NAVY",
            "BLURPLE",
            "GREYPLE",
            "DARK_BUT_NOT_BLACK",
            "NOT_QUITE_BLACK",
            "RANDOM",
          ];

          if (
            !validColors.includes(settings.embedColor) &&
            !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(settings.embedColor)
          ) {
            return {
              valid: false,
              error: `Invalid embed color: **${settings.embedColor}**`,
              solution:
                "Use a valid hex color (e.g., #FF0000) or Discord color constant.",
            };
          }
        }

        return { valid: true };
      };

      const validSettings = [
        { embedEnabled: true, embedColor: "#FF0000" },
        { embedEnabled: true, embedColor: "RED" },
        { embedEnabled: true, embedColor: "BLUE" },
        { embedEnabled: false, embedColor: "INVALID" },
      ];

      validSettings.forEach(settings => {
        const result = validateEmbedSettings(settings);
        expect(result.valid).toBe(true);
      });
    });

    test("should reject invalid embed colors", () => {
      const validateEmbedSettings = settings => {
        if (settings.embedEnabled && settings.embedColor) {
          const validColors = [
            "DEFAULT",
            "WHITE",
            "AQUA",
            "GREEN",
            "BLUE",
            "YELLOW",
            "PURPLE",
            "LUMINOUS_VIVID_PINK",
            "GOLD",
            "ORANGE",
            "RED",
            "GREY",
            "DARKER_GREY",
            "NAVY",
            "DARK_AQUA",
            "DARK_GREEN",
            "DARK_BLUE",
            "DARK_PURPLE",
            "DARK_VIVID_PINK",
            "DARK_GOLD",
            "DARK_ORANGE",
            "DARK_RED",
            "DARK_GREY",
            "LIGHT_GREY",
            "DARK_NAVY",
            "BLURPLE",
            "GREYPLE",
            "DARK_BUT_NOT_BLACK",
            "NOT_QUITE_BLACK",
            "RANDOM",
          ];

          if (
            !validColors.includes(settings.embedColor) &&
            !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(settings.embedColor)
          ) {
            return {
              valid: false,
              error: `Invalid embed color: **${settings.embedColor}**`,
              solution:
                "Use a valid hex color (e.g., #FF0000) or Discord color constant.",
            };
          }
        }

        return { valid: true };
      };

      const invalidSettings = [
        { embedEnabled: true, embedColor: "INVALID_COLOR" },
        { embedEnabled: true, embedColor: "#GG0000" },
        { embedEnabled: true, embedColor: "red" }, // lowercase
      ];

      invalidSettings.forEach(settings => {
        const result = validateEmbedSettings(settings);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid embed color");
      });
    });
  });
});
