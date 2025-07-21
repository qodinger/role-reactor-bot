import { describe, test, expect } from "@jest/globals";
import { parseRoleString } from "../../src/utils/roleManager.js";

describe("parseRoleString", () => {
  const cases = [
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
});
