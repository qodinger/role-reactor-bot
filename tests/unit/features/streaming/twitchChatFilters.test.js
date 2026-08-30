import { describe, it, expect, beforeEach } from "vitest";
import {
  detectCaps,
  detectLinks,
  detectSpam,
  detectBadWords,
  runFilters,
} from "../../../../src/features/streaming/utils/twitchChatFilters.js";

describe("Twitch Chat Filters", () => {
  // ── detectCaps ────────────────────────────────────────────────────────────
  describe("detectCaps", () => {
    it("returns false for short messages", () => {
      expect(detectCaps("hello")).toEqual({ violated: false });
    });

    it("returns false when below threshold", () => {
      const text = "Hello this is a normal message with some caps";
      expect(detectCaps(text, { threshold: 70, minLength: 10 })).toEqual({ violated: false });
    });

    it("detects excessive caps", () => {
      const text = "THIS IS ALL CAPS AND QUITE LONG";
      expect(detectCaps(text, { threshold: 70, minLength: 10 })).toEqual({ violated: true });
    });

    it("ignores non-alpha characters in ratio", () => {
      // "HELLO 12345678" -> alpha = "HELLO" (5 chars, all uppercase) = 100%
      // Need mixed case: "HeLLo 12345678" -> alpha = "HeLLo" (3 upper, 2 lower) = 60%
      const text = "HeLLo 12345678";
      expect(detectCaps(text, { threshold: 70, minLength: 10 })).toEqual({ violated: false });
    });

    it("respects custom threshold", () => {
      const text = "Hello World"; // 2/8 = 25% uppercase (stripped non-alpha: HW = 2/8)
      // Actually: "HelloWorld" -> H=upper, e,l,l,o,W,o,r,l,d -> 2/10 = 20%
      expect(detectCaps(text, { threshold: 50, minLength: 5 })).toEqual({ violated: false });
    });

    it("returns false for empty string", () => {
      expect(detectCaps("")).toEqual({ violated: false });
    });
  });

  // ── detectLinks ───────────────────────────────────────────────────────────
  describe("detectLinks", () => {
    it("detects http links", () => {
      expect(detectLinks("check http://example.com")).toEqual({ violated: true });
    });

    it("detects https links", () => {
      expect(detectLinks("visit https://twitch.tv/channel")).toEqual({ violated: true });
    });

    it("returns false for normal text", () => {
      expect(detectLinks("hello world")).toEqual({ violated: false });
    });

    it("returns false for text with dots but no protocol", () => {
      expect(detectLinks("go to example.com")).toEqual({ violated: false });
    });
  });

  // ── detectBadWords ────────────────────────────────────────────────────────
  describe("detectBadWords", () => {
    it("returns false for empty word list", () => {
      expect(detectBadWords("anything", [])).toEqual({ violated: false });
    });

    it("detects exact word match (case-insensitive)", () => {
      expect(detectBadWords("this is BADWORD here", ["badword"])).toEqual({ violated: true });
    });

    it("detects substring match", () => {
      expect(detectBadWords("badword123", ["badword"])).toEqual({ violated: true });
    });

    it("returns false when no match", () => {
      expect(detectBadWords("hello world", ["badword"])).toEqual({ violated: false });
    });

    it("handles multiple words", () => {
      expect(detectBadWords("this has a terrible and badword in it", ["badword", "terrible"])).toEqual({
        violated: true,
      });
    });
  });

  // ── detectSpam ────────────────────────────────────────────────────────────
  describe("detectSpam", () => {
    let history;

    beforeEach(() => {
      history = new Map();
    });

    it("returns false for first message", () => {
      expect(detectSpam("hello", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history)).toEqual({
        violated: false,
      });
    });

    it("detects repeated messages", () => {
      detectSpam("hello", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history);
      detectSpam("hello", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history);
      const result = detectSpam("hello", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history);
      expect(result).toEqual({ violated: true, type: "repeated" });
    });

    it("detects rate limit", () => {
      detectSpam("a", "user1", { repeatedMessages: 10, rateThreshold: 3 }, history);
      detectSpam("b", "user1", { repeatedMessages: 10, rateThreshold: 3 }, history);
      const result = detectSpam("c", "user1", { repeatedMessages: 10, rateThreshold: 3 }, history);
      expect(result).toEqual({ violated: true, type: "rate" });
    });

    it("tracks different users independently", () => {
      detectSpam("hello", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history);
      detectSpam("hello", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history);
      // user2's first message should not trigger
      expect(detectSpam("hello", "user2", { repeatedMessages: 3, rateThreshold: 5 }, history)).toEqual({
        violated: false,
      });
    });

    it("does not count different messages as repeated", () => {
      detectSpam("hello", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history);
      detectSpam("world", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history);
      expect(detectSpam("foo", "user1", { repeatedMessages: 3, rateThreshold: 5 }, history)).toEqual({
        violated: false,
      });
    });
  });

  // ── runFilters ────────────────────────────────────────────────────────────
  describe("runFilters", () => {
    let spamHistory;

    beforeEach(() => {
      spamHistory = new Map();
    });

    it("returns false when no filters enabled", () => {
      expect(runFilters("hello", "user1", {}, spamHistory)).toEqual({ violated: false });
    });

    it("returns first violation found", () => {
      const filters = {
        caps: { enabled: true, threshold: 70, minLength: 10 },
        links: { enabled: false },
        spam: { enabled: false },
        badWords: { enabled: false },
      };
      const text = "THIS IS ALL CAPS AND VERY LONG MESSAGE";
      expect(runFilters(text, "user1", filters, spamHistory)).toEqual({ violated: true, type: "caps" });
    });

    it("checks links filter", () => {
      const filters = {
        caps: { enabled: false },
        links: { enabled: true },
        spam: { enabled: false },
        badWords: { enabled: false },
      };
      expect(runFilters("visit https://twitch.tv", "user1", filters, spamHistory)).toEqual({
        violated: true,
        type: "links",
      });
    });

    it("checks badWords filter", () => {
      const filters = {
        caps: { enabled: false },
        links: { enabled: false },
        spam: { enabled: false },
        badWords: { enabled: true, words: ["badword"] },
      };
      expect(runFilters("this has a badword", "user1", filters, spamHistory)).toEqual({
        violated: true,
        type: "badWords",
      });
    });

    it("checks spam filter", () => {
      const filters = {
        caps: { enabled: false },
        links: { enabled: false },
        spam: { enabled: true, repeatedMessages: 2, rateThreshold: 5 },
        badWords: { enabled: false },
      };
      detectSpam("hello", "user1", filters.spam, spamHistory);
      expect(runFilters("hello", "user1", filters, spamHistory)).toEqual({
        violated: true,
        type: "spamRepeated",
      });
    });

    it("returns false when message is clean", () => {
      const filters = {
        caps: { enabled: true, threshold: 70, minLength: 10 },
        links: { enabled: true },
        spam: { enabled: true, repeatedMessages: 3, rateThreshold: 5 },
        badWords: { enabled: true, words: ["badword"] },
      };
      expect(runFilters("hello world", "user1", filters, spamHistory)).toEqual({ violated: false });
    });
  });
});
