import { describe, test, expect } from "vitest";

/**
 * Advanced Bad Words Detection Logic
 * Supports: simple, wildcard, regex modes
 */
function detectBadWords(content, settings) {
  const {
    mode = "simple",
    words = [],
    wildcardWords = [],
    regexPatterns = [],
    advancedWords = [],
  } = settings;
  const lowerContent = content.toLowerCase();

  let hasBadWord = false;

  if (mode === "wildcard" && wildcardWords.length > 0) {
    hasBadWord = wildcardWords.some(pattern => {
      const regex = new RegExp(pattern.toLowerCase().replace(/\*/g, ".*"), "i");
      return regex.test(lowerContent);
    });
  } else if (mode === "regex" && regexPatterns.length > 0) {
    hasBadWord = regexPatterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, "i");
        return regex.test(lowerContent);
      } catch {
        return false;
      }
    });
  } else if (words.length > 0) {
    hasBadWord = words.some(word => lowerContent.includes(word.toLowerCase()));
  } else if (advancedWords.length > 0 && mode === "simple") {
    hasBadWord = advancedWords.some(word =>
      lowerContent.includes(word.toLowerCase()),
    );
  }

  return hasBadWord;
}

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
  });
});
