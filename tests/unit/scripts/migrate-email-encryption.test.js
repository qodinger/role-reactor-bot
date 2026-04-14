import { describe, test, expect } from "vitest";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function deriveKey(encryptionKey, salt) {
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256");
}

function encryptToken(plaintext, encryptionKey) {
  if (!plaintext) return null;

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(encryptionKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, "base64"),
  ]);
  return combined.toString("base64");
}

function isEncrypted(value) {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, "base64");
    const isValidBase64 =
      decoded.length > 64 && value.match(/^[A-Za-z0-9+/]+=*$/);
    return Boolean(isValidBase64);
  } catch {
    return false;
  }
}

function hashEmail(email) {
  if (!email) return null;
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  const maskedLocal =
    local.length > 2
      ? local[0] + "*".repeat(local.length - 2) + local[local.length - 1]
      : local[0] + "*";
  return `${maskedLocal}@${domain}`;
}

const TEST_KEY = "test-encryption-key-for-unit-tests-32ch";

describe("Email Encryption Migration - Utility Functions", () => {
  describe("isEncrypted", () => {
    test("should return true for encrypted strings", () => {
      const encrypted = encryptToken("test@example.com", TEST_KEY);
      const result = isEncrypted(encrypted);
      expect(result).toBe(true);
    });

    test("should return false for plaintext emails", () => {
      expect(isEncrypted("test@example.com")).toBe(false);
    });

    test("should return false for null/undefined", () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
      expect(isEncrypted("")).toBe(false);
    });

    test("should return false for invalid base64", () => {
      expect(isEncrypted("not-valid-base64!!!")).toBe(false);
    });

    test("should return false for short strings", () => {
      expect(isEncrypted("abc")).toBe(false);
    });
  });

  describe("hashEmail", () => {
    test("should hash email consistently", () => {
      const hash1 = hashEmail("Test@Example.COM");
      const hash2 = hashEmail("test@example.com");
      expect(hash1).toBe(hash2);
    });

    test("should hash email with trim", () => {
      const hash1 = hashEmail("  test@example.com  ");
      const hash2 = hashEmail("test@example.com");
      expect(hash1).toBe(hash2);
    });

    test("should return null for null/undefined", () => {
      expect(hashEmail(null)).toBeNull();
      expect(hashEmail(undefined)).toBeNull();
    });

    test("should produce valid SHA256 hex", () => {
      const hash = hashEmail("test@example.com");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("maskEmail", () => {
    test("should mask middle of email", () => {
      const result = maskEmail("samantha@gmail.com");
      expect(result).toContain("@");
      expect(result).toContain("*");
      expect(result.endsWith("@gmail.com")).toBe(true);
    });

    test("should mask short local parts", () => {
      expect(maskEmail("ab@example.com")).toBe("a*@example.com");
    });

    test("should handle invalid emails", () => {
      expect(maskEmail(null)).toBeNull();
      expect(maskEmail("invalid")).toBe("invalid");
    });

    test("should preserve domain", () => {
      const result = maskEmail("verylongname@sub.domain.com");
      expect(result.endsWith("@sub.domain.com")).toBe(true);
      expect(result).toContain("*");
    });
  });

  describe("Migration Logic Simulation", () => {
    test("should correctly identify plaintext vs encrypted emails", () => {
      const emails = [
        { value: "user@example.com", expectedEncrypted: false },
        { value: "another@test.org", expectedEncrypted: false },
      ];

      emails.forEach(({ value, expectedEncrypted }) => {
        expect(isEncrypted(value)).toBe(expectedEncrypted);
      });
    });

    test("should handle mixed email collection", () => {
      const encrypted = encryptToken("secure@example.com", TEST_KEY);

      const emails = {
        plaintext1: "user1@example.com",
        plaintext2: "user2@example.com",
        encrypted: encrypted,
      };

      expect(isEncrypted(emails.plaintext1)).toBe(false);
      expect(isEncrypted(emails.plaintext2)).toBe(false);
      const encryptedCheck = isEncrypted(emails.encrypted);
      expect(encryptedCheck).toBe(true);
    });

    test("should validate email format before migration", () => {
      const validEmail = "user@example.com";
      const invalidEmail = "not-an-email";
      const emailWithAt = "has@at@symbol.com";

      expect(
        validEmail.includes("@") && validEmail.split("@").length === 2,
      ).toBe(true);
      expect(invalidEmail.includes("@")).toBe(false);
      expect(emailWithAt.split("@").length > 2).toBe(true);
    });
  });
});
