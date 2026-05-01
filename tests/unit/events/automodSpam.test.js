import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * Spam Detection Logic
 * Extracted from automod event handler
 */

const messageHistory = new Map();

function initUserHistory(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (!messageHistory.has(key)) {
    messageHistory.set(key, {
      messages: [],
      recentCount: 0,
    });
  }
  return messageHistory.get(key);
}

function cleanupOldMessages(userData, now, windowMs = 5000) {
  while (
    userData.messages.length > 0 &&
    userData.messages[0].time < now - windowMs
  ) {
    userData.messages.shift();
  }
  if (userData.messages.length === 0) {
    userData.recentCount = 0;
  }
}

function checkDuplicateSpam(userData, messageContent, threshold = 3) {
  const duplicateCount = userData.messages.filter(
    m => m.content === messageContent,
  ).length;

  return {
    isSpam: duplicateCount >= threshold,
    duplicateCount,
  };
}

function checkRateLimitSpam(userData, rateThreshold = 5) {
  if (userData.recentCount >= rateThreshold) {
    return { isSpam: true, count: userData.recentCount };
  }
  return { isSpam: false, count: userData.recentCount };
}

function addMessage(userData, content, time) {
  userData.messages.push({ content, time });
  userData.recentCount++;
}

describe("Spam Detection", () => {
  beforeEach(() => {
    messageHistory.clear();
  });

  describe("Duplicate Message Detection", () => {
    test("should not trigger on first unique message", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      addMessage(userData, "Hello", now);

      const result = checkDuplicateSpam(userData, "Hello", 3);
      expect(result.isSpam).toBe(false);
      expect(result.duplicateCount).toBe(1);
    });

    test("should not trigger when below threshold", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      addMessage(userData, "Hello", now);
      addMessage(userData, "Hello", now);

      const result = checkDuplicateSpam(userData, "Hello", 3);
      expect(result.isSpam).toBe(false);
      expect(result.duplicateCount).toBe(2);
    });

    test("should trigger when duplicate count reaches threshold", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      addMessage(userData, "Hello", now);
      addMessage(userData, "Hello", now);
      addMessage(userData, "Hello", now);

      const result = checkDuplicateSpam(userData, "Hello", 3);
      expect(result.isSpam).toBe(true);
      expect(result.duplicateCount).toBe(3);
    });

    test("should trigger with multiple duplicates", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        addMessage(userData, "BUY NOW!!!", now);
      }

      const result = checkDuplicateSpam(userData, "BUY NOW!!!", 3);
      expect(result.isSpam).toBe(true);
      expect(result.duplicateCount).toBe(5);
    });

    test("should count only identical messages", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      addMessage(userData, "Hello", now);
      addMessage(userData, "World", now);
      addMessage(userData, "Hello", now);

      const result = checkDuplicateSpam(userData, "Hello", 3);
      expect(result.isSpam).toBe(false);
      expect(result.duplicateCount).toBe(2);
    });

    test("should use custom threshold", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      for (let i = 0; i < 4; i++) {
        addMessage(userData, "Spam", now);
      }

      const result = checkDuplicateSpam(userData, "Spam", 5);
      expect(result.isSpam).toBe(false);
    });
  });

  describe("Rate Limiting Detection", () => {
    test("should not trigger on slow messages", () => {
      const userData = initUserHistory("guild1", "user1");
      addMessage(userData, "Message 1", Date.now() - 4000);
      addMessage(userData, "Message 2", Date.now() - 3000);

      const result = checkRateLimitSpam(userData, 5);
      expect(result.isSpam).toBe(false);
    });

    test("should trigger when rate threshold reached", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        addMessage(userData, `Message ${i}`, now);
      }

      const result = checkRateLimitSpam(userData, 5);
      expect(result.isSpam).toBe(true);
      expect(result.count).toBe(5);
    });

    test("should trigger above rate threshold", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      for (let i = 0; i < 7; i++) {
        addMessage(userData, `Message ${i}`, now);
      }

      const result = checkRateLimitSpam(userData, 5);
      expect(result.isSpam).toBe(true);
      expect(result.count).toBe(7);
    });

    test("should use custom rate threshold", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        addMessage(userData, `Message ${i}`, now);
      }

      const result = checkRateLimitSpam(userData, 3);
      expect(result.isSpam).toBe(true);
    });
  });

  describe("Message Cleanup (Time-based)", () => {
    test("should remove old messages", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      addMessage(userData, "Old", now - 10000);
      addMessage(userData, "Old", now - 10000);
      addMessage(userData, "New", now);

      cleanupOldMessages(userData, now, 5000);

      expect(userData.messages.length).toBe(1);
      expect(userData.messages[0].content).toBe("New");
    });

    test("should reset count when all messages cleared", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();
      addMessage(userData, "Old", now - 10000);

      cleanupOldMessages(userData, now, 5000);

      expect(userData.recentCount).toBe(0);
    });
  });

  describe("Integration - Full spam check", () => {
    test("should detect both duplicate and rate spam", () => {
      const userData = initUserHistory("guild1", "user1");
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        addMessage(userData, "Spam message", now);
      }

      const duplicateResult = checkDuplicateSpam(userData, "Spam message", 3);
      const rateResult = checkRateLimitSpam(userData, 5);

      expect(duplicateResult.isSpam).toBe(true);
      expect(rateResult.isSpam).toBe(true);
    });

    test("should handle multiple users separately", () => {
      const user1Data = initUserHistory("guild1", "user1");
      const user2Data = initUserHistory("guild1", "user2");
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        addMessage(user1Data, "Spam", now);
      }
      addMessage(user2Data, "Spam", now);

      const user1Result = checkDuplicateSpam(user1Data, "Spam", 3);
      const user2Result = checkDuplicateSpam(user2Data, "Spam", 3);

      expect(user1Result.isSpam).toBe(true);
      expect(user2Result.isSpam).toBe(false);
    });
  });
});
