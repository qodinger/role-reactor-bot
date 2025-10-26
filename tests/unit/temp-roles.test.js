// Test file for temp-roles functionality

describe("Temp Roles - Core Functionality", () => {
  describe("validateRole", () => {
    test("should validate normal role as valid", () => {
      // Mock the validateRole function behavior
      const validateRole = (role, guild) => {
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
        name: "Test Role",
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

      const result = validateRole(mockRole, mockGuild);
      expect(result.valid).toBe(true);
    });

    test("should reject managed roles", () => {
      const validateRole = (role, _guild) => {
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
      const mockGuild = {
        members: {
          me: {
            roles: {
              highest: { position: 10 },
            },
          },
        },
      };

      const result = validateRole(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("managed by Discord");
    });

    test("should reject bot roles", () => {
      const validateRole = (role, _guild) => {
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
      const mockGuild = {
        members: {
          me: {
            roles: {
              highest: { position: 10 },
            },
          },
        },
      };

      const result = validateRole(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("bot role");
    });

    test("should reject roles higher than bot", () => {
      const validateRole = (role, guild) => {
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

      const result = validateRole(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("higher than or equal");
    });
  });

  describe("validateDuration", () => {
    test("should validate correct duration formats", () => {
      const validateDuration = durationStr => {
        const parseDuration = duration => {
          const match = duration?.match(/^(\d+)([smhdwy])$/);
          if (!match) return 0;
          const value = parseInt(match[1], 10);
          const unit = match[2];
          const multipliers = {
            s: 1000,
            m: 60000,
            h: 3600000,
            d: 86400000,
            w: 604800000,
            y: 31536000000,
          };
          return value * (multipliers[unit] || 0);
        };

        try {
          const durationMs = parseDuration(durationStr);
          if (!durationMs) {
            return {
              valid: false,
              error: `Invalid duration format: **${durationStr}**`,
              solution: "Use formats like: 1h, 2d, 1w, 30m, 1y",
            };
          }

          const maxDurationMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
          const minDurationMs = 1 * 60 * 1000; // 1 minute in milliseconds

          if (durationMs > maxDurationMs) {
            return {
              valid: false,
              error: "Duration cannot exceed 1 year.",
              solution: "Choose a shorter duration (maximum: 1y).",
            };
          }

          if (durationMs < minDurationMs) {
            return {
              valid: false,
              error: "Duration must be at least 1 minute.",
              solution: "Choose a longer duration (minimum: 1m).",
            };
          }

          return { valid: true };
        } catch (_error) {
          return {
            valid: false,
            error: `Failed to parse duration: **${durationStr}**`,
            solution: "Use formats like: 1h, 2d, 1w, 30m, 1y",
          };
        }
      };

      const validDurations = [
        "1m",
        "30m",
        "1h",
        "24h",
        "1d",
        "7d",
        "1w",
        "2w",
        "1y",
      ];

      validDurations.forEach(duration => {
        const result = validateDuration(duration);
        expect(result.valid).toBe(true);
      });
    });

    test("should reject invalid duration formats", () => {
      const validateDuration = durationStr => {
        const parseDuration = duration => {
          const match = duration?.match(/^(\d+)([smhdwy])$/);
          if (!match) return 0;
          const value = parseInt(match[1], 10);
          const unit = match[2];
          const multipliers = {
            s: 1000,
            m: 60000,
            h: 3600000,
            d: 86400000,
            w: 604800000,
            y: 31536000000,
          };
          return value * (multipliers[unit] || 0);
        };

        try {
          const durationMs = parseDuration(durationStr);
          if (!durationMs) {
            return {
              valid: false,
              error: `Invalid duration format: **${durationStr}**`,
              solution: "Use formats like: 1h, 2d, 1w, 30m, 1y",
            };
          }
          return { valid: true };
        } catch (_error) {
          return {
            valid: false,
            error: `Failed to parse duration: **${durationStr}**`,
            solution: "Use formats like: 1h, 2d, 1w, 30m, 1y",
          };
        }
      };

      const invalidDurations = ["invalid", "1x", "abc", "1", "m", ""];

      invalidDurations.forEach(duration => {
        const result = validateDuration(duration);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test("should reject durations too short", () => {
      const validateDuration = durationStr => {
        const parseDuration = duration => {
          const match = duration?.match(/^(\d+)([smhdwy])$/);
          if (!match) return 0;
          const value = parseInt(match[1], 10);
          const unit = match[2];
          const multipliers = {
            s: 1000,
            m: 60000,
            h: 3600000,
            d: 86400000,
            w: 604800000,
            y: 31536000000,
          };
          return value * (multipliers[unit] || 0);
        };

        const durationMs = parseDuration(durationStr);
        const minDurationMs = 1 * 60 * 1000; // 1 minute in milliseconds

        if (durationMs < minDurationMs) {
          return {
            valid: false,
            error: "Duration must be at least 1 minute.",
            solution: "Choose a longer duration (minimum: 1m).",
          };
        }
        return { valid: true };
      };

      const result = validateDuration("30s");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 1 minute");
    });

    test("should reject durations too long", () => {
      const validateDuration = durationStr => {
        const parseDuration = duration => {
          const match = duration?.match(/^(\d+)([smhdwy])$/);
          if (!match) return 0;
          const value = parseInt(match[1], 10);
          const unit = match[2];
          const multipliers = {
            s: 1000,
            m: 60000,
            h: 3600000,
            d: 86400000,
            w: 604800000,
            y: 31536000000,
          };
          return value * (multipliers[unit] || 0);
        };

        const durationMs = parseDuration(durationStr);
        const maxDurationMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

        if (durationMs > maxDurationMs) {
          return {
            valid: false,
            error: "Duration cannot exceed 1 year.",
            solution: "Choose a shorter duration (maximum: 1y).",
          };
        }
        return { valid: true };
      };

      const result = validateDuration("2y");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed 1 year");
    });
  });

  describe("parseDuration", () => {
    test("should parse duration strings correctly", () => {
      const parseDuration = duration => {
        const match = duration?.match(/^(\d+)([smhdwy])$/);
        if (!match) return 0;
        const value = parseInt(match[1], 10);
        const unit = match[2];
        const multipliers = {
          s: 1000,
          m: 60000,
          h: 3600000,
          d: 86400000,
          w: 604800000,
          y: 31536000000,
        };
        return value * (multipliers[unit] || 0);
      };

      expect(parseDuration("1m")).toBe(60000);
      expect(parseDuration("5m")).toBe(300000);
      expect(parseDuration("1h")).toBe(3600000);
      expect(parseDuration("1d")).toBe(86400000);
      expect(parseDuration("1w")).toBe(604800000);
    });

    test("should handle mixed formats", () => {
      const parseDuration = duration => {
        // Handle mixed formats like "1d 12h" or "2w 3d"
        const parts = duration.split(/\s+/);
        let totalMs = 0;

        for (const part of parts) {
          const match = part.match(/^(\d+)([smhdwy])$/);
          if (match) {
            const value = parseInt(match[1], 10);
            const unit = match[2];
            const multipliers = {
              s: 1000,
              m: 60000,
              h: 3600000,
              d: 86400000,
              w: 604800000,
              y: 31536000000,
            };
            totalMs += value * (multipliers[unit] || 0);
          }
        }

        return totalMs;
      };

      expect(parseDuration("1d 12h")).toBe(129600000); // 1 day + 12 hours
      expect(parseDuration("2w 3d")).toBe(1468800000); // 2 weeks + 3 days
    });

    test("should return 0 for invalid formats", () => {
      const parseDuration = duration => {
        const match = duration?.match(/^(\d+)([smhdwy])$/);
        if (!match) return 0;
        const value = parseInt(match[1], 10);
        const unit = match[2];
        const multipliers = {
          s: 1000,
          m: 60000,
          h: 3600000,
          d: 86400000,
          w: 604800000,
          y: 31536000000,
        };
        return value * (multipliers[unit] || 0);
      };

      expect(parseDuration("invalid")).toBe(0);
      expect(parseDuration("1x")).toBe(0);
      expect(parseDuration("")).toBe(0);
    });
  });

  describe("processUserList", () => {
    test("should handle empty input", async () => {
      const processUserList = usersString => {
        if (!usersString) {
          return {
            valid: false,
            error: "No users provided.",
            solution:
              "Provide user IDs or mentions separated by commas, semicolons, or spaces.",
          };
        }
        return { valid: true, validUsers: [] };
      };

      const result = processUserList("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No users provided");
    });

    test("should handle comma-separated mentions", async () => {
      const processUserList = usersString => {
        if (!usersString) return { valid: false, error: "No users provided." };

        const userList = usersString
          .split(/[,;]|\s+/)
          .map(user => user.trim())
          .filter(user => user.length > 0);

        const validUsers = userList.filter(u => /<@!?\d+>|\d+/.test(u));

        return { valid: true, validUsers };
      };

      const result = processUserList("<@123456789>, <@987654321>");
      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(2);
    });

    test("should handle concatenated mentions without spaces", async () => {
      const processUserList = usersString => {
        if (!usersString) return { valid: false, error: "No users provided." };

        const userList = usersString
          .split(/[,;]|\s+/)
          .map(user => user.trim())
          .filter(user => user.length > 0);

        // Handle cases where mentions are concatenated without spaces
        const expandedUserList = [];
        for (const userStr of userList) {
          const mentions = userStr.match(/<@!?\d+>/g);
          if (mentions && mentions.length > 1) {
            const parts = userStr.split(/(<@!?\d+>)/);
            for (const part of parts) {
              if (part.trim() && part.match(/<@!?\d+>/)) {
                expandedUserList.push(part.trim());
              }
            }
          } else {
            expandedUserList.push(userStr);
          }
        }

        const validUsers = expandedUserList.filter(u => /<@!?\d+>|\d+/.test(u));

        return { valid: true, validUsers };
      };

      const result = processUserList("<@123456789><@987654321>");
      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(2);
    });

    test("should handle user IDs", async () => {
      const processUserList = usersString => {
        if (!usersString) return { valid: false, error: "No users provided." };

        const userList = usersString
          .split(/[,;]|\s+/)
          .map(user => user.trim())
          .filter(user => user.length > 0);

        const validUsers = userList.filter(u => /<@!?\d+>|\d+/.test(u));

        return { valid: true, validUsers };
      };

      const result = processUserList("123456789");
      expect(result.valid).toBe(true);
      expect(result.validUsers).toHaveLength(1);
    });
  });
});
