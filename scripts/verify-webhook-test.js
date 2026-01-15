import { config } from "dotenv";
config({ path: ".env.development" });
import { getDatabaseManager } from "../src/utils/storage/databaseManager.js";

async function check() {
  console.log("Connecting to database...");
  const db = await getDatabaseManager();
  if (!db) {
    console.log("❌ Failed to connect to DB");
    process.exit(1);
  }

  const paymentId = "TEST-ORDER-789012";
  const userId = "639696408592777227";

  console.log(`Checking for payment ID: ${paymentId}`);
  const payment = await db.payments.findByPaymentId(paymentId);

  if (payment) {
    console.log("✅ Payment Record FOUND:");
    console.log(JSON.stringify(payment, null, 2));
  } else {
    console.log("❌ Payment Record NOT FOUND");
    console.log(
      "Note: This is expected if the bot hasn't processed the webhook yet or if signature verification failed.",
    );
  }

  console.log(`Checking credits for user: ${userId}`);
  try {
    const credits = await db.coreCredits.getByUserId(userId);
    console.log(
      "User Data:",
      credits ? JSON.stringify(credits, null, 2) : "No credit record found",
    );
  } catch (e) {
    console.log("Error checking credits:", e.message);
  }

  process.exit(0);
}

check();
