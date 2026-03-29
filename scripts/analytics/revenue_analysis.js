import dotenv from "dotenv";
dotenv.config({ path: ".env.production" });
import { MongoClient } from "mongodb";

async function analyze() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in .env.production");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("Connected to MongoDB.");

    const db = client.db(process.env.MONGODB_DB || "role-reactor-bot");
    const payments = db.collection("payments");

    console.log("\n--- REVENUE ANALYSIS ---");

    // Count total payments
    const totalPayments = await payments.countDocuments();
    console.log(`Total payments in DB: ${totalPayments}`);

    const completedPayments = await payments.countDocuments({
      status: "completed",
    });
    console.log(`Completed payments in DB: ${completedPayments}`);

    // Get a sample payment
    const samplePayment = await payments.findOne({ status: "completed" });
    console.log("\nSample completed payment:");
    console.dir(samplePayment, { depth: null });

    // Try global stats aggregation manually
    const pipeline = [
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalRevenue: { $sum: "$amount" },
          totalCores: { $sum: "$coresGranted" },
          uniqueUsers: { $addToSet: "$discordId" },
        },
      },
      {
        $project: {
          _id: 0,
          totalPayments: 1,
          totalRevenue: 1,
          totalCores: 1,
          uniqueUsers: { $size: "$uniqueUsers" },
        },
      },
    ];
    const results = await payments.aggregate(pipeline).toArray();
    console.log("\nGlobal Stats Aggregation Result:");
    console.dir(results);

    // Sum type of 'amount' fields
    const typePipeline = [
      { $match: { status: "completed" } },
      {
        $group: {
          _id: { $type: "$amount" },
          count: { $sum: 1 },
        },
      },
    ];
    const typeResults = await payments.aggregate(typePipeline).toArray();
    console.log("\nType of 'amount' field in completed payments:");
    console.dir(typeResults);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
    console.log("\nDisconnected.");
    process.exit(0);
  }
}

analyze();
