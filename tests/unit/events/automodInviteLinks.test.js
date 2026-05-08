import { describe, test, expect } from "vitest";

/**
 * Invite Link Detection Logic
 * Extracted from automod event handler
 */

const inviteRegex = /(discord\.(gg|com\/invite)\/[\w-]+)/gi;

function detectInviteLink(content) {
  inviteRegex.lastIndex = 0;
  return inviteRegex.test(content);
}

function extractInvites(content) {
  const matches = content.match(inviteRegex);
  return matches || [];
}

describe("Invite Link Detection", () => {
  describe("Should detect Discord invites", () => {
    test("should detect discord.gg invite", () => {
      expect(detectInviteLink("Join my server discord.gg/abc123")).toBe(true);
    });

    test("should detect invite with numbers", () => {
      expect(detectInviteLink("discord.gg/1234567890")).toBe(true);
    });

    test("should detect multiple invites in one message", () => {
      expect(detectInviteLink("discord.gg/abc and discord.gg/xyz")).toBe(true);
    });

    test("should detect lowercase only", () => {
      expect(detectInviteLink("discord.gg/abc")).toBe(true);
    });
  });

  describe("Should not detect non-invites", () => {
    test("should not detect regular website", () => {
      expect(detectInviteLink("Check google.com")).toBe(false);
    });

    test("should not detect Discord domain without invite", () => {
      expect(detectInviteLink("discord.com")).toBe(false);
    });

    test("should not detect Discord support", () => {
      expect(detectInviteLink("discord.com/help")).toBe(false);
    });

    test("should not detect Discord status", () => {
      expect(detectInviteLink("discord.com/status")).toBe(false);
    });

    test("should not detect regular message", () => {
      expect(detectInviteLink("Hello everyone!")).toBe(false);
    });

    test("should not detect partial invite pattern", () => {
      expect(detectInviteLink("discord.gg is cool but discord")).toBe(false);
    });
  });

  describe("Extract Multiple Invites", () => {
    test("should extract single invite", () => {
      const invites = extractInvites("Join discord.gg/abc123");
      expect(invites).toHaveLength(1);
      expect(invites[0]).toBe("discord.gg/abc123");
    });

    test("should extract multiple invites", () => {
      const invites = extractInvites("Check discord.gg/abc and discord.gg/xyz");
      expect(invites).toHaveLength(2);
    });

    test("should return empty array for no invites", () => {
      const invites = extractInvites("Hello world");
      expect(invites).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    test("should handle invite with underscore", () => {
      expect(detectInviteLink("discord.gg/my_server")).toBe(true);
    });

    test("should handle invite at start of message", () => {
      expect(detectInviteLink("discord.gg/abc123 Hello!")).toBe(true);
    });

    test("should handle invite with query params (detected by regex)", () => {
      expect(detectInviteLink("discord.gg/abc?ref=test")).toBe(true);
    });
  });
});
