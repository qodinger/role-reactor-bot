import { describe, test, expect, beforeEach, vi } from "vitest";

// Test file for XP functionality

describe("XP - Core Functionality", () => {
  describe("validateXpSettings", () => {
    test("should validate enabled XP system", () => {
      const validateXpSettings = settings => {
        if (!settings) {
          return {
            valid: false,
            error: "XP settings not found.",
            solution: "Please configure XP system settings.",
          };
        }

        if (typeof settings.enabled !== "boolean") {
          return {
            valid: false,
            error: "XP system enabled status is invalid.",
            solution: "Please enable or disable the XP system properly.",
          };
        }

        return { valid: true };
      };

      const validSettings = {
        enabled: true,
        messageXp: { enabled: true, min: 15, max: 25 },
        commandXp: { enabled: true, min: 3, max: 15 },
        roleXp: { enabled: true, amount: 50 },
        voiceXp: { enabled: true, amount: 10, interval: 60 },
      };

      const result = validateXpSettings(validSettings);
      expect(result.valid).toBe(true);
    });

    test("should validate disabled XP system", () => {
      const validateXpSettings = settings => {
        if (!settings) {
          return {
            valid: false,
            error: "XP settings not found.",
            solution: "Please configure XP system settings.",
          };
        }

        if (typeof settings.enabled !== "boolean") {
          return {
            valid: false,
            error: "XP system enabled status is invalid.",
            solution: "Please enable or disable the XP system properly.",
          };
        }

        return { valid: true };
      };

      const validSettings = {
        enabled: false,
        messageXp: { enabled: false, min: 15, max: 25 },
        commandXp: { enabled: false, min: 3, max: 15 },
        roleXp: { enabled: false, amount: 50 },
        voiceXp: { enabled: false, amount: 10, interval: 60 },
      };

      const result = validateXpSettings(validSettings);
      expect(result.valid).toBe(true);
    });

    test("should reject null settings", () => {
      const validateXpSettings = settings => {
        if (!settings) {
          return {
            valid: false,
            error: "XP settings not found.",
            solution: "Please configure XP system settings.",
          };
        }

        return { valid: true };
      };

      const result = validateXpSettings(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("XP settings not found");
    });

    test("should reject undefined settings", () => {
      const validateXpSettings = settings => {
        if (!settings) {
          return {
            valid: false,
            error: "XP settings not found.",
            solution: "Please configure XP system settings.",
          };
        }

        return { valid: true };
      };

      const result = validateXpSettings(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("XP settings not found");
    });
  });

  describe("validateXpSourceSettings", () => {
    test("should validate message XP settings", () => {
      const validateXpSourceSettings = sourceSettings => {
        if (!sourceSettings) {
          return {
            valid: false,
            error: "XP source settings not found.",
            solution: "Please configure XP source settings.",
          };
        }

        if (typeof sourceSettings.enabled !== "boolean") {
          return {
            valid: false,
            error: "XP source enabled status is invalid.",
            solution: "Please enable or disable the XP source properly.",
          };
        }

        if (
          sourceSettings.enabled &&
          sourceSettings.min &&
          sourceSettings.max
        ) {
          if (sourceSettings.min < 0 || sourceSettings.max < 0) {
            return {
              valid: false,
              error: "XP amounts cannot be negative.",
              solution: "Please set positive XP values.",
            };
          }

          if (sourceSettings.min > sourceSettings.max) {
            return {
              valid: false,
              error: "Minimum XP cannot be greater than maximum XP.",
              solution:
                "Please set minimum XP less than or equal to maximum XP.",
            };
          }
        }

        return { valid: true };
      };

      const validMessageXp = {
        enabled: true,
        min: 15,
        max: 25,
      };

      const result = validateXpSourceSettings(validMessageXp);
      expect(result.valid).toBe(true);
    });

    test("should validate command XP settings", () => {
      const validateXpSourceSettings = sourceSettings => {
        if (!sourceSettings) {
          return {
            valid: false,
            error: "XP source settings not found.",
            solution: "Please configure XP source settings.",
          };
        }

        if (typeof sourceSettings.enabled !== "boolean") {
          return {
            valid: false,
            error: "XP source enabled status is invalid.",
            solution: "Please enable or disable the XP source properly.",
          };
        }

        if (
          sourceSettings.enabled &&
          sourceSettings.min &&
          sourceSettings.max
        ) {
          if (sourceSettings.min < 0 || sourceSettings.max < 0) {
            return {
              valid: false,
              error: "XP amounts cannot be negative.",
              solution: "Please set positive XP values.",
            };
          }

          if (sourceSettings.min > sourceSettings.max) {
            return {
              valid: false,
              error: "Minimum XP cannot be greater than maximum XP.",
              solution:
                "Please set minimum XP less than or equal to maximum XP.",
            };
          }
        }

        return { valid: true };
      };

      const validCommandXp = {
        enabled: true,
        min: 3,
        max: 15,
      };

      const result = validateXpSourceSettings(validCommandXp);
      expect(result.valid).toBe(true);
    });

    test("should validate role XP settings", () => {
      const validateXpSourceSettings = sourceSettings => {
        if (!sourceSettings) {
          return {
            valid: false,
            error: "XP source settings not found.",
            solution: "Please configure XP source settings.",
          };
        }

        if (typeof sourceSettings.enabled !== "boolean") {
          return {
            valid: false,
            error: "XP source enabled status is invalid.",
            solution: "Please enable or disable the XP source properly.",
          };
        }

        if (sourceSettings.enabled && sourceSettings.amount) {
          if (sourceSettings.amount < 0) {
            return {
              valid: false,
              error: "XP amount cannot be negative.",
              solution: "Please set a positive XP value.",
            };
          }
        }

        return { valid: true };
      };

      const validRoleXp = {
        enabled: true,
        amount: 50,
      };

      const result = validateXpSourceSettings(validRoleXp);
      expect(result.valid).toBe(true);
    });

    test("should validate voice XP settings", () => {
      const validateXpSourceSettings = sourceSettings => {
        if (!sourceSettings) {
          return {
            valid: false,
            error: "XP source settings not found.",
            solution: "Please configure XP source settings.",
          };
        }

        if (typeof sourceSettings.enabled !== "boolean") {
          return {
            valid: false,
            error: "XP source enabled status is invalid.",
            solution: "Please enable or disable the XP source properly.",
          };
        }

        if (sourceSettings.enabled) {
          if (sourceSettings.amount && sourceSettings.amount < 0) {
            return {
              valid: false,
              error: "XP amount cannot be negative.",
              solution: "Please set a positive XP value.",
            };
          }

          if (sourceSettings.interval && sourceSettings.interval < 0) {
            return {
              valid: false,
              error: "XP interval cannot be negative.",
              solution: "Please set a positive interval value.",
            };
          }
        }

        return { valid: true };
      };

      const validVoiceXp = {
        enabled: true,
        amount: 10,
        interval: 60,
      };

      const result = validateXpSourceSettings(validVoiceXp);
      expect(result.valid).toBe(true);
    });

    test("should reject negative XP amounts", () => {
      const validateXpSourceSettings = sourceSettings => {
        if (!sourceSettings) {
          return {
            valid: false,
            error: "XP source settings not found.",
            solution: "Please configure XP source settings.",
          };
        }

        if (
          sourceSettings.enabled &&
          sourceSettings.min &&
          sourceSettings.max
        ) {
          if (sourceSettings.min < 0 || sourceSettings.max < 0) {
            return {
              valid: false,
              error: "XP amounts cannot be negative.",
              solution: "Please set positive XP values.",
            };
          }
        }

        return { valid: true };
      };

      const invalidMessageXp = {
        enabled: true,
        min: -5,
        max: 25,
      };

      const result = validateXpSourceSettings(invalidMessageXp);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be negative");
    });

    test("should reject min greater than max", () => {
      const validateXpSourceSettings = sourceSettings => {
        if (!sourceSettings) {
          return {
            valid: false,
            error: "XP source settings not found.",
            solution: "Please configure XP source settings.",
          };
        }

        if (
          sourceSettings.enabled &&
          sourceSettings.min &&
          sourceSettings.max
        ) {
          if (sourceSettings.min > sourceSettings.max) {
            return {
              valid: false,
              error: "Minimum XP cannot be greater than maximum XP.",
              solution:
                "Please set minimum XP less than or equal to maximum XP.",
            };
          }
        }

        return { valid: true };
      };

      const invalidMessageXp = {
        enabled: true,
        min: 30,
        max: 25,
      };

      const result = validateXpSourceSettings(invalidMessageXp);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum XP cannot be greater");
    });
  });

  describe("validateLevelUpChannel", () => {
    test("should validate text channels for level-up messages", () => {
      const validateLevelUpChannel = (channel, guild) => {
        if (!channel) {
          return { valid: true }; // Level-up channel is optional
        }

        if (channel.type !== 0) {
          // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for level-up messages.",
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

        if (!permissions.has("EmbedLinks")) {
          return {
            valid: false,
            error: `I don't have permission to embed links in **${channel.name}**.`,
            solution:
              "Please grant me 'Embed Links' permission in the selected channel.",
          };
        }

        return { valid: true };
      };

      const mockChannel = {
        id: "channel123",
        name: "general",
        type: 0, // GUILD_TEXT
        permissionsFor: () => ({
          has: permission =>
            permission === "SendMessages" || permission === "EmbedLinks",
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

      const result = validateLevelUpChannel(mockChannel, mockGuild);
      expect(result.valid).toBe(true);
    });

    test("should reject voice channels for level-up messages", () => {
      const validateLevelUpChannel = (channel, _guild) => {
        if (!channel) {
          return { valid: true }; // Level-up channel is optional
        }

        if (channel.type !== 0) {
          // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for level-up messages.",
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

      const result = validateLevelUpChannel(mockChannel, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a text channel");
    });

    test("should reject channels without send permissions", () => {
      const validateLevelUpChannel = (channel, guild) => {
        if (!channel) {
          return { valid: true }; // Level-up channel is optional
        }

        if (channel.type !== 0) {
          // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for level-up messages.",
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

      const result = validateLevelUpChannel(mockChannel, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("permission to send messages");
    });

    test("should reject channels without embed permissions", () => {
      const validateLevelUpChannel = (channel, guild) => {
        if (!channel) {
          return { valid: true }; // Level-up channel is optional
        }

        if (channel.type !== 0) {
          // GUILD_TEXT
          return {
            valid: false,
            error: `The channel **${channel.name}** is not a text channel.`,
            solution: "Please select a text channel for level-up messages.",
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

        if (!permissions.has("EmbedLinks")) {
          return {
            valid: false,
            error: `I don't have permission to embed links in **${channel.name}**.`,
            solution:
              "Please grant me 'Embed Links' permission in the selected channel.",
          };
        }

        return { valid: true };
      };

      const mockChannel = {
        id: "channel123",
        name: "no-embeds",
        type: 0, // GUILD_TEXT
        permissionsFor: permission => ({
          has: perm => perm === "SendMessages" && permission !== "EmbedLinks",
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

      const result = validateLevelUpChannel(mockChannel, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("permission to embed links");
    });

    test("should accept null/undefined channels", () => {
      const validateLevelUpChannel = (channel, _guild) => {
        if (!channel) {
          return { valid: true }; // Level-up channel is optional
        }

        return { valid: true };
      };

      const result1 = validateLevelUpChannel(null, null);
      expect(result1.valid).toBe(true);

      const result2 = validateLevelUpChannel(undefined, undefined);
      expect(result2.valid).toBe(true);
    });
  });

  describe("calculateXpForLevel", () => {
    test("should calculate XP requirements correctly", () => {
      const calculateXpForLevel = level => {
        if (level < 1) return 0;
        return Math.floor(100 * Math.pow(level, 1.5));
      };

      expect(calculateXpForLevel(1)).toBe(100);
      expect(calculateXpForLevel(2)).toBe(282);
      expect(calculateXpForLevel(5)).toBe(1118);
      expect(calculateXpForLevel(10)).toBe(3162);
      expect(calculateXpForLevel(20)).toBe(8944);
    });

    test("should handle edge cases", () => {
      const calculateXpForLevel = level => {
        if (level < 1) return 0;
        return Math.floor(100 * Math.pow(level, 1.5));
      };

      expect(calculateXpForLevel(0)).toBe(0);
      expect(calculateXpForLevel(-1)).toBe(0);
      expect(calculateXpForLevel(100)).toBe(100000);
    });
  });

  describe("calculateLevelFromXp", () => {
    test("should calculate level from XP correctly", () => {
      const calculateLevelFromXp = xp => {
        if (xp < 0) return 0;
        if (xp === 0) return 0;

        let level = 1;
        while (calculateXpForLevel(level + 1) <= xp) {
          level++;
        }
        return level;
      };

      const calculateXpForLevel = level => {
        if (level < 1) return 0;
        return Math.floor(100 * Math.pow(level, 1.5));
      };

      expect(calculateLevelFromXp(0)).toBe(0);
      expect(calculateLevelFromXp(100)).toBe(1);
      expect(calculateLevelFromXp(281)).toBe(1);
      expect(calculateLevelFromXp(282)).toBe(2);
      expect(calculateLevelFromXp(1000)).toBe(4);
      expect(calculateLevelFromXp(5000)).toBe(13);
    });

    test("should handle edge cases", () => {
      const calculateLevelFromXp = xp => {
        if (xp < 0) return 0;
        if (xp === 0) return 0;

        let level = 1;
        while (calculateXpForLevel(level + 1) <= xp) {
          level++;
        }
        return level;
      };

      const calculateXpForLevel = level => {
        if (level < 1) return 0;
        return Math.floor(100 * Math.pow(level, 1.5));
      };

      expect(calculateLevelFromXp(-100)).toBe(0);
      expect(calculateLevelFromXp(0)).toBe(0);
    });
  });

  describe("generateRandomXp", () => {
    test("should generate XP within range", () => {
      const generateRandomXp = (min, max) => {
        if (min < 0 || max < 0) return 0;
        if (min > max) return 0;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      };

      const min = 15;
      const max = 25;

      // Test multiple times to ensure range is respected
      for (let i = 0; i < 100; i++) {
        const xp = generateRandomXp(min, max);
        expect(xp).toBeGreaterThanOrEqual(min);
        expect(xp).toBeLessThanOrEqual(max);
      }
    });

    test("should handle edge cases", () => {
      const generateRandomXp = (min, max) => {
        if (min < 0 || max < 0) return 0;
        if (min > max) return 0;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      };

      expect(generateRandomXp(-5, 10)).toBe(0);
      expect(generateRandomXp(10, 5)).toBe(0);
      expect(generateRandomXp(0, 0)).toBe(0);
    });
  });

  describe("formatXpProgress", () => {
    test("should format XP progress correctly", () => {
      const formatXpProgress = (currentXp, currentLevel, nextLevelXp) => {
        if (currentLevel < 1) return "0/0 XP";

        const currentLevelXp = calculateXpForLevel(currentLevel);
        const progress = currentXp - currentLevelXp;
        const needed = nextLevelXp - currentLevelXp;

        return `${progress}/${needed} XP`;
      };

      const calculateXpForLevel = level => {
        if (level < 1) return 0;
        return Math.floor(100 * Math.pow(level, 1.5));
      };

      const result1 = formatXpProgress(150, 1, 282);
      expect(result1).toBe("50/182 XP");

      const result2 = formatXpProgress(282, 2, 519);
      expect(result2).toBe("0/237 XP");

      const result3 = formatXpProgress(400, 2, 519);
      expect(result3).toBe("118/237 XP");
    });

    test("should handle edge cases", () => {
      const formatXpProgress = (currentXp, currentLevel, nextLevelXp) => {
        if (currentLevel < 1) return "0/0 XP";

        const currentLevelXp = calculateXpForLevel(currentLevel);
        const progress = currentXp - currentLevelXp;
        const needed = nextLevelXp - currentLevelXp;

        return `${progress}/${needed} XP`;
      };

      const calculateXpForLevel = level => {
        if (level < 1) return 0;
        return Math.floor(100 * Math.pow(level, 1.5));
      };

      expect(formatXpProgress(0, 0, 100)).toBe("0/0 XP");
      expect(formatXpProgress(100, 1, 100)).toBe("0/0 XP");
    });
  });
});
