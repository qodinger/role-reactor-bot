import dotenv from "dotenv";
dotenv.config({ path: ".env.production" });
import { MongoClient } from "mongodb";

async function analyze() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("Connected to MongoDB.");

    const db = client.db(process.env.MONGODB_DB || "role-reactor-bot");
    const roleMappings = db.collection("role_mappings");

    // Aggregate by guildId
    const aggregation = await roleMappings
      .aggregate([
        {
          $group: {
            _id: "$guildId",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    const totalMessages = aggregation.reduce(
      (acc, curr) => acc + curr.count,
      0,
    );
    const totalServers = aggregation.length;

    console.log("\n--- ROLE REACTION ANALYSIS ---");
    console.log(`Total active Role Reaction menus: ${totalMessages}`);
    console.log(`Total servers using the feature: ${totalServers}`);
    console.log("--------------------------------");
    console.log("Top 10 Servers by Menu Count:");

    aggregation.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. Server ID: ${item._id} - ${item.count} Menus`);
    });

    console.log("\nDistribution:");
    const distribution = {};
    aggregation.forEach(item => {
      const c = item.count;
      distribution[c] = (distribution[c] || 0) + 1;
    });

    for (const [menuCount, serverCount] of Object.entries(distribution).sort(
      (a, b) => parseInt(a[0]) - parseInt(b[0]),
    )) {
      console.log(
        `- ${serverCount} server(s) have exactly ${menuCount} role reaction menu(s)`,
      );
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
    console.log("\nDisconnected.");
    process.exit(0);
  }
}

analyze();
