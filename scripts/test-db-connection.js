import dotenv from "dotenv";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
dotenv.config({ path: envFile });

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("❌ MONGODB_URI not found in environment variables");
  process.exit(1);
}

console.log("🔌 Testing MongoDB connection...");

const client = new MongoClient(uri);

try {
  await client.connect();

  // Test with ping
  const adminDb = client.db().admin();
  await adminDb.command({ ping: 1 });

  console.log("✅ MongoDB connection successful!");

  // Get server info
  const serverStatus = await adminDb.command({ serverStatus: 1 });
  console.log(`📊 Database: ${serverStatus.host}`);
  console.log(`📦 Version: ${serverStatus.version}`);
} catch (error) {
  console.error("❌ MongoDB connection failed:");
  console.error(`   ${error.message}`);
  process.exit(1);
} finally {
  await client.close();
  console.log("🔌 Connection closed");
}
