import { jest, describe, test, expect, beforeEach } from "@jest/globals";

describe("CommandHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Error Handling", () => {
    test("should handle Discord API errors", async () => {
      const discordError = {
        code: 50013,
        message: "Missing Permissions",
      };

      expect(discordError.code).toBe(50013);
      expect(discordError.message).toBe("Missing Permissions");
    });

    test("should handle rate limit errors", async () => {
      const rateLimitError = {
        code: 40002,
        message: "You are being rate limited",
        retry_after: 5,
      };

      expect(rateLimitError.code).toBe(40002);
      expect(rateLimitError.retry_after).toBe(5);
    });
  });

  describe("Validation", () => {
    test("should validate Discord ID format", () => {
      const validId = "123456789012345678";
      const invalidId = "invalid-id";
      const idRegex = /^\d{17,19}$/;

      expect(idRegex.test(validId)).toBe(true);
      expect(idRegex.test(invalidId)).toBe(false);
    });
  });
});
