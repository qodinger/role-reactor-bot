import { describe, it, expect } from "vitest";
import { hasPermission, USERLEVELS } from "../../../../src/features/streaming/StreamingManager.js";

// Helper: build a mock chat message with given badge flags
function msg({ broadcaster = false, mod = false, vip = false, subscriber = false } = {}) {
  return {
    isBroadcaster: broadcaster,
    isMod: mod,
    isVip: vip,
    isSubscriber: subscriber,
  };
}

describe("hasPermission", () => {
  // ── "everyone" ────────────────────────────────────────────────────────────
  describe('required = "everyone"', () => {
    it("allows anonymous users", () => {
      expect(hasPermission("everyone", msg())).toBe(true);
    });

    it("allows subscribers", () => {
      expect(hasPermission("everyone", msg({ subscriber: true }))).toBe(true);
    });

    it("allows broadcasters", () => {
      expect(hasPermission("everyone", msg({ broadcaster: true }))).toBe(true);
    });
  });

  // ── "subscriber" ──────────────────────────────────────────────────────────
  describe('required = "subscriber"', () => {
    it("rejects anonymous users", () => {
      expect(hasPermission("subscriber", msg())).toBe(false);
    });

    it("allows subscribers", () => {
      expect(hasPermission("subscriber", msg({ subscriber: true }))).toBe(true);
    });

    it("allows VIPs (higher level)", () => {
      expect(hasPermission("subscriber", msg({ vip: true }))).toBe(true);
    });

    it("allows moderators (higher level)", () => {
      expect(hasPermission("subscriber", msg({ mod: true }))).toBe(true);
    });

    it("allows broadcasters (highest level)", () => {
      expect(hasPermission("subscriber", msg({ broadcaster: true }))).toBe(true);
    });
  });

  // ── "vip" ─────────────────────────────────────────────────────────────────
  describe('required = "vip"', () => {
    it("rejects anonymous users", () => {
      expect(hasPermission("vip", msg())).toBe(false);
    });

    it("rejects subscribers (lower level)", () => {
      expect(hasPermission("vip", msg({ subscriber: true }))).toBe(false);
    });

    it("allows VIPs", () => {
      expect(hasPermission("vip", msg({ vip: true }))).toBe(true);
    });

    it("allows moderators (higher level)", () => {
      expect(hasPermission("vip", msg({ mod: true }))).toBe(true);
    });

    it("allows broadcasters", () => {
      expect(hasPermission("vip", msg({ broadcaster: true }))).toBe(true);
    });
  });

  // ── "moderator" ───────────────────────────────────────────────────────────
  describe('required = "moderator"', () => {
    it("rejects anonymous users", () => {
      expect(hasPermission("moderator", msg())).toBe(false);
    });

    it("rejects subscribers", () => {
      expect(hasPermission("moderator", msg({ subscriber: true }))).toBe(false);
    });

    it("rejects VIPs (lower level)", () => {
      expect(hasPermission("moderator", msg({ vip: true }))).toBe(false);
    });

    it("allows moderators", () => {
      expect(hasPermission("moderator", msg({ mod: true }))).toBe(true);
    });

    it("allows broadcasters (higher level)", () => {
      expect(hasPermission("moderator", msg({ broadcaster: true }))).toBe(true);
    });
  });

  // ── "owner" ───────────────────────────────────────────────────────────────
  describe('required = "owner"', () => {
    it("rejects anonymous users", () => {
      expect(hasPermission("owner", msg())).toBe(false);
    });

    it("rejects subscribers", () => {
      expect(hasPermission("owner", msg({ subscriber: true }))).toBe(false);
    });

    it("rejects VIPs", () => {
      expect(hasPermission("owner", msg({ vip: true }))).toBe(false);
    });

    it("rejects moderators (lower level)", () => {
      expect(hasPermission("owner", msg({ mod: true }))).toBe(false);
    });

    it("allows broadcasters (owner level)", () => {
      expect(hasPermission("owner", msg({ broadcaster: true }))).toBe(true);
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it('returns true for unknown/empty required level (treated as "everyone")', () => {
      expect(hasPermission("", msg())).toBe(true);
    });

    it('returns true for unknown level string (treated as "everyone")', () => {
      expect(hasPermission("nonexistent", msg())).toBe(true);
    });
  });

  // ── USERLEVELS constant ───────────────────────────────────────────────────
  describe("USERLEVELS", () => {
    it("has correct order from lowest to highest", () => {
      expect(USERLEVELS).toEqual(["everyone", "subscriber", "vip", "moderator", "owner"]);
    });
  });
});
