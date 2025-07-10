import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";
import process from "process";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Deployment banner
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║                RoleReactor Bot - Command Deployer            ║");
console.log(
  "║                    Role Management System                     ║"
);
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("");

// Validate environment variables
const requiredEnvVars = ["DISCORD_TOKEN", "CLIENT_ID"];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach(varName => {
    console.error(`   • ${varName}`);
  });
  console.error(
    "\nPlease check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

// Command collection with validation
async function collectCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, "src", "commands");

  if (!fs.existsSync(commandsPath)) {
    console.error("❌ Commands directory not found");
    return commands;
  }

  const commandFolders = fs.readdirSync(commandsPath);
  let totalCommands = 0;

  console.log(
    `📁 Collecting commands from ${commandFolders.length} category(ies)...`
  );

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);

    if (!fs.statSync(folderPath).isDirectory()) {
      console.warn(`   ⚠️  Skipping non-directory: ${folder}`);
      continue;
    }

    const commandFiles = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"));

    console.log(
      `   📂 Category: ${folder} (${commandFiles.length} command(s))`
    );

    for (const file of commandFiles) {
      try {
        const filePath = path.join(folderPath, file);
        const command =
          (await import(filePath)).default || (await import(filePath));

        if (!command.data) {
          console.warn(`      ⚠️  Command ${file} missing 'data' property`);
          continue;
        }

        if (!command.execute) {
          console.warn(`      ⚠️  Command ${file} missing 'execute' property`);
          continue;
        }

        // Validate command structure
        if (!command.data.name) {
          console.warn(`      ⚠️  Command ${file} missing name`);
          continue;
        }

        if (!command.data.description) {
          console.warn(
            `      ⚠️  Command ${command.data.name} missing description`
          );
          continue;
        }

        commands.push(command.data.toJSON());
        console.log(`      ✅ Collected command: ${command.data.name}`);
        totalCommands++;
      } catch (error) {
        console.error(
          `      ❌ Failed to load command ${file}:`,
          error.message
        );
      }
    }
  }

  console.log(`📊 Total commands collected: ${totalCommands}`);
  return commands;
}

// Deployment function
async function deployCommands() {
  try {
    console.log("🚀 Starting command deployment...");
    console.log("");

    // Collect commands
    const commands = await collectCommands();

    if (commands.length === 0) {
      console.error("❌ No valid commands found to deploy");
      process.exit(1);
    }

    console.log("");
    console.log("🔐 Initializing REST client...");

    // Initialize REST client
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN
    );

    // Determine deployment scope
    const guildId = process.env.GUILD_ID;
    const deploymentType = guildId ? "Guild" : "Global";

    console.log(`📡 Deployment Type: ${deploymentType}`);
    if (guildId) {
      console.log(`🎯 Target Guild: ${guildId}`);
    }

    console.log("");
    console.log("📤 Deploying commands to Discord...");

    // Deploy commands
    const data = await rest.put(
      guildId
        ? Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
        : Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("");
    console.log("✅ Command deployment completed successfully!");
    console.log(`📊 Deployed ${data.length} command(s):`);

    data.forEach((command, index) => {
      console.log(`   ${index + 1}. /${command.name} - ${command.description}`);
    });

    console.log("");
    console.log("⏰ Note: Global commands may take up to 1 hour to appear.");
    console.log("   Guild commands appear immediately.");
    console.log("");

    if (!guildId) {
      console.log(
        "💡 Tip: For faster development, set GUILD_ID in your .env file"
      );
      console.log("   to deploy commands to a specific guild only.");
    }

    console.log("");
  } catch (error) {
    console.error("❌ Command deployment failed:");
    console.error("   Error:", error.message);

    if (error.code === 50001) {
      console.error("   Missing Access - Check bot permissions");
    } else if (error.code === 50013) {
      console.error(
        "   Missing Permissions - Bot needs application.commands scope"
      );
    } else if (error.code === 40001) {
      console.error("   Unauthorized - Check your bot token");
    } else if (error.code === 10062) {
      console.error("   Unknown Interaction - Try again in a few seconds");
    }

    console.error("");
    console.error("🔧 Troubleshooting:");
    console.error("   • Verify your bot token is correct");
    console.error('   • Ensure the bot has the "applications.commands" scope');
    console.error("   • Check that CLIENT_ID matches your application");
    console.error("   • For guild deployment, verify GUILD_ID is correct");

    process.exit(1);
  }
}

// Error handling
process.on("unhandledRejection", error => {
  console.error("❌ Unhandled promise rejection:");
  console.error("   Error:", error.message);
  process.exit(1);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught exception:");
  console.error("   Error:", error.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Deployment interrupted");
  process.exit(0);
});

// Start deployment
await deployCommands();
