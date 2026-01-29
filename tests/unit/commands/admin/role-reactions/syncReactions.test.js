import { describe, test, expect, beforeEach, vi } from "vitest";
import { syncReactions } from "../../../../../src/commands/admin/role-reactions/messageOperations.js";

// Mock dependencies
vi.mock("../../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("syncReactions (Prefix Matching)", () => {
  let mockMessage;
  let mockClientUser;

  beforeEach(() => {
    mockClientUser = { id: "bot-id" };
    mockMessage = {
      id: "msg-123",
      client: { user: mockClientUser },
      reactions: {
        cache: new Map(),
      },
      react: vi.fn().mockResolvedValue(true),
    };
  });

  // Helper to create mock reaction
  const createReaction = (emoji, isMe = true) => ({
    emoji: {
      toString: () => emoji,
      name: emoji,
      id: null,
    },
    me: isMe,
    users: {
      remove: vi.fn().mockResolvedValue(true),
    },
  });

  test("should append a new reaction without touching existing ones", async () => {
    // Current: [A, B]
    const reactionA = createReaction("🇦");
    const reactionB = createReaction("🇧");
    mockMessage.reactions.cache.set("A", reactionA);
    mockMessage.reactions.cache.set("B", reactionB);

    // Desired: [A, B, C]
    const validRoles = [
      { emoji: "🇦", roleName: "Role A" },
      { emoji: "🇧", roleName: "Role B" },
      { emoji: "🇨", roleName: "Role C" },
    ];

    const result = await syncReactions(mockMessage, validRoles);

    // Expect: Preserved 2, Added 1, Removed 0
    expect(result.preserved).toBe(2);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);

    // Verify actions
    expect(mockMessage.react).toHaveBeenCalledTimes(1);
    expect(mockMessage.react).toHaveBeenCalledWith("🇨");
    expect(reactionA.users.remove).not.toHaveBeenCalled();
    expect(reactionB.users.remove).not.toHaveBeenCalled();
  });

  test("should reorder remaining reactions when order changes", async () => {
    // Current: [A, B]
    const reactionA = createReaction("🇦");
    const reactionB = createReaction("🇧");
    mockMessage.reactions.cache.set("A", reactionA);
    mockMessage.reactions.cache.set("B", reactionB);

    // Desired: [B, A] (Swapped)
    const validRoles = [
      { emoji: "🇧", roleName: "Role B" },
      { emoji: "🇦", roleName: "Role A" },
    ];

    const result = await syncReactions(mockMessage, validRoles);

    // Expect: Preserved 0 (diverges at first index), Added 2, Removed 2
    // Why? Because prefix matching stops at index 0 (A != B).
    // So it removes A, B and adds B, A.
    // Ideally it would swap, but reaction API is append-only. To reorder, you MUST remove and re-add.

    expect(result.preserved).toBe(0);
    expect(result.removed).toBe(2);
    expect(result.added).toBe(2);

    expect(reactionA.users.remove).toHaveBeenCalled();
    expect(reactionB.users.remove).toHaveBeenCalled();

    // Check order of adds (MUST be B then A)
    expect(mockMessage.react).toHaveBeenNthCalledWith(1, "🇧");
    expect(mockMessage.react).toHaveBeenNthCalledWith(2, "🇦");
  });

  test("should handle middle insertion correctly", async () => {
    // Current: [A, C]
    const reactionA = createReaction("🇦");
    const reactionC = createReaction("🇨");
    mockMessage.reactions.cache.set("A", reactionA);
    mockMessage.reactions.cache.set("C", reactionC);

    // Desired: [A, B, C]
    const validRoles = [
      { emoji: "🇦", roleName: "Role A" },
      { emoji: "🇧", roleName: "Role B" },
      { emoji: "🇨", roleName: "Role C" },
    ];

    const result = await syncReactions(mockMessage, validRoles);

    // Expect: Preserved 1 (A matches), Removed 1 (C), Added 2 (B, C)
    // Diverges at index 1 (C != B)
    expect(result.preserved).toBe(1);
    expect(result.removed).toBe(1); // Removes C
    expect(result.added).toBe(2); // Adds B, then C

    expect(reactionA.users.remove).not.toHaveBeenCalled();
    expect(reactionC.users.remove).toHaveBeenCalled(); // C was in wrong spot

    expect(mockMessage.react).toHaveBeenNthCalledWith(1, "🇧");
    expect(mockMessage.react).toHaveBeenNthCalledWith(2, "🇨");
  });

  test("should do nothing if already correct", async () => {
    // Current: [A]
    mockMessage.reactions.cache.set("A", createReaction("🇦"));

    // Desired: [A]
    const validRoles = [{ emoji: "🇦", roleName: "Role A" }];

    const result = await syncReactions(mockMessage, validRoles);

    expect(result.preserved).toBe(1);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(mockMessage.react).not.toHaveBeenCalled();
  });

  test("should ignore non-bot reactions", async () => {
    // Current: [A (user only)]
    const reactionA = createReaction("🇦", false); // me = false
    mockMessage.reactions.cache.set("A", reactionA);

    // Desired: [A]
    const validRoles = [{ emoji: "🇦", roleName: "Role A" }];

    const result = await syncReactions(mockMessage, validRoles);

    // Bot hasn't reacted, so currentReactions list is empty.
    // Diverge index 0.
    // Preserved 0. Removed 0 (since filtered out). Added 1.

    expect(result.preserved).toBe(0);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
    expect(mockMessage.react).toHaveBeenCalledWith("🇦");
  });
});
