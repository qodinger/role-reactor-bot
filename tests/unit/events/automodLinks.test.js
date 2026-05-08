import { describe, test, expect } from "vitest";

/**
 * Link Detection Logic
 * Extracted from automod event handler
 */
function detectLink(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  return urlRegex.test(content);
}

function containsAllowedDomain(message, allowedDomains) {
  try {
    const urlRegex = /https?:\/\/([^\s/]+)/g;
    const match = message.match(urlRegex);

    if (!match) return false;

    for (const url of match) {
      const domain = url
        .replace(/https?:\/\//, "")
        .split("/")[0]
        .toLowerCase();

      for (const allowed of allowedDomains) {
        if (domain === allowed || domain.endsWith("." + allowed)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

function shouldBlockLink(content, allowedDomains) {
  const hasLink = detectLink(content);
  if (!hasLink) return false;

  if (allowedDomains.length === 0) return true;

  return !containsAllowedDomain(content, allowedDomains);
}

describe("Link Detection", () => {
  describe("Should detect links", () => {
    test("https URL", () => {
      expect(detectLink("Check out https://google.com")).toBe(true);
    });

    test("http URL", () => {
      expect(detectLink("Visit http://example.com")).toBe(true);
    });

    test("URL with path", () => {
      expect(detectLink("Look at https://youtube.com/watch?v=abc")).toBe(true);
    });

    test("URL with query params", () => {
      expect(detectLink("See https://site.com?foo=bar")).toBe(true);
    });

    test("no protocol URL", () => {
      expect(detectLink("Visit google.com")).toBe(false);
    });

    test("no URL in message", () => {
      expect(detectLink("Hello world")).toBe(false);
    });

    test("URL at start of message", () => {
      expect(detectLink("https://discord.com is cool")).toBe(true);
    });
  });

  describe("Domain Allowlisting (Pro feature)", () => {
    test("should block when no whitelist and has URL", () => {
      expect(shouldBlockLink("Check https://google.com", [])).toBe(true);
    });

    test("should allow when no domains specified and no URL", () => {
      expect(shouldBlockLink("Check google.com", [])).toBe(false);
    });

    test("should allow whitelisted domain", () => {
      expect(
        shouldBlockLink("Check https://youtube.com", ["youtube.com"]),
      ).toBe(false);
    });

    test("should block non-whitelisted domain", () => {
      expect(shouldBlockLink("Check https://evil.com", ["youtube.com"])).toBe(
        true,
      );
    });

    test("should allow subdomain of whitelisted", () => {
      expect(
        shouldBlockLink("Check https://docs.google.com", ["google.com"]),
      ).toBe(false);
    });

    test("should block domain that is substring of whitelisted", () => {
      expect(
        shouldBlockLink("Check https://notgoogle.com", ["google.com"]),
      ).toBe(true);
    });

    test("should allow multiple whitelisted domains", () => {
      expect(
        shouldBlockLink("Check https://discord.com/invite/abc", [
          "youtube.com",
          "discord.com",
        ]),
      ).toBe(false);
    });

    test("should handle no URL but has whitelist", () => {
      expect(shouldBlockLink("Hello world", ["youtube.com"])).toBe(false);
    });

    test("should allow github.com but not raw.githubusercontent.com", () => {
      expect(
        shouldBlockLink("Check https://github.com/user/repo", ["github.com"]),
      ).toBe(false);
      expect(
        shouldBlockLink("Check https://raw.githubusercontent.com/file", [
          "github.com",
        ]),
      ).toBe(true);
    });
  });
});
