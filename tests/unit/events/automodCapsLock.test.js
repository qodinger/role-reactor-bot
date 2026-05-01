import { describe, test, expect } from "vitest";

/**
 * Caps Lock Detection Logic
 * This is extracted from the auto-mod event handler
 */
function detectCapsLock(content, threshold = 70, minLength = 10) {
  if (content.length < minLength) {
    return { detected: false, percentage: 0 };
  }

  const letters = content.replace(/[^a-zA-Z]/g, "");

  if (letters.length === 0) {
    return { detected: false, percentage: 0 };
  }

  const caps = content.replace(/[^A-Z]/g, "");
  const capsPercentage = (caps.length / letters.length) * 100;

  return {
    detected: capsPercentage >= threshold,
    percentage: capsPercentage,
  };
}

describe("Caps Lock Filter Detection", () => {
  describe("Should detect as CAPS (threshold: 70%, minLength: 10)", () => {
    test("all caps message", () => {
      const result = detectCapsLock("FREE FOLLOWERS NOW!!!", 70, 10);
      expect(result.detected).toBe(true);
      expect(result.percentage).toBeGreaterThan(70);
    });

    test("mostly caps with some lowercase", () => {
      const result = detectCapsLock("BUY CHEAP FOLLOWERS NOW", 70, 10);
      expect(result.detected).toBe(true);
    });

    test("caps with numbers", () => {
      const result = detectCapsLock("FREE 1000 FOLLOWERS NOW!!!", 70, 10);
      expect(result.detected).toBe(true);
    });

    test("shouting with punctuation", () => {
      const result = detectCapsLock("CHECK OUT THIS SERVER!!!", 70, 10);
      expect(result.detected).toBe(true);
    });
  });

  describe("Should NOT detect as CAPS (threshold: 70%, minLength: 10)", () => {
    test("normal sentence", () => {
      const result = detectCapsLock("Hello, how are you today?", 70, 10);
      expect(result.detected).toBe(false);
      expect(result.percentage).toBeLessThan(30);
    });

    test("single word caps", () => {
      const result = detectCapsLock("HELLO", 70, 10);
      expect(result.detected).toBe(false); // less than minLength
    });

    test("mixed case", () => {
      const result = detectCapsLock("HeLlO WoRlD", 70, 10);
      expect(result.detected).toBe(false);
    });

    test("lowercase only", () => {
      const result = detectCapsLock("hello world", 70, 10);
      expect(result.detected).toBe(false);
    });

    test("sentence case", () => {
      const result = detectCapsLock("This is a normal message", 70, 10);
      expect(result.detected).toBe(false);
    });

    test("short message", () => {
      const result = detectCapsLock("HELLO", 70, 10); // only 5 chars
      expect(result.detected).toBe(false);
    });

    test("caps but below threshold", () => {
      const result = detectCapsLock("Check This Out", 70, 10);
      expect(result.detected).toBe(false);
    });
  });

  describe("Edge cases", () => {
    test("empty string", () => {
      const result = detectCapsLock("", 70, 10);
      expect(result.detected).toBe(false);
    });

    test("only special characters", () => {
      const result = detectCapsLock("!!! ??? ...", 70, 10);
      expect(result.detected).toBe(false);
    });

    test("numbers only", () => {
      const result = detectCapsLock("1234567890", 70, 10);
      expect(result.detected).toBe(false);
    });
  });

  describe("Custom thresholds", () => {
    test("strict threshold 90%", () => {
      const result = detectCapsLock("FREE FOLLOWERS NOW!!!", 90, 10);
      expect(result.detected).toBe(true); // still mostly caps
    });

    test("lenient threshold 50%", () => {
      const result = detectCapsLock("Check This Out", 50, 10);
      expect(result.detected).toBe(false); // not enough caps even at 50%
    });

    test("custom minLength 5", () => {
      const result = detectCapsLock("HELLO", 70, 5);
      expect(result.detected).toBe(true); // 5 chars = minLength
    });
  });
});
