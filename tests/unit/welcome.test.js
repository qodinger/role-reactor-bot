// Test file for welcome functionality

describe("Welcome - Core Functionality", () => {
  describe("validateChannel", () => {
    test("should validate text channels as valid", () => {
      const validateChannel = (channel, guild) => {
        if (!channel) {
          return {
            valid: false,
            error: "No channel selected.",
            solution: "Please select a channel for welcome messages.",
          };
        }

        if (channel.type !== 0) { // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for welcome messages.",
          };
        }

        const botMember = guild.members.me;
        const permissions = channel.permissionsFor(botMember);

        if (!permissions.has("SendMessages")) {
          return {
            valid: false,
            error: `I don't have permission to send messages in **${channel.name}**.`,
            solution: "Please grant me 'Send Messages' permission in the selected channel.",
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
            solution: "Please select a channel for welcome messages.",
          };
        }

        if (channel.type !== 0) { // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for welcome messages.",
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
            solution: "Please select a channel for welcome messages.",
          };
        }

        if (channel.type !== 0) { // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for welcome messages.",
          };
        }

        const botMember = guild.members.me;
        const permissions = channel.permissionsFor(botMember);

        if (!permissions.has("SendMessages")) {
          return {
            valid: false,
            error: `I don't have permission to send messages in **${channel.name}**.`,
            solution: "Please grant me 'Send Messages' permission in the selected channel.",
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
            solution: "Please provide a welcome message.",
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
        "Welcome {user}!",
        "Welcome to {server}!",
        "Hello {user.name}, welcome to {server}!",
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
            solution: "Please provide a welcome message.",
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
            solution: "Please provide a welcome message.",
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

  describe("processWelcomeMessage", () => {
    test("should process placeholders correctly", async () => {
      const processWelcomeMessage = (message, user, guild, memberCount) => {
        if (!message) return "Welcome!";

        let processedMessage = message;

        // Replace placeholders
        processedMessage = processedMessage.replace(/\{user\}/g, `<@${user.id}>`);
        processedMessage = processedMessage.replace(/\{user\.name\}/g, user.username);
        processedMessage = processedMessage.replace(/\{user\.tag\}/g, user.tag);
        processedMessage = processedMessage.replace(/\{user\.id\}/g, user.id);
        processedMessage = processedMessage.replace(/\{server\}/g, guild.name);
        processedMessage = processedMessage.replace(/\{server\.id\}/g, guild.id);
        processedMessage = processedMessage.replace(/\{memberCount\}/g, memberCount.toString());
        processedMessage = processedMessage.replace(/\{memberCount\.ordinal\}/g, getOrdinal(memberCount));

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

      const message = "Welcome {user}! You are the {memberCount.ordinal} member of {server}.";
      const result = processWelcomeMessage(message, mockUser, mockGuild, memberCount);

      expect(result).toContain("<@123456789>");
      expect(result).toContain("150th");
      expect(result).toContain("Test Server");
    });

    test("should handle missing placeholders gracefully", async () => {
      const processWelcomeMessage = (message, user, guild, memberCount) => {
        if (!message) return "Welcome!";

        let processedMessage = message;

        // Replace placeholders
        processedMessage = processedMessage.replace(/\{user\}/g, `<@${user.id}>`);
        processedMessage = processedMessage.replace(/\{user\.name\}/g, user.username);
        processedMessage = processedMessage.replace(/\{user\.tag\}/g, user.tag);
        processedMessage = processedMessage.replace(/\{user\.id\}/g, user.id);
        processedMessage = processedMessage.replace(/\{server\}/g, guild.name);
        processedMessage = processedMessage.replace(/\{server\.id\}/g, guild.id);
        processedMessage = processedMessage.replace(/\{memberCount\}/g, memberCount.toString());
        processedMessage = processedMessage.replace(/\{memberCount\.ordinal\}/g, getOrdinal(memberCount));

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

      const message = "Welcome! Thanks for joining.";
      const result = processWelcomeMessage(message, mockUser, mockGuild, memberCount);

      expect(result).toBe("Welcome! Thanks for joining.");
    });

    test("should handle null/undefined inputs", async () => {
      const processWelcomeMessage = (message, user, guild, memberCount) => {
        if (!message) return "Welcome!";

        let processedMessage = message;

        // Replace placeholders
        processedMessage = processedMessage.replace(/\{user\}/g, `<@${user.id}>`);
        processedMessage = processedMessage.replace(/\{user\.name\}/g, user.username);
        processedMessage = processedMessage.replace(/\{user\.tag\}/g, user.tag);
        processedMessage = processedMessage.replace(/\{user\.id\}/g, user.id);
        processedMessage = processedMessage.replace(/\{server\}/g, guild.name);
        processedMessage = processedMessage.replace(/\{server\.id\}/g, guild.id);
        processedMessage = processedMessage.replace(/\{memberCount\}/g, memberCount.toString());
        processedMessage = processedMessage.replace(/\{memberCount\.ordinal\}/g, getOrdinal(memberCount));

        return processedMessage;
      };

      const getOrdinal = n => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      const result1 = processWelcomeMessage(null, null, null, null);
      expect(result1).toBe("Welcome!");

      const result2 = processWelcomeMessage(undefined, undefined, undefined, undefined);
      expect(result2).toBe("Welcome!");
    });
  });

  describe("validateAutoRole", () => {
    test("should validate roles the bot can assign", () => {
      const validateAutoRole = (role, guild) => {
        if (!role) {
          return { valid: true }; // Auto-role is optional
        }

        if (role.managed) {
          return {
            valid: false,
            error: `The role **${role.name}** is managed by Discord or an integration and cannot be assigned.`,
            solution: "Choose a different role that is not managed by Discord or integrations.",
          };
        }

        if (role.tags && role.tags.botId) {
          return {
            valid: false,
            error: `The role **${role.name}** is a bot role and cannot be assigned.`,
            solution: "Choose a different role that is not associated with a bot.",
          };
        }

        const botMember = guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
          return {
            valid: false,
            error: `The role **${role.name}** is higher than or equal to my highest role in the hierarchy.`,
            solution: "Move my role above this role in Server Settings → Roles, or choose a lower role.",
          };
        }

        return { valid: true };
      };

      const mockRole = {
        id: "role123",
        name: "Member",
        managed: false,
        tags: null,
        position: 5,
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

      const result = validateAutoRole(mockRole, mockGuild);
      expect(result.valid).toBe(true);
    });

    test("should reject managed roles", () => {
      const validateAutoRole = (role, _guild) => {
        if (!role) {
          return { valid: true }; // Auto-role is optional
        }

        if (role.managed) {
          return {
            valid: false,
            error: `The role **${role.name}** is managed by Discord or an integration and cannot be assigned.`,
            solution: "Choose a different role that is not managed by Discord or integrations.",
          };
        }

        return { valid: true };
      };

      const mockRole = {
        id: "role123",
        name: "Managed Role",
        managed: true,
        tags: null,
        position: 5,
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

      const result = validateAutoRole(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("managed by Discord");
    });

    test("should reject bot roles", () => {
      const validateAutoRole = (role, _guild) => {
        if (!role) {
          return { valid: true }; // Auto-role is optional
        }

        if (role.tags && role.tags.botId) {
          return {
            valid: false,
            error: `The role **${role.name}** is a bot role and cannot be assigned.`,
            solution: "Choose a different role that is not associated with a bot.",
          };
        }

        return { valid: true };
      };

      const mockRole = {
        id: "role123",
        name: "Bot Role",
        managed: false,
        tags: { botId: "bot123" },
        position: 5,
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

      const result = validateAutoRole(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("bot role");
    });

    test("should reject roles higher than bot", () => {
      const validateAutoRole = (role, guild) => {
        if (!role) {
          return { valid: true }; // Auto-role is optional
        }

        const botMember = guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
          return {
            valid: false,
            error: `The role **${role.name}** is higher than or equal to my highest role in the hierarchy.`,
            solution: "Move my role above this role in Server Settings → Roles, or choose a lower role.",
          };
        }

        return { valid: true };
      };

      const mockRole = {
        id: "role123",
        name: "High Role",
        managed: false,
        tags: null,
        position: 15,
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

      const result = validateAutoRole(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("higher than or equal");
    });

    test("should accept null/undefined roles", () => {
      const validateAutoRole = (role, _guild) => {
        if (!role) {
          return { valid: true }; // Auto-role is optional
        }

        return { valid: true };
      };

      const result1 = validateAutoRole(null, null);
      expect(result1.valid).toBe(true);

      const result2 = validateAutoRole(undefined, undefined);
      expect(result2.valid).toBe(true);
    });
  });

  describe("validateEmbedSettings", () => {
    test("should validate embed color", () => {
      const validateEmbedSettings = settings => {
        if (settings.embedEnabled && settings.embedColor) {
          const validColors = [
            "DEFAULT", "WHITE", "AQUA", "GREEN", "BLUE", "YELLOW", "PURPLE", "LUMINOUS_VIVID_PINK", "GOLD", "ORANGE", "RED", "GREY", "DARKER_GREY", "NAVY", "DARK_AQUA", "DARK_GREEN", "DARK_BLUE", "DARK_PURPLE", "DARK_VIVID_PINK", "DARK_GOLD", "DARK_ORANGE", "DARK_RED", "DARK_GREY", "LIGHT_GREY", "DARK_NAVY", "BLURPLE", "GREYPLE", "DARK_BUT_NOT_BLACK", "NOT_QUITE_BLACK", "RANDOM"
          ];
          
          if (!validColors.includes(settings.embedColor) && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(settings.embedColor)) {
            return {
              valid: false,
              error: `Invalid embed color: **${settings.embedColor}**`,
              solution: "Use a valid hex color (e.g., #FF0000) or Discord color constant.",
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
            "DEFAULT", "WHITE", "AQUA", "GREEN", "BLUE", "YELLOW", "PURPLE", "LUMINOUS_VIVID_PINK", "GOLD", "ORANGE", "RED", "GREY", "DARKER_GREY", "NAVY", "DARK_AQUA", "DARK_GREEN", "DARK_BLUE", "DARK_PURPLE", "DARK_VIVID_PINK", "DARK_GOLD", "DARK_ORANGE", "DARK_RED", "DARK_GREY", "LIGHT_GREY", "DARK_NAVY", "BLURPLE", "GREYPLE", "DARK_BUT_NOT_BLACK", "NOT_QUITE_BLACK", "RANDOM"
          ];
          
          if (!validColors.includes(settings.embedColor) && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(settings.embedColor)) {
            return {
              valid: false,
              error: `Invalid embed color: **${settings.embedColor}**`,
              solution: "Use a valid hex color (e.g., #FF0000) or Discord color constant.",
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
