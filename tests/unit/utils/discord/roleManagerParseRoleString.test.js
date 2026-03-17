import { describe, test, expect } from "vitest";
import {
  parseRoleString,
  isValidReactionEmoji,
} from "../../../../src/utils/discord/roleParser.js";

describe("parseRoleString", () => {
  const cases = [
    // Basic cases
    {
      input: "💻 Coder",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: null }],
    },
    {
      input: "🎮:Gamer",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: null }],
    },
    {
      input: "💻 Coder 10",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: 10 }],
    },
    {
      input: "🎮:Gamer:20",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 }],
    },
    {
      input: "💻 Coder:10",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: 10 }],
    },
    {
      input: "🎮:Gamer 20",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 }],
    },

    // New cases with spaces around colons
    {
      input: "💻 : Coder",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: null }],
    },
    {
      input: "🎮 : Gamer : 20",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 }],
    },
    {
      input: "💻 : Coder : 10",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: 10 }],
    },
    {
      input: "🎮: Gamer : 20",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 }],
    },
    {
      input: "💻 : Coder: 10",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: 10 }],
    },

    // Role mentions with spaces
    {
      input: "💻 : @Coder",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: null }],
    },
    {
      input: "🎮 : @Gamer : 20",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 }],
    },
    {
      input: "💻:@Coder : 10",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: 10 }],
    },
    {
      input: "🎮 : @Gamer: 15",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: 15 }],
    },

    // Role mentions with IDs
    {
      input: "💻 : <@&123456789012345678>",
      expected: [
        {
          emoji: "💻",
          roleName: "<@&123456789012345678>",
          roleId: "123456789012345678",
          limit: null,
        },
      ],
    },
    {
      input: "🎮 : <@&987654321098765432> : 20",
      expected: [
        {
          emoji: "🎮",
          roleName: "<@&987654321098765432>",
          roleId: "987654321098765432",
          limit: 20,
        },
      ],
    },
    {
      input: "💻:<@&123456789012345678> : 10",
      expected: [
        {
          emoji: "💻",
          roleName: "<@&123456789012345678>",
          roleId: "123456789012345678",
          limit: 10,
        },
      ],
    },
    {
      input: "🎮 : <@&987654321098765432>: 15",
      expected: [
        {
          emoji: "🎮",
          roleName: "<@&987654321098765432>",
          roleId: "987654321098765432",
          limit: 15,
        },
      ],
    },

    // Quoted role names with spaces
    {
      input: '💻 : "Super Coder"',
      expected: [
        { emoji: "💻", roleName: "Super Coder", roleId: null, limit: null },
      ],
    },
    {
      input: '🎮 : "Gamer:Elite" : 20',
      expected: [
        { emoji: "🎮", roleName: "Gamer:Elite", roleId: null, limit: 20 },
      ],
    },
    {
      input: '💻:"Super Coder" : 10',
      expected: [
        { emoji: "💻", roleName: "Super Coder", roleId: null, limit: 10 },
      ],
    },
    {
      input: '🎮 : "Gamer:Elite": 15',
      expected: [
        { emoji: "🎮", roleName: "Gamer:Elite", roleId: null, limit: 15 },
      ],
    },

    // Multiple roles with spaces
    {
      input: "💻 : Coder : 10, 🎮 : Gamer : 20",
      expected: [
        { emoji: "💻", roleName: "Coder", roleId: null, limit: 10 },
        { emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 },
      ],
    },
    {
      input: "💻:@Coder : 10; 🎮:@Gamer : 20",
      expected: [
        { emoji: "💻", roleName: "Coder", roleId: null, limit: 10 },
        { emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 },
      ],
    },
    {
      input:
        "💻 : <@&123456789012345678> : 10\n🎮 : <@&987654321098765432> : 20",
      expected: [
        {
          emoji: "💻",
          roleName: "<@&123456789012345678>",
          roleId: "123456789012345678",
          limit: 10,
        },
        {
          emoji: "🎮",
          roleName: "<@&987654321098765432>",
          roleId: "987654321098765432",
          limit: 20,
        },
      ],
    },

    // Edge cases
    {
      input: "💻 : Developer : 1000",
      expected: [
        { emoji: "💻", roleName: "Developer", roleId: null, limit: 1000 },
      ],
    },
    {
      input: "🎮 : Gamer : 1",
      expected: [{ emoji: "🎮", roleName: "Gamer", roleId: null, limit: 1 }],
    },
    {
      input: "💻 : Coder : 999",
      expected: [{ emoji: "💻", roleName: "Coder", roleId: null, limit: 999 }],
    },

    // Original cases (for backward compatibility)
    {
      input: '💻 "Super Coder"',
      expected: [
        { emoji: "💻", roleName: "Super Coder", roleId: null, limit: null },
      ],
    },
    {
      input: '🎮:"Gamer:Elite"',
      expected: [
        { emoji: "🎮", roleName: "Gamer:Elite", roleId: null, limit: null },
      ],
    },
    {
      input: '💻 "Super Coder" 10',
      expected: [
        { emoji: "💻", roleName: "Super Coder", roleId: null, limit: 10 },
      ],
    },
    {
      input: '🎮:"Gamer:Elite":20',
      expected: [
        { emoji: "🎮", roleName: "Gamer:Elite", roleId: null, limit: 20 },
      ],
    },
    {
      input: '💻 "Super Coder":10',
      expected: [
        { emoji: "💻", roleName: "Super Coder", roleId: null, limit: 10 },
      ],
    },
    {
      input: '🎮:"Gamer:Elite" 20',
      expected: [
        { emoji: "🎮", roleName: "Gamer:Elite", roleId: null, limit: 20 },
      ],
    },
    {
      input: "💻 <@&123456789012345678>",
      expected: [
        {
          emoji: "💻",
          roleName: "<@&123456789012345678>",
          roleId: "123456789012345678",
          limit: null,
        },
      ],
    },
    {
      input: "🎮 <@&987654321098765432>:20",
      expected: [
        {
          emoji: "🎮",
          roleName: "<@&987654321098765432>",
          roleId: "987654321098765432",
          limit: 20,
        },
      ],
    },
    {
      input: "💻:<@&123456789012345678>:10",
      expected: [
        {
          emoji: "💻",
          roleName: "<@&123456789012345678>",
          roleId: "123456789012345678",
          limit: 10,
        },
      ],
    },
    {
      input: "🎮 <@&987654321098765432> 20",
      expected: [
        {
          emoji: "🎮",
          roleName: "<@&987654321098765432>",
          roleId: "987654321098765432",
          limit: 20,
        },
      ],
    },
    // Separators
    {
      input: "💻:Coder:10, 🎮:Gamer:20",
      expected: [
        { emoji: "💻", roleName: "Coder", roleId: null, limit: 10 },
        { emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 },
      ],
    },
    {
      input: "💻:Coder:10; 🎮:Gamer:20",
      expected: [
        { emoji: "💻", roleName: "Coder", roleId: null, limit: 10 },
        { emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 },
      ],
    },
    {
      input: "💻:Coder:10\n🎮:Gamer:20",
      expected: [
        { emoji: "💻", roleName: "Coder", roleId: null, limit: 10 },
        { emoji: "🎮", roleName: "Gamer", roleId: null, limit: 20 },
      ],
    },
    // Symbol Emojis
    {
      input: "♂ Male",
      expected: [{ emoji: "♂", roleName: "Male", roleId: null, limit: null }],
    },
    {
      input: "♀ Female",
      expected: [
        { emoji: "♀", roleName: "Female", roleId: null, limit: null },
      ],
    },
    {
      input: "⚡ Booster",
      expected: [
        { emoji: "⚡", roleName: "Booster", roleId: null, limit: null },
      ],
    },
    {
      // Symbol as emoji, no space
      input: "⚡Booster",
      expected: [
        { emoji: "⚡", roleName: "Booster", roleId: null, limit: null },
      ],
    },
    {
      // Emoji inferred from name later (no emoji at start)
      input: "RoleWithSymbol",
      expected: [
        { emoji: null, roleName: "RoleWithSymbol", roleId: null, limit: null },
      ],
    },
  ];

  cases.forEach(({ input, expected }) => {
    test(`parses: ${JSON.stringify(input)}`, () => {
      const { roles, errors } = parseRoleString(input);
      expect(errors).toEqual([]);
      // Update expected format to include roleIds and roleNames for multi-role support
      const updatedExpected = expected.map(role => ({
        ...role,
        roleIds: role.roleIds || null,
        roleNames: role.roleNames || null
      }));
      expect(roles).toEqual(updatedExpected);
    });
  });

  test("returns errors for invalid input", () => {
    const { roles, errors } = parseRoleString("💻");
    expect(roles).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  // Test error cases
  describe("error handling", () => {
    test("handles empty role name", () => {
      const { roles, errors } = parseRoleString("💻:");
      expect(roles).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("handles invalid limit", () => {
      const { roles, errors } = parseRoleString("💻:Coder:0");
      expect(roles).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("handles limit too high", () => {
      const { roles, errors } = parseRoleString("💻:Coder:1001");
      expect(roles).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("handles duplicate emojis", () => {
      const { roles, errors } = parseRoleString("💻:Coder,💻:Developer");
      // Now duplicate emojis are merged into a single role with multiple roleIds/roleNames
      expect(roles.length).toBe(1);
      expect(roles[0].emoji).toBe("💻");
      expect(roles[0].roleNames).toEqual(["Coder", "Developer"]);
      // No errors - duplicate emojis are now supported for multi-role feature
      expect(errors.length).toBe(0);
    });

    test("handles missing emoji (returns null emoji for later matching)", () => {
      const { roles, errors } = parseRoleString("Coder");
      expect(errors).toEqual([]);
      expect(roles).toEqual([
        { emoji: null, roleName: "Coder", roleId: null, limit: null, roleIds: null, roleNames: null },
      ]);
    });
  });
});

describe("isValidReactionEmoji", () => {
  describe("valid emojis", () => {
    test("accepts standard Unicode emojis", () => {
      expect(isValidReactionEmoji("🎮").valid).toBe(true);
      expect(isValidReactionEmoji("❤️").valid).toBe(true);
      expect(isValidReactionEmoji("⭐").valid).toBe(true);
      expect(isValidReactionEmoji("🩷").valid).toBe(true);
    });

    test("accepts custom Discord emojis", () => {
      expect(isValidReactionEmoji("<:pepe:123456>").valid).toBe(true);
      expect(isValidReactionEmoji("<:custom:987654321>").valid).toBe(true);
    });

    test("accepts animated custom Discord emojis", () => {
      expect(isValidReactionEmoji("<a:dance:123456>").valid).toBe(true);
      expect(isValidReactionEmoji("<a:animated:987654321>").valid).toBe(true);
    });
  });

  describe("invalid symbols", () => {
    test("rejects white heart symbol (♡)", () => {
      const result = isValidReactionEmoji("♡");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("symbol");
    });

    test("rejects black star symbol (★)", () => {
      const result = isValidReactionEmoji("★");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("symbol");
    });

    test("rejects empty emoji", () => {
      const result = isValidReactionEmoji("");
      expect(result.valid).toBe(false);
    });

    test("rejects null/undefined emoji", () => {
      expect(isValidReactionEmoji(null).valid).toBe(false);
      expect(isValidReactionEmoji(undefined).valid).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("accepts emojis with variant selectors", () => {
      // These should be valid as emoji-regex recognizes them
      expect(isValidReactionEmoji("♂️").valid).toBe(true);
      expect(isValidReactionEmoji("♀️").valid).toBe(true);
    });
  });
});
