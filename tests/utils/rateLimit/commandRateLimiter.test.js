import { describe, it, expect, beforeEach } from "vitest";
import { getCommandRateLimiter } from "../../../src/utils/rateLimit/commandRateLimiter.js";

describe("CommandRateLimiter", () => {
  let rateLimiter;

  beforeEach(() => {
    // Get fresh instance for each test
    rateLimiter = getCommandRateLimiter();
    // Clear all collections
    rateLimiter.userCooldowns.clear();
    rateLimiter.guildCooldowns.clear();
    rateLimiter.userCommandCount.clear();
    rateLimiter.bannedUsers.clear();
  });

  describe("checkLimit", () => {
    it("should allow first command for a user", async () => {
      const result = await rateLimiter.checkLimit(
        "123456789",
        "ping",
        "987654321"
      );
      expect(result.allowed).toBe(true);
    });

    it("should enforce command cooldown", async () => {
      const userId = "user1";
      const commandName = "avatar";
      const guildId = "guild1";

      // First usage - should be allowed
      const firstResult = await rateLimiter.checkLimit(
        userId,
        commandName,
        guildId
      );
      expect(firstResult.allowed).toBe(true);

      // Record the usage
      await rateLimiter.recordUsage(userId, commandName, guildId);

      // Second usage immediately - should be denied
      const secondResult = await rateLimiter.checkLimit(
        userId,
        commandName,
        guildId
      );
      expect(secondResult.allowed).toBe(false);
      expect(secondResult.reason).toBe("command_cooldown");
      expect(secondResult.retryAfter).toBeGreaterThan(0);
    });

    it("should enforce global rate limit", async () => {
      const userId = "user2";
      const guildId = "guild2";

      // Use up the global limit (10 commands)
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkLimit(
          userId,
          `command${i}`,
          guildId
        );
        if (result.allowed) {
          await rateLimiter.recordUsage(userId, `command${i}`, guildId);
        }
      }

      // Next command should be denied
      const limitResult = await rateLimiter.checkLimit(
        userId,
        "another_command",
        guildId
      );
      expect(limitResult.allowed).toBe(false);
      expect(limitResult.reason).toBe("global_limit");
    });

    it("should detect spam behavior", async () => {
      const userId = "spammer";
      const guildId = "guild3";

      // Fire 22 commands rapidly (exceeds spam limit of 20 in 5s)
      // But we need to bypass global limit (10 commands/10s)
      // So we'll manually add timestamps to simulate spam
      const now = Date.now();
      const spamTimestamps = [];
      for (let i = 0; i < 22; i++) {
        spamTimestamps.push(now - 1000); // All within last second
      }
      rateLimiter.userCommandCount.set(userId, spamTimestamps);

      // Now check - should be banned for spam
      const banResult = await rateLimiter.checkLimit(
        userId,
        "next_command",
        guildId
      );
      expect(banResult.allowed).toBe(false);
      expect(banResult.reason).toBe("spam_ban");
    });

    it("should allow different users independently", async () => {
      const guildId = "guild4";

      // Clear state explicitly
      rateLimiter.userCooldowns.clear();
      rateLimiter.guildCooldowns.clear();
      rateLimiter.userCommandCount.clear();
      rateLimiter.bannedUsers.clear();

      // User 1 uses multiple commands (up to global limit)
      for (let i = 0; i < 5; i++) {
        await rateLimiter.recordUsage("userA", `cmd${i}`, guildId);
      }

      // User 2 should still be able to use commands
      // (different users have separate command counts)
      const user2Result = await rateLimiter.checkLimit(
        "userB",
        "avatar",
        guildId
      );
      expect(user2Result.allowed).toBe(true);
      
      // Verify userB can actually use commands
      const user2RecordResult = await rateLimiter.checkLimit(
        "userB",
        "avatar",
        guildId
      );
      expect(user2RecordResult.allowed).toBe(true);
    });

    it("should allow different commands independently", async () => {
      const userId = "user3";
      const guildId = "guild5";

      // User uses avatar command
      await rateLimiter.recordUsage(userId, "avatar", guildId);

      // Same user should be able to use ping command
      const pingResult = await rateLimiter.checkLimit(
        userId,
        "ping",
        guildId
      );
      expect(pingResult.allowed).toBe(true);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      const userId = "user4";
      const guildId = "guild6";

      // Record some usage
      await rateLimiter.recordUsage(userId, "ping", guildId);
      await rateLimiter.recordUsage(userId, "avatar", guildId);

      const stats = rateLimiter.getStats();

      expect(stats.userCooldowns).toBeGreaterThanOrEqual(2);
      expect(stats.guildCooldowns).toBeGreaterThanOrEqual(2);
      expect(stats.trackedUsers).toBeGreaterThanOrEqual(1);
    });
  });

  describe("cleanup", () => {
    it("should clean up old entries", () => {
      const userId = "user5";
      const guildId = "guild7";

      // Manually set old timestamp
      const oldTime = Date.now() - 120000; // 2 minutes ago
      rateLimiter.userCooldowns.set(`${userId}-oldcmd`, oldTime);
      rateLimiter.userCommandCount.set(userId, [oldTime]);

      // Run cleanup
      rateLimiter.cleanup();

      // Old entries should be cleaned up
      expect(rateLimiter.userCooldowns.has(`${userId}-oldcmd`)).toBe(false);
    });
  });
});
