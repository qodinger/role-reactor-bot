#!/usr/bin/env node

import "./load-env.js";
import crypto from "crypto";
import { MongoClient } from "mongodb";

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 32;
const IV_LENGTH = 16;

function deriveKey(encryptionKey, salt) {
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256");
}

function decryptToken(encryptedBase64) {
  if (!encryptedBase64) return null;

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) return null;

  try {
    const combined = Buffer.from(encryptedBase64, "base64");
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + 16,
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + 16);

    const key = deriveKey(encryptionKey, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

async function backfill(dryRun = true) {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "role_reactor";

  if (!mongoUri) {
    console.error("❌ MONGODB_URI not set");
    process.exit(1);
  }

  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    console.error("❌ TOKEN_ENCRYPTION_KEY not set");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    console.log("🔌 Connecting to MongoDB...");
    await client.connect();
    console.log("✅ Connected\n");

    const db = client.db(dbName);
    const users = db.collection("users");

    // Find users with email but no emailNormalized
    const cursor = users.find({
      email: { $exists: true, $ne: null },
      $or: [{ emailNormalized: { $exists: false } }, { emailNormalized: null }],
    });

    const toBackfill = [];
    for await (const user of cursor) {
      toBackfill.push(user);
    }

    console.log(`📊 Found ${toBackfill.length} users needing backfill\n`);

    if (toBackfill.length === 0) {
      console.log("✅ Nothing to backfill!");
      return;
    }

    if (dryRun) {
      console.log("🔍 DRY RUN — would backfill:");
      toBackfill.forEach(u => {
        const decrypted = decryptToken(u.email);
        const normalized = decrypted
          ? decrypted.toLowerCase().trim()
          : "(decrypt failed)";
        console.log(`   ${u.username || u.discordId}: ${normalized}`);
      });
      console.log(`\nRun with --commit to apply.`);
      return;
    }

    let success = 0;
    let failed = 0;

    for (const user of toBackfill) {
      try {
        const decrypted = decryptToken(user.email);
        if (!decrypted || !decrypted.includes("@")) {
          console.log(
            `   ⚠️  Skipped ${user.discordId} — decrypt failed or invalid`,
          );
          failed++;
          continue;
        }

        const normalized = decrypted.toLowerCase().trim();
        await users.updateOne(
          { _id: user._id },
          { $set: { emailNormalized: normalized } },
        );

        success++;
        console.log(`   ✅ ${user.username || user.discordId}: ${normalized}`);
      } catch {
        failed++;
        console.log(`   ❌ ${user.discordId} — update failed`);
      }
    }

    console.log(`\n📊 Done: ${success} updated, ${failed} failed`);
  } finally {
    await client.close();
  }
}

const args = process.argv.slice(2);
const dryRun = !args.includes("--commit");

console.log("\n📧 Backfill emailNormalized Script");
console.log("===================================\n");

if (dryRun) {
  console.log("🔍 DRY RUN mode (add --commit to apply)\n");
} else {
  console.log("⚠️  COMMIT mode — modifying database\n");
}

backfill(dryRun);
