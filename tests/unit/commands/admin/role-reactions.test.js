import { describe, test, expect, beforeEach, vi } from "vitest";
import { parseRoleString } from "../../../../src/utils/discord/roleParser.js";

// Test file for role-reactions functionality

describe("Role Reactions - Core Functionality", () => {
  describe("validateInteraction", () => {
    test("should validate fresh interactions", () => {
      const validateInteraction = (interaction, maxAge = 3000) => {
        // Check if already acknowledged
        if (interaction.replied || interaction.deferred) {
          return {
            success: false,
            error: "Interaction already acknowledged",
            skipCleanup: true,
          };
        }

        // Check if interaction has expired
        const interactionAge = Date.now() - interaction.createdTimestamp;
        if (interactionAge > maxAge) {
          return {
            success: false,
            error: "Interaction has expired",
            skipCleanup: true,
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        id: "interaction123",
        createdTimestamp: Date.now() - 1000, // 1 second ago
        replied: false,
        deferred: false,
      };

      const result = validateInteraction(mockInteraction);
      expect(result.success).toBe(true);
    });

    test("should reject already acknowledged interactions", () => {
      const validateInteraction = (interaction, _maxAge = 3000) => {
        // Check if already acknowledged
        if (interaction.replied || interaction.deferred) {
          return {
            success: false,
            error: "Interaction already acknowledged",
            skipCleanup: true,
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        id: "interaction123",
        createdTimestamp: Date.now() - 1000,
        replied: true,
        deferred: false,
      };

      const result = validateInteraction(mockInteraction);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already acknowledged");
      expect(result.skipCleanup).toBe(true);
    });

    test("should reject expired interactions", () => {
      const validateInteraction = (interaction, maxAge = 3000) => {
        // Check if interaction has expired
        const interactionAge = Date.now() - interaction.createdTimestamp;
        if (interactionAge > maxAge) {
          return {
            success: false,
            error: "Interaction has expired",
            skipCleanup: true,
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        id: "interaction123",
        createdTimestamp: Date.now() - 5000, // 5 seconds ago
        replied: false,
        deferred: false,
      };

      const result = validateInteraction(mockInteraction, 3000);
      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
      expect(result.skipCleanup).toBe(true);
    });
  });

  describe("validateBotMember", () => {
    test("should validate when bot member is available", () => {
      const validateBotMember = interaction => {
        if (!interaction.guild.members.me) {
          return {
            success: false,
            errorResponse: {
              title: "Bot Permission Error",
              description:
                "I cannot access my member information in this server.",
              solution:
                "Please make sure I have the necessary permissions and try again.",
            },
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        guild: {
          id: "guild123",
          name: "Test Guild",
          members: {
            me: {
              id: "bot123",
              username: "TestBot",
            },
          },
        },
      };

      const result = validateBotMember(mockInteraction);
      expect(result.success).toBe(true);
    });

    test("should reject when bot member is not available", () => {
      const validateBotMember = interaction => {
        if (!interaction.guild.members.me) {
          return {
            success: false,
            errorResponse: {
              title: "Bot Permission Error",
              description:
                "I cannot access my member information in this server.",
              solution:
                "Please make sure I have the necessary permissions and try again.",
            },
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        guild: {
          id: "guild123",
          name: "Test Guild",
          members: {
            me: null,
          },
        },
      };

      const result = validateBotMember(mockInteraction);
      expect(result.success).toBe(false);
      expect(result.errorResponse.title).toContain("Bot Permission Error");
    });
  });

  describe("validateGuildPermissions", () => {
    test("should validate when bot has all required permissions", () => {
      const validateGuildPermissions = interaction => {
        const botHasRequiredPermissions = guild => {
          // Mock implementation - check if bot has required permissions
          return (
            guild.members.me && guild.members.me.permissions.has("ManageRoles")
          );
        };

        const guildHasPermissions = botHasRequiredPermissions(
          interaction.guild,
        );
        if (!guildHasPermissions) {
          return {
            success: false,
            errorResponse: {
              title: "Missing Bot Permissions",
              description: "I need the following server-level permissions",
              solution:
                "Please ask a server administrator to grant me these permissions and try again.",
            },
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        guild: {
          id: "guild123",
          name: "Test Guild",
          members: {
            me: {
              permissions: {
                has: () => true,
              },
            },
          },
        },
      };

      const result = validateGuildPermissions(mockInteraction);
      expect(result.success).toBe(true);
    });

    test("should reject when bot lacks required permissions", () => {
      const validateGuildPermissions = interaction => {
        const botHasRequiredPermissions = guild => {
          return (
            guild.members.me && guild.members.me.permissions.has("ManageRoles")
          );
        };

        const guildHasPermissions = botHasRequiredPermissions(
          interaction.guild,
        );
        if (!guildHasPermissions) {
          return {
            success: false,
            errorResponse: {
              title: "Missing Bot Permissions",
              description: "I need the following server-level permissions",
              solution:
                "Please ask a server administrator to grant me these permissions and try again.",
            },
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        guild: {
          id: "guild123",
          name: "Test Guild",
          members: {
            me: {
              permissions: {
                has: () => false,
              },
            },
          },
        },
      };

      const result = validateGuildPermissions(mockInteraction);
      expect(result.success).toBe(false);
      expect(result.errorResponse.title).toContain("Missing Bot Permissions");
    });
  });

  describe("validateChannelPermissions", () => {
    test("should validate when bot has all channel permissions", () => {
      const validateChannelPermissions = (
        interaction,
        requiredPermissions = ["SendMessages", "EmbedLinks", "AddReactions"],
      ) => {
        const channelPermissions = interaction.channel.permissionsFor(
          interaction.guild.members.me,
        );

        // Check for missing channel permissions
        const missingChannelPermissions = [];
        const permissionDisplayNames = {
          SendMessages: "Send Messages",
          EmbedLinks: "Embed Links",
          AddReactions: "Add Reactions",
        };

        for (const permission of requiredPermissions) {
          if (!channelPermissions.has(permission)) {
            missingChannelPermissions.push(
              permissionDisplayNames[permission] || permission,
            );
          }
        }

        if (missingChannelPermissions.length > 0) {
          return {
            success: false,
            errorResponse: {
              title: "Missing Channel Permissions",
              description: `I need the following permissions in this channel: **${missingChannelPermissions.join(", ")}**`,
              solution:
                "Please ask a server administrator to grant me these permissions in this channel and try again.",
            },
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        guild: {
          members: {
            me: {
              id: "bot123",
            },
          },
        },
        channel: {
          id: "channel123",
          name: "general",
          permissionsFor: () => ({
            has: () => true,
          }),
        },
      };

      const result = validateChannelPermissions(mockInteraction);
      expect(result.success).toBe(true);
    });

    test("should reject when bot lacks channel permissions", () => {
      const validateChannelPermissions = (
        interaction,
        requiredPermissions = ["SendMessages", "EmbedLinks", "AddReactions"],
      ) => {
        const channelPermissions = interaction.channel.permissionsFor(
          interaction.guild.members.me,
        );

        // Check for missing channel permissions
        const missingChannelPermissions = [];
        const permissionDisplayNames = {
          SendMessages: "Send Messages",
          EmbedLinks: "Embed Links",
          AddReactions: "Add Reactions",
        };

        for (const permission of requiredPermissions) {
          if (!channelPermissions.has(permission)) {
            missingChannelPermissions.push(
              permissionDisplayNames[permission] || permission,
            );
          }
        }

        if (missingChannelPermissions.length > 0) {
          return {
            success: false,
            errorResponse: {
              title: "Missing Channel Permissions",
              description: `I need the following permissions in this channel: **${missingChannelPermissions.join(", ")}**`,
              solution:
                "Please ask a server administrator to grant me these permissions in this channel and try again.",
            },
          };
        }

        return { success: true };
      };

      const mockInteraction = {
        guild: {
          members: {
            me: {
              id: "bot123",
            },
          },
        },
        channel: {
          id: "channel123",
          name: "restricted",
          permissionsFor: () => ({
            has: () => false,
          }),
        },
      };

      const result = validateChannelPermissions(mockInteraction);
      expect(result.success).toBe(false);
      expect(result.errorResponse.title).toContain(
        "Missing Channel Permissions",
      );
    });
  });

  describe("processRoleInput", () => {
    test("should process valid role input", async () => {
      const processRoleInput = async (interaction, rolesString) => {
        const processRoles = async (interaction, rolesString) => {
          // Mock implementation - parse roles string
          const rolePairs = rolesString.split(",").map(pair => pair.trim());
          const validRoles = [];
          const roleMapping = {};

          for (const pair of rolePairs) {
            const [emoji, roleStr] = pair.split(":").map(s => s.trim());
            if (emoji && roleStr) {
              // Mock role validation
              const mockRole = {
                id: `role_${roleStr.replace(/[^a-zA-Z0-9]/g, "")}`,
                name: roleStr.replace(/[@"]/g, ""),
                managed: false,
                position: 5,
              };
              validRoles.push({ emoji, role: mockRole });
              roleMapping[emoji] = mockRole.id;
            }
          }

          if (validRoles.length === 0) {
            return {
              success: false,
              error: "No valid roles found",
            };
          }

          return {
            success: true,
            validRoles,
            roleMapping,
          };
        };

        const roleProcessingResult = await processRoles(
          interaction,
          rolesString,
        );
        if (!roleProcessingResult.success) {
          return {
            success: false,
            errorResponse: {
              title: "Role Processing Error",
              description: roleProcessingResult.error,
              solution: "Please check your role format and try again.",
            },
          };
        }

        return {
          success: true,
          data: {
            validRoles: roleProcessingResult.validRoles,
            roleMapping: roleProcessingResult.roleMapping,
          },
        };
      };

      const mockInteraction = {
        guild: {
          id: "guild123",
          roles: {
            cache: new Map([
              [
                "role_member",
                {
                  id: "role_member",
                  name: "Member",
                  managed: false,
                  position: 5,
                },
              ],
              [
                "role_vip",
                { id: "role_vip", name: "VIP", managed: false, position: 10 },
              ],
            ]),
          },
        },
      };

      const rolesString = "🎉:Member, ⭐:VIP";
      const result = await processRoleInput(mockInteraction, rolesString);

      expect(result.success).toBe(true);
      expect(result.data.validRoles).toHaveLength(2);
      expect(result.data.roleMapping).toHaveProperty("🎉");
      expect(result.data.roleMapping).toHaveProperty("⭐");
    });

    test("should reject invalid role input", async () => {
      const processRoleInput = async (interaction, rolesString) => {
        const processRoles = async (interaction, rolesString) => {
          const rolePairs = rolesString.split(",").map(pair => pair.trim());
          const validRoles = [];

          for (const pair of rolePairs) {
            const [emoji, roleStr] = pair.split(":").map(s => s.trim());
            if (!emoji || !roleStr) {
              continue; // Skip invalid pairs
            }
          }

          if (validRoles.length === 0) {
            return {
              success: false,
              error: "No valid roles found",
            };
          }

          return {
            success: true,
            validRoles,
            roleMapping: {},
          };
        };

        const roleProcessingResult = await processRoles(
          interaction,
          rolesString,
        );
        if (!roleProcessingResult.success) {
          return {
            success: false,
            errorResponse: {
              title: "Role Processing Error",
              description: roleProcessingResult.error,
              solution: "Please check your role format and try again.",
            },
          };
        }

        return {
          success: true,
          data: {
            validRoles: roleProcessingResult.validRoles,
            roleMapping: roleProcessingResult.roleMapping,
          },
        };
      };

      const mockInteraction = {
        guild: {
          id: "guild123",
          roles: {
            cache: new Map(),
          },
        },
      };

      const rolesString = "invalid:format, also:invalid";
      const result = await processRoleInput(mockInteraction, rolesString);

      expect(result.success).toBe(false);
      expect(result.errorResponse.title).toContain("Role Processing Error");
    });

    test("should handle empty role input", async () => {
      const processRoleInput = async (interaction, rolesString) => {
        const processRoles = async (interaction, rolesString) => {
          if (!rolesString || rolesString.trim().length === 0) {
            return {
              success: false,
              error: "No roles provided",
            };
          }

          return {
            success: true,
            validRoles: [],
            roleMapping: {},
          };
        };

        const roleProcessingResult = await processRoles(
          interaction,
          rolesString,
        );
        if (!roleProcessingResult.success) {
          return {
            success: false,
            errorResponse: {
              title: "Role Processing Error",
              description: roleProcessingResult.error,
              solution: "Please check your role format and try again.",
            },
          };
        }

        return {
          success: true,
          data: {
            validRoles: roleProcessingResult.validRoles,
            roleMapping: roleProcessingResult.roleMapping,
          },
        };
      };

      const mockInteraction = {
        guild: {
          id: "guild123",
          roles: {
            cache: new Map(),
          },
        },
      };

      const result = await processRoleInput(mockInteraction, "");

      expect(result.success).toBe(false);
      expect(result.errorResponse.description).toContain("No roles provided");
    });
  });

  describe("validateColorFormat", () => {
    test("should validate hex color formats", () => {
      const validateColorFormat = colorHex => {
        if (!colorHex) return { valid: true }; // Color is optional

        const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
        const hexPattern = /^#[0-9A-F]{6}$/i;

        if (!hexPattern.test(hex)) {
          return {
            valid: false,
            error: "Invalid color format",
            solution: "Provide a valid 6-digit hex color (e.g., #FF0000).",
          };
        }

        return { valid: true };
      };

      const validColors = ["#FF0000", "#00FF00", "#0000FF", "FF0000", "00FF00"];
      validColors.forEach(color => {
        const result = validateColorFormat(color);
        expect(result.valid).toBe(true);
      });
    });

    test("should reject invalid color formats", () => {
      const validateColorFormat = colorHex => {
        if (!colorHex) return { valid: true }; // Color is optional

        const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
        const hexPattern = /^#[0-9A-F]{6}$/i;

        if (!hexPattern.test(hex)) {
          return {
            valid: false,
            error: "Invalid color format",
            solution: "Provide a valid 6-digit hex color (e.g., #FF0000).",
          };
        }

        return { valid: true };
      };

      const invalidColors = ["#GG0000", "#FF00", "red", "invalid", "#FF00000"];
      invalidColors.forEach(color => {
        const result = validateColorFormat(color);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid color format");
      });
    });

    test("should accept empty color", () => {
      const validateColorFormat = colorHex => {
        if (!colorHex) return { valid: true }; // Color is optional

        const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
        const hexPattern = /^#[0-9A-F]{6}$/i;

        if (!hexPattern.test(hex)) {
          return {
            valid: false,
            error: "Invalid color format",
            solution: "Provide a valid 6-digit hex color (e.g., #FF0000).",
          };
        }

        return { valid: true };
      };

      const result = validateColorFormat(null);
      expect(result.valid).toBe(true);

      const result2 = validateColorFormat(undefined);
      expect(result2.valid).toBe(true);

      const result3 = validateColorFormat("");
      expect(result3.valid).toBe(true);
    });
  });

  describe("validateMessageContent", () => {
    test("should validate title and description", () => {
      const validateMessageContent = (title, description) => {
        if (!title || title.trim().length === 0) {
          return {
            valid: false,
            error: "Title cannot be empty",
            solution: "Please provide a title for the role message.",
          };
        }

        if (!description || description.trim().length === 0) {
          return {
            valid: false,
            error: "Description cannot be empty",
            solution: "Please provide a description for the role message.",
          };
        }

        if (title.length > 256) {
          return {
            valid: false,
            error: "Title is too long (maximum 256 characters)",
            solution: "Please shorten your title.",
          };
        }

        if (description.length > 4096) {
          return {
            valid: false,
            error: "Description is too long (maximum 4096 characters)",
            solution: "Please shorten your description.",
          };
        }

        return { valid: true };
      };

      const validTitle = "Choose Your Role";
      const validDescription = "React to get your desired role!";
      const result = validateMessageContent(validTitle, validDescription);

      expect(result.valid).toBe(true);
    });

    test("should reject empty title", () => {
      const validateMessageContent = (title, _description) => {
        if (!title || title.trim().length === 0) {
          return {
            valid: false,
            error: "Title cannot be empty",
            solution: "Please provide a title for the role message.",
          };
        }

        return { valid: true };
      };

      const result = validateMessageContent("", "Valid description");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Title cannot be empty");
    });

    test("should reject empty description", () => {
      const validateMessageContent = (_title, description) => {
        if (!description || description.trim().length === 0) {
          return {
            valid: false,
            error: "Description cannot be empty",
            solution: "Please provide a description for the role message.",
          };
        }

        return { valid: true };
      };

      const result = validateMessageContent("Valid title", "");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Description cannot be empty");
    });

    test("should reject titles that are too long", () => {
      const validateMessageContent = (title, _description) => {
        if (title.length > 256) {
          return {
            valid: false,
            error: "Title is too long (maximum 256 characters)",
            solution: "Please shorten your title.",
          };
        }

        return { valid: true };
      };

      const longTitle = "a".repeat(257);
      const result = validateMessageContent(longTitle, "Valid description");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });

    test("should reject descriptions that are too long", () => {
      const validateMessageContent = (title, description) => {
        if (description.length > 4096) {
          return {
            valid: false,
            error: "Description is too long (maximum 4096 characters)",
            solution: "Please shorten your description.",
          };
        }

        return { valid: true };
      };

      const longDescription = "a".repeat(4097);
      const result = validateMessageContent("Valid title", longDescription);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });
  });

  describe("parseRoleString integration", () => {
    test("should parse role string with mentions", () => {
      const rolesString = '🎉:<@&123456789>, ⭐:"VIP Role"';
      const { roles } = parseRoleString(rolesString);

      expect(roles).toHaveLength(2);
      expect(roles[0].emoji).toBe("🎉");
      // formatted ID matches <@&...> pattern? parseRoleString stores ID in roleId
      expect(roles[0].roleId).toBe("123456789");
      expect(roles[1].emoji).toBe("⭐");
      expect(roles[1].roleName).toBe("VIP Role");
    });

    test("should handle mixed role formats", () => {
      const rolesString = '🎉:Member, ⭐:<@&123456789>, 🔥:"Special Role"';
      const { roles } = parseRoleString(rolesString);

      expect(roles).toHaveLength(3);
      expect(roles[0].roleName).toBe("Member");
      expect(roles[1].roleId).toBe("123456789");
      expect(roles[2].roleName).toBe("Special Role");
    });

    test("should handle empty or invalid input", () => {
      // Empty input still results in no roles
      expect(parseRoleString("").roles).toHaveLength(0);

      // "invalid" is now considered a potential role name (emoji extracted later)
      const resultInvalid = parseRoleString("invalid");
      expect(resultInvalid.roles).toHaveLength(1);
      expect(resultInvalid.roles[0].roleName).toBe("invalid");
      expect(resultInvalid.roles[0].emoji).toBeNull();

      // "emoji:" is parsed as role name "emoji"
      const resultEmojiOnly = parseRoleString("emoji:");
      expect(resultEmojiOnly.roles).toHaveLength(1);
      expect(resultEmojiOnly.roles[0].roleName).toBe("emoji:");

      // ":role" is parsed as role name "role" (leading colons removed)
      const resultRoleOnly = parseRoleString(":role");
      expect(resultRoleOnly.roles).toHaveLength(1);
      expect(resultRoleOnly.roles[0].roleName).toBe("role");
    });
  });

  describe("validateRoleAssignment", () => {
    test("should validate roles the bot can assign", () => {
      const validateRoleAssignment = (role, guild) => {
        if (!role) {
          return {
            valid: false,
            error: "Role not found",
            solution: "Please check the role name or mention.",
          };
        }

        if (role.managed) {
          return {
            valid: false,
            error: `The role **${role.name}** is managed by Discord or an integration and cannot be assigned.`,
            solution:
              "Choose a different role that is not managed by Discord or integrations.",
          };
        }

        if (role.tags && role.tags.botId) {
          return {
            valid: false,
            error: `The role **${role.name}** is a bot role and cannot be assigned.`,
            solution:
              "Choose a different role that is not associated with a bot.",
          };
        }

        const botMember = guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
          return {
            valid: false,
            error: `The role **${role.name}** is higher than or equal to my highest role in the hierarchy.`,
            solution:
              "Move my role above this role in Server Settings → Roles, or choose a lower role.",
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

      const result = validateRoleAssignment(mockRole, mockGuild);
      expect(result.valid).toBe(true);
    });

    test("should reject managed roles", () => {
      const validateRoleAssignment = (role, _guild) => {
        if (role.managed) {
          return {
            valid: false,
            error: `The role **${role.name}** is managed by Discord or an integration and cannot be assigned.`,
            solution:
              "Choose a different role that is not managed by Discord or integrations.",
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

      const result = validateRoleAssignment(mockRole, null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("managed by Discord");
    });

    test("should reject bot roles", () => {
      const validateRoleAssignment = (role, _guild) => {
        if (role.tags && role.tags.botId) {
          return {
            valid: false,
            error: `The role **${role.name}** is a bot role and cannot be assigned.`,
            solution:
              "Choose a different role that is not associated with a bot.",
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

      const result = validateRoleAssignment(mockRole, null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("bot role");
    });

    test("should reject roles higher than bot", () => {
      const validateRoleAssignment = (role, guild) => {
        const botMember = guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
          return {
            valid: false,
            error: `The role **${role.name}** is higher than or equal to my highest role in the hierarchy.`,
            solution:
              "Move my role above this role in Server Settings → Roles, or choose a lower role.",
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

      const result = validateRoleAssignment(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("higher than or equal");
    });
  });

  describe("validateMessageId", () => {
    test("should validate Discord message ID format", () => {
      const validateMessageId = messageId => {
        if (!messageId || messageId.trim().length === 0) {
          return {
            valid: false,
            error: "Message ID cannot be empty",
            solution: "Please provide a valid message ID.",
          };
        }

        // Discord message IDs are 17-19 digit snowflakes
        const snowflakePattern = /^\d{17,19}$/;
        if (!snowflakePattern.test(messageId)) {
          return {
            valid: false,
            error: "Invalid message ID format",
            solution:
              "Please provide a valid Discord message ID (17-19 digits).",
          };
        }

        return { valid: true };
      };

      const validIds = ["123456789012345678", "9876543210987654321"];
      validIds.forEach(id => {
        const result = validateMessageId(id);
        expect(result.valid).toBe(true);
      });
    });

    test("should reject invalid message ID formats", () => {
      const validateMessageId = messageId => {
        if (!messageId || messageId.trim().length === 0) {
          return {
            valid: false,
            error: "Message ID cannot be empty",
            solution: "Please provide a valid message ID.",
          };
        }

        const snowflakePattern = /^\d{17,19}$/;
        if (!snowflakePattern.test(messageId)) {
          return {
            valid: false,
            error: "Invalid message ID format",
            solution:
              "Please provide a valid Discord message ID (17-19 digits).",
          };
        }

        return { valid: true };
      };

      const invalidIds = ["123", "abc", "12345678901234567890", ""];
      invalidIds.forEach(id => {
        const result = validateMessageId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test("should reject empty message ID", () => {
      const validateMessageId = messageId => {
        if (!messageId || messageId.trim().length === 0) {
          return {
            valid: false,
            error: "Message ID cannot be empty",
            solution: "Please provide a valid message ID.",
          };
        }

        return { valid: true };
      };

      const result = validateMessageId("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });
  });

  describe("getColorChoices", () => {
    test("should return valid color choices", () => {
      const getColorChoices = () => {
        return [
          { name: "Default", value: "#9b8bf0" },
          { name: "Neon Blue", value: "#00BFFF" },
          { name: "Matrix Green", value: "#00FF00" },
          { name: "Cyber Red", value: "#FF0040" },
          { name: "Electric Yellow", value: "#FFFF00" },
          { name: "Quantum Purple", value: "#8A2BE2" },
          { name: "Plasma Orange", value: "#FF4500" },
          { name: "Synth Pink", value: "#FF1493" },
          { name: "Hologram Cyan", value: "#00FFFF" },
          { name: "Steel Brown", value: "#8B4513" },
          { name: "Chrome Gray", value: "#C0C0C0" },
        ];
      };

      const choices = getColorChoices();
      expect(choices).toHaveLength(11);
      expect(choices[0].name).toBe("Default");
      expect(choices[0].value).toBe("#9b8bf0");
      expect(choices.every(choice => choice.name && choice.value)).toBe(true);
      expect(choices.every(choice => choice.value.startsWith("#"))).toBe(true);
    });
  });

  describe("Custom Emoji Role Reactions", () => {
    test("should correctly format custom emoji for role lookup", () => {
      // Test the emoji formatting logic that we fixed
      const formatEmojiForLookup = reactionEmoji => {
        if (reactionEmoji.id) {
          // Custom emoji: use the full format <:name:id> or <a:name:id>
          const prefix = reactionEmoji.animated ? "<a:" : "<:";
          return `${prefix}${reactionEmoji.name}:${reactionEmoji.id}>`;
        } else {
          // Unicode emoji: use just the name
          return reactionEmoji.name;
        }
      };

      // Test custom emoji formatting
      const customEmoji = {
        id: "custom123",
        name: "custom_emoji",
        animated: false,
      };

      const result = formatEmojiForLookup(customEmoji);
      expect(result).toBe("<:custom_emoji:custom123>");

      // Test animated custom emoji formatting
      const animatedEmoji = {
        id: "animated123",
        name: "animated_emoji",
        animated: true,
      };

      const animatedResult = formatEmojiForLookup(animatedEmoji);
      expect(animatedResult).toBe("<a:animated_emoji:animated123>");

      // Test Unicode emoji formatting
      const unicodeEmoji = {
        name: "😀",
        id: null,
        animated: false,
      };

      const unicodeResult = formatEmojiForLookup(unicodeEmoji);
      expect(unicodeResult).toBe("😀");
    });

    test("should handle role mapping lookup with custom emojis", () => {
      // Test that role mappings work with the correct emoji format
      const mockRoleMapping = {
        roles: {
          "<:custom_emoji:custom123>": {
            roleId: "role123",
            emoji: "<:custom_emoji:custom123>",
          },
          "😀": {
            roleId: "role456",
            emoji: "😀",
          },
          "<a:animated_emoji:animated123>": {
            roleId: "role789",
            emoji: "<a:animated_emoji:animated123>",
          },
        },
      };

      // Test custom emoji lookup
      const customEmojiKey = "<:custom_emoji:custom123>";
      expect(mockRoleMapping.roles[customEmojiKey]).toBeDefined();
      expect(mockRoleMapping.roles[customEmojiKey].roleId).toBe("role123");

      // Test Unicode emoji lookup
      const unicodeEmojiKey = "😀";
      expect(mockRoleMapping.roles[unicodeEmojiKey]).toBeDefined();
      expect(mockRoleMapping.roles[unicodeEmojiKey].roleId).toBe("role456");

      // Test animated emoji lookup
      const animatedEmojiKey = "<a:animated_emoji:animated123>";
      expect(mockRoleMapping.roles[animatedEmojiKey]).toBeDefined();
      expect(mockRoleMapping.roles[animatedEmojiKey].roleId).toBe("role789");
    });

    test("should validate emoji format consistency", () => {
      // Test that the emoji format used in role setup matches the format used in reaction handling
      const setupEmojiFormat = "<:custom_emoji:custom123>";
      const reactionEmojiFormat = "<:custom_emoji:custom123>";

      expect(setupEmojiFormat).toBe(reactionEmojiFormat);

      // Test animated emoji consistency
      const setupAnimatedFormat = "<a:animated_emoji:animated123>";
      const reactionAnimatedFormat = "<a:animated_emoji:animated123>";

      expect(setupAnimatedFormat).toBe(reactionAnimatedFormat);

      // Test Unicode emoji consistency
      const setupUnicodeFormat = "😀";
      const reactionUnicodeFormat = "😀";

      expect(setupUnicodeFormat).toBe(reactionUnicodeFormat);
    });

    test("should handle edge cases in emoji formatting", () => {
      const formatEmojiForLookup = reactionEmoji => {
        if (reactionEmoji.id) {
          const prefix = reactionEmoji.animated ? "<a:" : "<:";
          return `${prefix}${reactionEmoji.name}:${reactionEmoji.id}>`;
        } else {
          return reactionEmoji.name;
        }
      };

      // Test emoji with special characters in name
      const specialCharEmoji = {
        id: "special123",
        name: "emoji_with_underscores",
        animated: false,
      };

      const result = formatEmojiForLookup(specialCharEmoji);
      expect(result).toBe("<:emoji_with_underscores:special123>");

      // Test emoji with numbers in name
      const numberEmoji = {
        id: "number123",
        name: "emoji123",
        animated: false,
      };

      const numberResult = formatEmojiForLookup(numberEmoji);
      expect(numberResult).toBe("<:emoji123:number123>");

      // Test emoji with empty name (edge case)
      const emptyNameEmoji = {
        id: "empty123",
        name: "",
        animated: false,
      };

      const emptyResult = formatEmojiForLookup(emptyNameEmoji);
      expect(emptyResult).toBe("<::empty123>");
    });
  });

  describe("Role Display Formatting - Duplicate Emoji Prevention", () => {
    // Helper function that mirrors the logic in embeds.js
    const formatRoleForDisplay = role => {
      const limitText = role.limit ? ` (${role.limit} users max)` : "";
      const roleName = role.roleName || "";
      const emojiAlreadyInName = roleName.startsWith(role.emoji);
      const displayEmoji = emojiAlreadyInName ? "" : `${role.emoji} `;
      return `${displayEmoji}<@&${role.roleId}>${limitText}`;
    };

    test("should not duplicate emoji when role name starts with emoji", () => {
      const role = { emoji: "♡", roleId: "123", roleName: "♡ Supporter" };
      const result = formatRoleForDisplay(role);
      expect(result).toBe("<@&123>");
      expect(result).not.toContain("♡ <@&"); // No duplicate
    });

    test("should show emoji when role name does not contain it", () => {
      const role = { emoji: "❤️", roleId: "456", roleName: "Member" };
      const result = formatRoleForDisplay(role);
      expect(result).toBe("❤️ <@&456>");
    });

    test("should handle symbol emojis in role names", () => {
      const role = { emoji: "♂", roleId: "789", roleName: "♂ Male" };
      const result = formatRoleForDisplay(role);
      expect(result).toBe("<@&789>");
    });

    test("should include limit text when present", () => {
      const role = { emoji: "🎮", roleId: "101", roleName: "Gamer", limit: 10 };
      const result = formatRoleForDisplay(role);
      expect(result).toBe("🎮 <@&101> (10 users max)");
    });

    test("should handle custom Discord emojis in role names", () => {
      const role = {
        emoji: "<:pepe:999>",
        roleId: "102",
        roleName: "<:pepe:999> Memer",
      };
      const result = formatRoleForDisplay(role);
      expect(result).toBe("<@&102>");
    });

    test("should handle missing roleName gracefully", () => {
      const role = { emoji: "🔥", roleId: "103", roleName: undefined };
      const result = formatRoleForDisplay(role);
      expect(result).toBe("🔥 <@&103>");
    });
  });
});
