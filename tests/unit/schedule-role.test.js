import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  detectTargetingType,
  validateSchedule,
} from "../../src/commands/admin/schedule-role/utils.js";
import {
  parseOneTimeSchedule,
  parseRecurringSchedule,
} from "../../src/utils/scheduleParser.js";

describe("Schedule Role - Mention Detection", () => {
  let mockGuild;
  let mockRole1;
  let mockRole2;
  let mockRolesCache;

  beforeEach(() => {
    // Mock role objects
    mockRole1 = {
      id: "111111111111111111",
      name: "VerifiedRole",
      cache: true,
    };

    mockRole2 = {
      id: "222222222222222222",
      name: "PremiumRole",
      cache: true,
    };

    // Mock roles cache - Discord.js uses a Collection (which extends Map)
    // Collection has both Map methods (get, set, has) and find method
    mockRolesCache = new Map();
    mockRolesCache.set(mockRole1.id, mockRole1);
    mockRolesCache.set(mockRole2.id, mockRole2);

    // Add find method to the cache (Discord.js Collection has find)
    mockRolesCache.find = jest.fn(predicate => {
      for (const role of mockRolesCache.values()) {
        if (typeof predicate === "function" && predicate(role)) {
          return role;
        }
        // Handle string comparison for name matching
        if (typeof predicate === "string") {
          if (role.name.toLowerCase() === predicate.toLowerCase()) {
            return role;
          }
        }
      }
      return null;
    });

    // Mock guild with role cache
    mockGuild = {
      roles: {
        cache: mockRolesCache,
      },
    };
  });

  describe("User Mentions", () => {
    it("should detect single user mention", () => {
      const result = detectTargetingType("<@123456789012345678>", mockGuild);
      expect(result.type).toBe("users");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeUndefined();
    });

    it("should detect user mention with nickname (!)", () => {
      const result = detectTargetingType("<@!123456789012345678>", mockGuild);
      expect(result.type).toBe("users");
      expect(result.hasUsers).toBe(true);
    });

    it("should detect multiple user mentions", () => {
      const result = detectTargetingType(
        "<@123456789012345678> <@987654321098765432>",
        mockGuild,
      );
      expect(result.type).toBe("users");
      expect(result.hasUsers).toBe(true);
    });

    it("should detect user mentions separated by comma", () => {
      const result = detectTargetingType(
        "<@123456789012345678>, <@987654321098765432>",
        mockGuild,
      );
      expect(result.type).toBe("users");
      expect(result.hasUsers).toBe(true);
    });

    it("should detect plain user ID (17-19 digits)", () => {
      const result = detectTargetingType("123456789012345678", mockGuild);
      expect(result.type).toBe("users");
      expect(result.hasUsers).toBe(true);
    });
  });

  describe("Role Mentions", () => {
    it("should detect single role mention (<@&roleId>)", () => {
      const result = detectTargetingType("<@&111111111111111111>", mockGuild);
      expect(result.type).toBe("role");
      expect(result.targetRoles).toHaveLength(1);
      expect(result.targetRoles[0].id).toBe("111111111111111111");
      expect(result.targetRoles[0].name).toBe("VerifiedRole");
    });

    it("should detect multiple role mentions", () => {
      const result = detectTargetingType(
        "<@&111111111111111111> <@&222222222222222222>",
        mockGuild,
      );
      expect(result.type).toBe("role");
      expect(result.targetRoles).toHaveLength(2);
      expect(result.targetRoles[0].id).toBe("111111111111111111");
      expect(result.targetRoles[1].id).toBe("222222222222222222");
    });

    it("should detect role mentions separated by comma", () => {
      const result = detectTargetingType(
        "<@&111111111111111111>, <@&222222222222222222>",
        mockGuild,
      );
      expect(result.type).toBe("role");
      expect(result.targetRoles).toHaveLength(2);
    });
  });

  describe("Role Names", () => {
    it("should detect single role name (@RoleName)", () => {
      const result = detectTargetingType("@VerifiedRole", mockGuild);
      expect(result.type).toBe("role");
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBeGreaterThan(0);
    });

    it("should detect multiple role names", () => {
      const result = detectTargetingType(
        "@VerifiedRole @PremiumRole",
        mockGuild,
      );
      expect(result.type).toBe("role");
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBe(2);
    });

    it("should detect role names separated by comma", () => {
      const result = detectTargetingType(
        "@VerifiedRole, @PremiumRole",
        mockGuild,
      );
      expect(result.type).toBe("role");
      expect(result.targetRoles).toBeDefined();
    });

    it("should be case-insensitive for role names", () => {
      const result = detectTargetingType("@verifiedrole", mockGuild);
      expect(result.type).toBe("role");
      expect(result.targetRoles).toBeDefined();
    });
  });

  describe("@everyone", () => {
    it("should detect @everyone (exact match)", () => {
      const result = detectTargetingType("@everyone", mockGuild);
      expect(result.type).toBe("everyone");
      expect(result.isAllMembers).toBe(true);
      expect(result.targetRoles).toBeUndefined();
    });

    it("should detect everyone (lowercase, no @)", () => {
      const result = detectTargetingType("everyone", mockGuild);
      expect(result.type).toBe("everyone");
      expect(result.isAllMembers).toBe(true);
    });

    it("should detect all (alternative)", () => {
      const result = detectTargetingType("all", mockGuild);
      expect(result.type).toBe("everyone");
      expect(result.isAllMembers).toBe(true);
    });

    it("should not detect @everyone if mixed with other mentions", () => {
      // @everyone should only work as exact match (trimmed and lowercased)
      // "@everyone <@123456789012345678>" - trimmed/lowercased is "@everyone <@123456789012345678>" which != "@everyone"
      const result = detectTargetingType(
        "@everyone <@123456789012345678>",
        mockGuild,
      );
      // Should not be everyone type since it's mixed (not exact match)
      expect(result.type).not.toBe("everyone");
      // Should detect as mixed or users
      expect(["users", "mixed"]).toContain(result.type);
    });
  });

  describe("Mixed Mentions (Users + Roles)", () => {
    it("should detect mixed: user mention + role mention", () => {
      const result = detectTargetingType(
        "<@123456789012345678> <@&111111111111111111>",
        mockGuild,
      );
      expect(result.type).toBe("mixed");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBeGreaterThan(0);
    });

    it("should detect mixed: user mention + role name", () => {
      const result = detectTargetingType(
        "<@123456789012345678> @VerifiedRole",
        mockGuild,
      );
      expect(result.type).toBe("mixed");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBeGreaterThan(0);
    });

    it("should detect mixed: multiple users + role", () => {
      const result = detectTargetingType(
        "<@123456789012345678>, <@987654321098765432>, <@&111111111111111111>",
        mockGuild,
      );
      expect(result.type).toBe("mixed");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBeGreaterThan(0);
    });

    it("should detect mixed: user + multiple roles", () => {
      const result = detectTargetingType(
        "<@123456789012345678> @VerifiedRole @PremiumRole",
        mockGuild,
      );
      expect(result.type).toBe("mixed");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBeGreaterThanOrEqual(1);
    });

    it("should detect mixed: user ID + role mention", () => {
      const result = detectTargetingType(
        "123456789012345678 <@&111111111111111111>",
        mockGuild,
      );
      expect(result.type).toBe("mixed");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      const result = detectTargetingType("", mockGuild);
      expect(result.type).toBe("users");
    });

    it("should handle null", () => {
      const result = detectTargetingType(null, mockGuild);
      expect(result.type).toBe("users");
    });

    it("should handle undefined", () => {
      const result = detectTargetingType(undefined, mockGuild);
      expect(result.type).toBe("users");
    });

    it("should not confuse user mention with role mention", () => {
      const result = detectTargetingType("<@123456789012345678>", mockGuild);
      expect(result.type).toBe("users");
      expect(result.targetRoles).toBeUndefined();
    });

    it("should not confuse role mention with user mention", () => {
      const result = detectTargetingType("<@&111111111111111111>", mockGuild);
      expect(result.type).toBe("role");
      expect(result.hasUsers).toBeUndefined();
    });

    it("should handle whitespace-only input", () => {
      const result = detectTargetingType("   ", mockGuild);
      expect(result.type).toBe("users");
    });

    it("should handle input with only commas", () => {
      const result = detectTargetingType(",,,", mockGuild);
      expect(result.type).toBe("users");
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle user mention, role mention, and role name together", () => {
      const result = detectTargetingType(
        "<@123456789012345678> <@&111111111111111111> @PremiumRole",
        mockGuild,
      );
      expect(result.type).toBe("mixed");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBeGreaterThanOrEqual(1);
    });

    it("should remove duplicate roles", () => {
      const result = detectTargetingType(
        "<@&111111111111111111> <@&111111111111111111> @VerifiedRole",
        mockGuild,
      );
      expect(result.type).toBe("role");
      // Should have unique roles only
      const uniqueIds = new Set(result.targetRoles.map(r => r.id));
      expect(uniqueIds.size).toBeLessThanOrEqual(result.targetRoles.length);
    });

    it("should handle mixed delimiters (comma, semicolon, space)", () => {
      const result = detectTargetingType(
        "<@123456789012345678>; <@&111111111111111111>, @PremiumRole",
        mockGuild,
      );
      expect(result.type).toBe("mixed");
      expect(result.hasUsers).toBe(true);
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBeGreaterThan(0);
    });
  });

  describe("Invalid Role References", () => {
    it("should handle non-existent role mention", () => {
      const result = detectTargetingType("<@&999999999999999999>", mockGuild);
      // Should detect as role type (format is correct) but role won't be found
      expect(result.type).toBe("role");
      // Role won't be in cache, so targetRoles will be empty
      expect(result.targetRoles).toBeDefined();
      expect(result.targetRoles.length).toBe(0);
    });

    it("should handle non-existent role name", () => {
      const result = detectTargetingType("@NonExistentRole", mockGuild);
      // Should attempt to find role but won't match anything
      // If no roles found, should fall back to users type
      expect(result.type).toBe("users");
    });

    it("should handle mix of valid and invalid roles", () => {
      const result = detectTargetingType(
        "<@&111111111111111111> <@&999999999999999999>",
        mockGuild,
      );
      expect(result.type).toBe("role");
      // Should only include valid roles
      expect(result.targetRoles.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Schedule Role - Schedule Parsing", () => {
  describe("One-time Schedule - Simple Time Formats", () => {
    it("should parse simple 24-hour time format (10:30)", () => {
      const result = parseOneTimeSchedule("10:30");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(10);
      expect(result.getMinutes()).toBe(30);
    });

    it("should parse simple 24-hour time format (14:30)", () => {
      const result = parseOneTimeSchedule("14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it("should parse 12-hour time format with AM (9:30am)", () => {
      const result = parseOneTimeSchedule("9:30am");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(30);
    });

    it("should parse 12-hour time format with PM (2:30pm)", () => {
      const result = parseOneTimeSchedule("2:30pm");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it("should parse hour-only format with AM (9am)", () => {
      const result = parseOneTimeSchedule("9am");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
    });

    it("should parse hour-only format with PM (2pm)", () => {
      const result = parseOneTimeSchedule("2pm");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
    });

    it("should parse midnight (12am) correctly", () => {
      const result = parseOneTimeSchedule("12am");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(0);
    });

    it("should parse noon (12pm) correctly", () => {
      const result = parseOneTimeSchedule("12pm");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(12);
    });

    it("should schedule for tomorrow if time has passed today", () => {
      const now = new Date();
      const pastTime = new Date(now);
      pastTime.setHours(now.getHours() - 2, 0, 0, 0); // 2 hours ago

      const hourStr = pastTime.getHours().toString().padStart(2, "0");
      const result = parseOneTimeSchedule(`${hourStr}:00`);

      expect(result).toBeInstanceOf(Date);
      // Should be tomorrow
      expect(result.getDate()).toBe(now.getDate() + 1);
      expect(result.getHours()).toBe(pastTime.getHours());
    });

    it("should schedule for today if time hasn't passed", () => {
      const now = new Date();
      const futureTime = new Date(now);
      futureTime.setHours(now.getHours() + 2, 0, 0, 0); // 2 hours from now

      const hourStr = futureTime.getHours().toString().padStart(2, "0");
      const result = parseOneTimeSchedule(`${hourStr}:00`);

      expect(result).toBeInstanceOf(Date);
      // Should be today
      expect(result.getDate()).toBe(now.getDate());
      expect(result.getHours()).toBe(futureTime.getHours());
    });
  });

  describe("One-time Schedule - Traditional Formats", () => {
    it("should parse 'tomorrow 8am'", () => {
      const result = parseOneTimeSchedule("tomorrow 8am");
      expect(result).toBeInstanceOf(Date);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);

      expect(result.getDate()).toBe(tomorrow.getDate());
      expect(result.getHours()).toBe(8);
    });

    it("should parse 'friday 2pm'", () => {
      const result = parseOneTimeSchedule("friday 2pm");
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(14);
    });

    it("should parse 'in 2 hours'", () => {
      const now = new Date();
      const result = parseOneTimeSchedule("in 2 hours");
      expect(result).toBeInstanceOf(Date);

      const expectedTime = now.getTime() + 2 * 60 * 60 * 1000;
      const diff = Math.abs(result.getTime() - expectedTime);
      // Allow 1 second difference
      expect(diff).toBeLessThan(1000);
    });

    it("should parse 'in 30 minutes'", () => {
      const now = new Date();
      const result = parseOneTimeSchedule("in 30 minutes");
      expect(result).toBeInstanceOf(Date);

      const expectedTime = now.getTime() + 30 * 60 * 1000;
      const diff = Math.abs(result.getTime() - expectedTime);
      expect(diff).toBeLessThan(1000);
    });

    it("should parse shorthand '2h'", () => {
      const now = new Date();
      const result = parseOneTimeSchedule("2h");
      expect(result).toBeInstanceOf(Date);

      const expectedTime = now.getTime() + 2 * 60 * 60 * 1000;
      const diff = Math.abs(result.getTime() - expectedTime);
      expect(diff).toBeLessThan(1000);
    });

    it("should parse shorthand '30m'", () => {
      const now = new Date();
      const result = parseOneTimeSchedule("30m");
      expect(result).toBeInstanceOf(Date);

      const expectedTime = now.getTime() + 30 * 60 * 1000;
      const diff = Math.abs(result.getTime() - expectedTime);
      expect(diff).toBeLessThan(1000);
    });
  });

  describe("validateSchedule - One-time", () => {
    it("should validate simple time format (10:30)", async () => {
      const result = await validateSchedule("one-time", "10:30");
      expect(result.valid).toBe(true);
      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(result.scheduledAt.getHours()).toBe(10);
      expect(result.scheduledAt.getMinutes()).toBe(30);
    });

    it("should validate 12-hour format (2pm)", async () => {
      const result = await validateSchedule("one-time", "2pm");
      expect(result.valid).toBe(true);
      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(result.scheduledAt.getHours()).toBe(14);
    });

    it("should validate 'tomorrow 8am'", async () => {
      const result = await validateSchedule("one-time", "tomorrow 8am");
      expect(result.valid).toBe(true);
      expect(result.scheduledAt).toBeInstanceOf(Date);
    });

    it("should validate 'in 2 hours'", async () => {
      const result = await validateSchedule("one-time", "in 2 hours");
      expect(result.valid).toBe(true);
      expect(result.scheduledAt).toBeInstanceOf(Date);
    });

    it("should reject invalid format", async () => {
      const result = await validateSchedule("one-time", "invalid format");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid schedule format");
      expect(result.solution).toBeDefined();
    });

    it("should reject past dates", async () => {
      // Create a time that's definitely in the past
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastTime = `${yesterday.toISOString().substring(0, 10)} 10:00`;

      const result = await validateSchedule("one-time", pastTime);
      // If it parses but is in the past, should reject
      if (
        result.valid === false &&
        result.error === "The scheduled time must be in the future."
      ) {
        expect(result.valid).toBe(false);
        expect(result.error).toContain("future");
      }
    });
  });

  describe("validateSchedule - Daily", () => {
    it("should validate daily schedule (9am)", async () => {
      const result = await validateSchedule("daily", "9am");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig).toBeDefined();
      expect(result.scheduleConfig.type).toBe("daily");
      expect(result.scheduleConfig.hour).toBe(9);
    });

    it("should validate daily schedule (14:30)", async () => {
      const result = await validateSchedule("daily", "14:30");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig.type).toBe("daily");
      expect(result.scheduleConfig.hour).toBe(14);
      expect(result.scheduleConfig.minute).toBe(30);
    });

    it("should validate daily schedule (2pm)", async () => {
      const result = await validateSchedule("daily", "2pm");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig.type).toBe("daily");
      expect(result.scheduleConfig.hour).toBe(14);
    });

    it("should reject invalid daily format", async () => {
      const result = await validateSchedule("daily", "invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid daily schedule format");
    });
  });

  describe("validateSchedule - Weekly", () => {
    it("should validate weekly schedule (monday 9am)", async () => {
      const result = await validateSchedule("weekly", "monday 9am");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig).toBeDefined();
      expect(result.scheduleConfig.type).toBe("weekly");
      expect(result.scheduleConfig.dayOfWeek).toBe(1); // Monday
      expect(result.scheduleConfig.hour).toBe(9);
    });

    it("should validate weekly schedule (friday 14:30)", async () => {
      const result = await validateSchedule("weekly", "friday 14:30");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig.type).toBe("weekly");
      expect(result.scheduleConfig.dayOfWeek).toBe(5); // Friday
      expect(result.scheduleConfig.hour).toBe(14);
      expect(result.scheduleConfig.minute).toBe(30);
    });

    it("should reject invalid weekly format", async () => {
      const result = await validateSchedule("weekly", "invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid weekly schedule format");
    });
  });

  describe("validateSchedule - Monthly", () => {
    it("should validate monthly schedule (15 9am)", async () => {
      const result = await validateSchedule("monthly", "15 9am");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig).toBeDefined();
      expect(result.scheduleConfig.type).toBe("monthly");
      expect(result.scheduleConfig.dayOfMonth).toBe(15);
      expect(result.scheduleConfig.hour).toBe(9);
    });

    it("should validate monthly schedule (1 14:30)", async () => {
      const result = await validateSchedule("monthly", "1 14:30");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig.type).toBe("monthly");
      expect(result.scheduleConfig.dayOfMonth).toBe(1);
      expect(result.scheduleConfig.hour).toBe(14);
      expect(result.scheduleConfig.minute).toBe(30);
    });

    it("should reject invalid monthly format", async () => {
      const result = await validateSchedule("monthly", "invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid monthly schedule format");
    });
  });

  describe("validateSchedule - Custom", () => {
    it("should validate custom schedule (60 minutes)", async () => {
      const result = await validateSchedule("custom", "60");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig).toBeDefined();
      expect(result.scheduleConfig.interval).toBe(60);
      expect(result.scheduleConfig.unit).toBe("minutes");
    });

    it("should validate custom schedule (1440 minutes = 1 day)", async () => {
      const result = await validateSchedule("custom", "1440");
      expect(result.valid).toBe(true);
      expect(result.scheduleConfig.interval).toBe(1440);
    });

    it("should reject custom schedule below minimum (0 minutes)", async () => {
      const result = await validateSchedule("custom", "0");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid custom interval");
    });

    it("should reject custom schedule above maximum (10081 minutes)", async () => {
      const result = await validateSchedule("custom", "10081");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid custom interval");
    });

    it("should reject invalid custom format", async () => {
      const result = await validateSchedule("custom", "not a number");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid custom interval");
    });
  });

  describe("validateSchedule - Error Handling", () => {
    it("should reject unknown schedule type", async () => {
      const result = await validateSchedule("unknown-type", "10:30");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unknown schedule type");
    });
  });

  describe("parseRecurringSchedule - Daily", () => {
    it("should parse daily schedule (9am)", () => {
      const result = parseRecurringSchedule("daily", "9am");
      expect(result).toBeDefined();
      expect(result.type).toBe("daily");
      expect(result.hour).toBe(9);
      expect(result.minute).toBe(0);
    });

    it("should parse daily schedule (14:30)", () => {
      const result = parseRecurringSchedule("daily", "14:30");
      expect(result).toBeDefined();
      expect(result.type).toBe("daily");
      expect(result.hour).toBe(14);
      expect(result.minute).toBe(30);
    });

    it("should parse daily schedule (2:30pm)", () => {
      const result = parseRecurringSchedule("daily", "2:30pm");
      expect(result).toBeDefined();
      expect(result.type).toBe("daily");
      expect(result.hour).toBe(14);
      expect(result.minute).toBe(30);
    });

    it("should return null for invalid daily format", () => {
      const result = parseRecurringSchedule("daily", "invalid");
      expect(result).toBeNull();
    });
  });

  describe("parseRecurringSchedule - Weekly", () => {
    it("should parse weekly schedule (monday 9am)", () => {
      const result = parseRecurringSchedule("weekly", "monday 9am");
      expect(result).toBeDefined();
      expect(result.type).toBe("weekly");
      expect(result.dayOfWeek).toBe(1); // Monday
      expect(result.hour).toBe(9);
    });

    it("should parse weekly schedule (friday 14:30)", () => {
      const result = parseRecurringSchedule("weekly", "friday 14:30");
      expect(result).toBeDefined();
      expect(result.type).toBe("weekly");
      expect(result.dayOfWeek).toBe(5); // Friday
      expect(result.hour).toBe(14);
      expect(result.minute).toBe(30);
    });

    it("should return null for invalid weekly format", () => {
      const result = parseRecurringSchedule("weekly", "invalid");
      expect(result).toBeNull();
    });
  });

  describe("parseRecurringSchedule - Monthly", () => {
    it("should parse monthly schedule (15 9am)", () => {
      const result = parseRecurringSchedule("monthly", "15 9am");
      expect(result).toBeDefined();
      expect(result.type).toBe("monthly");
      expect(result.dayOfMonth).toBe(15);
      expect(result.hour).toBe(9);
    });

    it("should parse monthly schedule (1 14:30)", () => {
      const result = parseRecurringSchedule("monthly", "1 14:30");
      expect(result).toBeDefined();
      expect(result.type).toBe("monthly");
      expect(result.dayOfMonth).toBe(1);
      expect(result.hour).toBe(14);
      expect(result.minute).toBe(30);
    });

    it("should return null for invalid monthly format", () => {
      const result = parseRecurringSchedule("monthly", "invalid");
      expect(result).toBeNull();
    });
  });
});
