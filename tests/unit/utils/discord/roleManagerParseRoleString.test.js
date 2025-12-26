import { describe, test, expect } from "@jest/globals";
import { parseRoleString } from "../../../../src/utils/discord/roleParser.js";

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
  ];

  cases.forEach(({ input, expected }) => {
    test(`parses: ${JSON.stringify(input)}`, () => {
      const { roles, errors } = parseRoleString(input);
      expect(errors).toEqual([]);
      expect(roles).toEqual(expected);
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
      expect(roles).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
    });

    test("handles missing emoji", () => {
      const { roles, errors } = parseRoleString("Coder");
      expect(roles).toEqual([]);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
