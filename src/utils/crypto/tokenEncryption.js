import crypto from "crypto";
import { getLogger } from "../logger.js";

const logger = getLogger();

// Encryption settings
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from environment
 * @returns {string|null} Encryption key or null
 */
function getEncryptionKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    logger.warn(
      "⚠️ TOKEN_ENCRYPTION_KEY not set - tokens will not be encrypted",
    );
    return null;
  }
  return key;
}

/**
 * Derive a key from the encryption key using PBKDF2
 * @param {string} encryptionKey - Base encryption key
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived key
 */
function deriveKey(encryptionKey, salt) {
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256");
}

/**
 * Encrypt a token or sensitive string
 * @param {string} plaintext - The string to encrypt
 * @returns {string|null} Encrypted string (base64) or null if encryption fails
 */
export function encryptToken(plaintext) {
  if (!plaintext) return null;

  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    // Return as-is if no encryption key (development mode)
    logger.debug("Token stored without encryption (no key configured)");
    return plaintext;
  }

  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine salt + iv + authTag + encrypted into single string
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, "base64"),
    ]);

    return combined.toString("base64");
  } catch (error) {
    logger.error("Failed to encrypt token:", error.message);
    return null;
  }
}

/**
 * Decrypt an encrypted token
 * @param {string} encryptedBase64 - The encrypted string (base64)
 * @returns {string|null} Decrypted string or null if decryption fails
 */
export function decryptToken(encryptedBase64) {
  if (!encryptedBase64) return null;

  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    // Assume it's stored in plaintext if no key
    return encryptedBase64;
  }

  try {
    // Decode combined buffer
    const combined = Buffer.from(encryptedBase64, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const encrypted = combined.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    logger.error("Failed to decrypt token:", error.message);
    return null;
  }
}

/**
 * Check if a string appears to be encrypted
 * (encrypted strings are longer due to salt, iv, authTag)
 * @param {string} value - String to check
 * @returns {boolean} Whether it appears encrypted
 */
export function isEncrypted(value) {
  if (!value) return false;

  try {
    const decoded = Buffer.from(value, "base64");
    // Encrypted tokens have: salt (32) + iv (16) + authTag (16) + encrypted data
    // Minimum size would be 64 + some encrypted content
    return decoded.length > 64 && value.match(/^[A-Za-z0-9+/]+=*$/);
  } catch {
    return false;
  }
}

/**
 * Generate a secure encryption key
 * Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * @returns {string} Random 256-bit key as hex string
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}
