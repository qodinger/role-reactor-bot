#!/usr/bin/env node

import "./load-env.js";
import crypto from "crypto";
import { MongoClient } from "mongodb";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

function deriveKey(encryptionKey, salt) {
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, "sha256");
}

function encryptToken(plaintext) {
  if (!plaintext) return null;

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("❌ TOKEN_ENCRYPTION_KEY not set");
    process.exit(1);
  }

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

async function migrateEmails(dryRun = true) {
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
    const usersCollection = db.collection("users");

    const usersWithPlaintextEmails = [];

    console.log("🔍 Scanning for users with plaintext emails...\n");

    const cursor = usersCollection.find({
      email: { $exists: true, $ne: null },
    });

    let total = 0;
    let plaintextCount = 0;
    let encryptedCount = 0;
    let errorCount = 0;

    for await (const user of cursor) {
      total++;

      if (!user.email) continue;

      if (isEncrypted(user.email)) {
        encryptedCount++;
        continue;
      }

      if (!user.email.includes("@")) {
        console.log(
          `⚠️  Skipping user ${user.discordId} - invalid email format: ${user.email}`,
        );
        errorCount++;
        continue;
      }

      plaintextCount++;
      usersWithPlaintextEmails.push({
        discordId: user.discordId,
        email: user.email,
        username: user.username,
      });
    }

    console.log(`\n📊 Scan Results:`);
    console.log(`   Total users with emails: ${total}`);
    console.log(`   Already encrypted: ${encryptedCount}`);
    console.log(`   Plaintext (need migration): ${plaintextCount}`);
    console.log(`   Invalid format: ${errorCount}`);

    if (plaintextCount === 0) {
      console.log("\n✅ No emails need migration!");
      return;
    }

    console.log(`\n📋 Users to migrate:`);
    usersWithPlaintextEmails.forEach((u, i) => {
      console.log(
        `   ${i + 1}. ${u.username} (${u.discordId}): ${maskEmail(u.email)}`,
      );
    });

    if (dryRun) {
      console.log(
        `\n🔍 DRY RUN - No changes made. Run with --commit to apply.`,
      );
      console.log(`   This would encrypt ${plaintextCount} emails.`);
    } else {
      console.log(`\n🔐 Migrating ${plaintextCount} emails...\n`);

      let migrated = 0;
      let failed = 0;

      for (const user of usersWithPlaintextEmails) {
        try {
          const normalizedEmail = user.email.toLowerCase().trim();
          const encryptedEmail = encryptToken(normalizedEmail);
          const emailHash = hashEmail(normalizedEmail);

          await usersCollection.updateOne(
            { discordId: user.discordId },
            {
              $set: {
                email: encryptedEmail,
                emailHash: emailHash,
                updatedAt: new Date().toISOString(),
              },
            },
          );

          migrated++;
          console.log(`   ✅ Migrated: ${user.username} (${user.discordId})`);
        } catch (_error) {
          failed++;
          console.log(
            `   ❌ Failed: ${user.username} (${user.discordId}) - Migration failed`,
          );
        }
      }

      console.log(`\n📊 Migration Complete:`);
      console.log(`   ✅ Migrated: ${migrated}`);
      console.log(`   ❌ Failed: ${failed}`);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
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

const args = process.argv.slice(2);
const dryRun = !args.includes("--commit");

console.log("\n🔐 Email Encryption Migration Script");
console.log("=======================================\n");

if (dryRun) {
  console.log("🔍 Running in DRY RUN mode (add --commit to apply changes)\n");
} else {
  console.log(
    "⚠️  WARNING: Running in COMMIT mode - this will modify the database!\n",
  );
}

migrateEmails(dryRun);
