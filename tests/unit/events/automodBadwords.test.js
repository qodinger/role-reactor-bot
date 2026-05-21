import { describe, test, expect } from "vitest";
import { detectBadWords } from "../../../src/utils/automod/badWordDetector.js";

describe("Advanced Bad Words Detection", () => {
  describe("Simple mode (default)", () => {
    test("detects exact word", () => {
      const result = detectBadWords("This is spam content", {
        words: ["spam"],
      });
      expect(result).toBe(true);
    });

    test("detects word case insensitive", () => {
      const result = detectBadWords("This is SPAM content", {
        words: ["spam"],
      });
      expect(result).toBe(true);
    });

    test("detects partial match (substring)", () => {
      const result = detectBadWords("This is spamegg content", {
        words: ["spam"],
      });
      expect(result).toBe(true);
    });

    test("handles multiple words", () => {
      const result = detectBadWords("Bad word here", {
        words: ["bad", "word"],
      });
      expect(result).toBe(true);
    });

    test("returns false when no match", () => {
      const result = detectBadWords("Clean content here", {
        words: ["spam"],
      });
      expect(result).toBe(false);
    });
  });

  describe("Wildcard mode (* matches any)", () => {
    test("detects with wildcard", () => {
      const result = detectBadWords("This is spammed content", {
        mode: "wildcard",
        wildcardWords: ["spam*"],
      });
      expect(result).toBe(true);
    });

    test("detects prefix wildcard", () => {
      const result = detectBadWords("Check out spammy", {
        mode: "wildcard",
        wildcardWords: ["*spam"],
      });
      expect(result).toBe(true);
    });

    test("detects middle wildcard", () => {
      const result = detectBadWords("This spammers are bad", {
        mode: "wildcard",
        wildcardWords: ["s*p"],
      });
      expect(result).toBe(true);
    });

    test("multiple wildcards", () => {
      const result = detectBadWords("Buy f0llowers cheap", {
        mode: "wildcard",
        wildcardWords: ["f*ll*w*rs", "ch*p"],
      });
      expect(result).toBe(true);
    });

    test("returns false when no match", () => {
      const result = detectBadWords("Clean content", {
        mode: "wildcard",
        wildcardWords: ["spam*"],
      });
      expect(result).toBe(false);
    });
  });

  describe("Regex mode", () => {
    test("detects regex pattern", () => {
      const result = detectBadWords("My number is 555-1234", {
        mode: "regex",
        regexPatterns: ["\\d{3}-\\d{4}"],
      });
      expect(result).toBe(true);
    });

    test("detects alternative pattern", () => {
      const result = detectBadWords("badword1 is not allowed", {
        mode: "regex",
        regexPatterns: ["badword\\d+"],
      });
      expect(result).toBe(true);
    });

    test("detects word boundary", () => {
      const result = detectBadWords("hello badword world", {
        mode: "regex",
        regexPatterns: ["\\bbadword\\b"],
      });
      expect(result).toBe(true);
    });

    test("invalid regex is handled gracefully", () => {
      const result = detectBadWords("test content", {
        mode: "regex",
        regexPatterns: ["[invalid"],
      });
      expect(result).toBe(false);
    });

    test("returns false when no match", () => {
      const result = detectBadWords("clean content", {
        mode: "regex",
        regexPatterns: ["\\d{3}-\\d{4}"],
      });
      expect(result).toBe(false);
    });
  });

  describe("Edge cases", () => {
    test("empty words list", () => {
      const result = detectBadWords("spam content", { words: [] });
      expect(result).toBe(false);
    });

    test("empty content", () => {
      const result = detectBadWords("", { words: ["spam"] });
      expect(result).toBe(false);
    });

    test("no settings provided", () => {
      const result = detectBadWords("spam content", {});
      expect(result).toBe(false);
    });

    test("wildcardWords ignored when not in wildcard mode", () => {
      const result = detectBadWords("spam content", {
        mode: "simple",
        wildcardWords: ["spam*"],
        words: [],
      });
      expect(result).toBe(false);
    });

    test("regexPatterns ignored when not in regex mode", () => {
      const result = detectBadWords("spam content", {
        mode: "simple",
        regexPatterns: ["spam"],
        words: [],
      });
      expect(result).toBe(false);
    });
  });
});
