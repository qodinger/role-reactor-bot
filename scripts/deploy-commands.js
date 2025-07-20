import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import config from "../src/config/config.js";
import {
  createErrorMessage,
  createInfoBox,
  createSpinner,
  colors,
  icons,
} from "../src/utils/terminal.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables
if (!config.validate()) {
  console.error(createErrorMessage("Configuration validation failed"));
  console.error(
    createInfoBox(
      "Check your .env file",
      ["Please ensure all required variables are set."],
      { borderColor: "red" },
    ),
  );
  process.exit(1);
}

// Function to update help command choices after deployment
async function updateHelpCommandChoices() {
  try {
    console.log(
      `${icons.info} ${colors.cyan("Updating help command choices...")}`,
    );

    // Load all commands to create choices
    const commands = [];
    const commandsPath = path.join(__dirname, "../src/commands");
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const commandFiles = fs
        .readdirSync(folderPath)
        .filter(file => file.endsWith(".js"));

      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          const command = (await import(filePath)).default;

          if (
            command &&
            command.data &&
            command.data.name &&
            command.data.name !== "help"
          ) {
            commands.push(command);
          }
        } catch (error) {
          console.warn(
            colors.warning(`⚠️  Skipping command ${file}: ${error.message}`),
          );
        }
      }
    }

    // Generate choices
    const choices = commands
      .filter(cmd => cmd.data.description)
      .sort((a, b) => a.data.name.localeCompare(b.data.name))
      .map(cmd => {
        const commandName = cmd.data.name;
        const displayName = commandName
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        return {
          name: displayName,
          value: commandName,
        };
      });

    console.log(
      colors.success(`✅ Generated ${choices.length} help command choices`),
    );

    // Update the help command file
    const helpCommandPath = path.join(
      __dirname,
      "../src/commands/general/help.js",
    );
    let helpContent = fs.readFileSync(helpCommandPath, "utf8");

    // Check if help command uses autocomplete or choices
    const hasAutocomplete = helpContent.includes(".setAutocomplete(true)");
    const hasChoices = helpContent.includes(".addChoices(");

    if (hasAutocomplete) {
      console.log(
        colors.info(
          `ℹ️  Help command uses autocomplete - no need to update choices`,
        ),
      );
      console.log(
        colors.info(
          `   Autocomplete will dynamically generate suggestions from available commands`,
        ),
      );
    } else if (hasChoices) {
      // Find and replace the choices in the help command
      const choicesRegex = /\.addChoices\([\s\S]*?\)/;
      const newChoices = `.addChoices(\n${choices
        .map(
          choice =>
            `      { name: "${choice.name}", value: "${choice.value}" }`,
        )
        .join(",\n")}\n    )`;

      if (choicesRegex.test(helpContent)) {
        helpContent = helpContent.replace(choicesRegex, newChoices);
        fs.writeFileSync(helpCommandPath, helpContent, "utf8");
        console.log(
          colors.success(
            `✅ Updated help command with ${choices.length} dynamic choices`,
          ),
        );
      } else {
        console.log(
          colors.warning(`⚠️  Could not find choices section in help command`),
        );
      }
    } else {
      console.log(
        colors.warning(
          `⚠️  Help command has no autocomplete or choices - using autocomplete is recommended`,
        ),
      );
    }
  } catch (error) {
    console.error(
      createErrorMessage(
        `Failed to update help command choices: ${error.message}`,
      ),
    );
  }
}

// Validate command structure according to Discord requirements
function validateCommandStructure(command, _fileName) {
  const errors = [];

  // Check required properties
  if (!command.data) {
    errors.push("Missing 'data' property");
  }

  if (!command.execute) {
    errors.push("Missing 'execute' property");
  }

  if (!command.data?.name) {
    errors.push("Missing command name");
  }

  if (!command.data?.description) {
    errors.push("Missing command description");
  }

  // Check command name format (Discord requirements)
  if (command.data?.name && !/^[a-z0-9-]+$/.test(command.data.name)) {
    errors.push("Command name must be lowercase, numbers, and hyphens only");
  }

  // Check description length (Discord limit: 100 characters)
  if (command.data?.description && command.data.description.length > 100) {
    errors.push("Command description must be 100 characters or less");
  }

  // Check for potentially problematic command names (only warn, don't block)
  const problematicNames = ["ping", "test", "debug"];
  if (command.data?.name && problematicNames.includes(command.data.name)) {
    console.warn(
      colors.warning(
        `      ⚠️  Command name '${command.data.name}' might conflict with common commands`,
      ),
    );
    // Don't add to errors - just warn
  }

  return errors;
}

// Command collection with validation
async function collectCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, "../src/commands");
  console.log(colors.info(`Looking for commands in: ${commandsPath}`));

  if (!fs.existsSync(commandsPath)) {
    console.error(createErrorMessage("Commands directory not found"));
    return commands;
  }

  const commandFolders = fs.readdirSync(commandsPath);
  let totalCommands = 0;

  console.log(
    `${icons.folder || "📁"} ${colors.cyan(`Found ${commandFolders.length} category(ies).`)}`,
  );

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);

    if (!fs.statSync(folderPath).isDirectory()) {
      console.warn(colors.warning(`   ⚠️  Skipping non-directory: ${folder}`));
      continue;
    }

    const commandFiles = fs
      .readdirSync(folderPath)
      .filter(file => file.endsWith(".js"));

    console.log(
      `${icons.folder || "📂"} ${colors.cyan(`${commandFiles.length} command(s) in category: ${folder}`)}`,
    );

    for (const file of commandFiles) {
      try {
        const filePath = path.join(folderPath, file);
        const command =
          (await import(filePath)).default || (await import(filePath));

        // Include developer commands only in development
        const isDeveloperCommand = folder === "developer";
        const isProduction = process.env.NODE_ENV === "production";

        if (isDeveloperCommand && isProduction) {
          console.log(
            colors.info(
              `      ⏭️  Skipping developer command: ${command.data.name} (production mode)`,
            ),
          );
          continue;
        }

        if (isDeveloperCommand && !isProduction) {
          console.log(
            colors.info(
              `      🔒 Including developer command: ${command.data.name} (development mode)`,
            ),
          );
        }

        // Validate command structure using the validation function
        const validationErrors = validateCommandStructure(command, file);
        if (validationErrors.length > 0) {
          console.warn(
            colors.warning(`      ⚠️  Command ${file} validation failed:`),
          );
          validationErrors.forEach(error => {
            console.warn(colors.warning(`         - ${error}`));
          });
          continue;
        }

        // Check for duplicate command names
        if (commands.some(cmd => cmd.name === command.data.name)) {
          console.warn(
            colors.warning(
              `      ⚠️  Duplicate command name: ${command.data.name}`,
            ),
          );
          continue;
        }

        commands.push(command.data.toJSON());
        console.log(
          colors.success(`      ✅ Collected command: ${command.data.name}`),
        );
        totalCommands++;
      } catch (error) {
        console.error(
          createErrorMessage(
            `      ❌ Failed to load command ${file}: ${error.message}`,
          ),
        );
      }
    }
  }

  console.log(colors.magenta(`📊 Total commands collected: ${totalCommands}`));
  return commands;
}

// Deployment function
async function deployCommands() {
  try {
    console.log(
      `${icons.rocket} ${colors.green("Starting command deployment...")}`,
    );

    // Collect all commands
    const commands = await collectCommands();
    console.log(
      colors.green(`📊 Total commands collected: ${commands.length}`),
    );

    // Initialize REST client
    const rest = new REST({ version: "10" }).setToken(config.discord.token);

    // Determine deployment type
    const isGlobal = process.argv.includes("--global");
    const isProduction = process.env.NODE_ENV === "production";
    const deploymentType = isGlobal ? "Global" : "Guild";
    console.log(
      `${icons.info} Deployment Type: ${colors.cyan(deploymentType)}`,
    );
    if (isGlobal) {
      console.log(`${icons.server} Global`);
    } else {
      console.log(`${icons.server} Guild: ${config.discord.guildId}`);
    }

    if (isProduction) {
      console.log(`${icons.info} Production mode: Developer commands excluded`);
    } else {
      console.log(
        `${icons.info} Development mode: Developer commands included`,
      );
    }

    // Deploy commands (overwrites existing ones, no need to clear first)
    // This approach avoids Discord's rate limits by not making separate delete requests
    const deploySpinner = createSpinner("Deploying commands...");
    deploySpinner.start();

    try {
      // Use PUT to replace all commands at once (Discord best practice)
      if (isGlobal) {
        await rest.put(Routes.applicationCommands(config.discord.clientId), {
          body: commands,
        });
      } else {
        await rest.put(
          Routes.applicationGuildCommands(
            config.discord.clientId,
            config.discord.guildId,
          ),
          {
            body: commands,
          },
        );
      }
      deploySpinner.succeed(
        colors.success("Command deployment completed successfully!"),
      );
    } catch (error) {
      deploySpinner.fail(colors.error("Command deployment failed"));

      // Handle specific Discord API errors
      if (error.code === 50035) {
        console.error(
          createErrorMessage("Invalid application commands format"),
        );
      } else if (error.code === 50001) {
        console.error(createErrorMessage("Missing access to application"));
      } else if (error.code === 50013) {
        console.error(createErrorMessage("Missing permissions"));
      } else if (error.code === 429) {
        console.error(
          createErrorMessage("Rate limited - wait a few minutes and try again"),
        );
      }

      throw error;
    }
    console.log(
      createInfoBox(
        "Deployment Summary",
        [
          `${icons.success} Deployed ${commands.length} command(s)`,
          `${icons.info} Deployment Type: ${deploymentType}`,
          isGlobal
            ? `${icons.server} Global`
            : `${icons.server} Guild: ${config.discord.guildId}`,
          `${icons.time} ${new Date().toLocaleString()}`,
        ],
        { borderColor: "green" },
      ),
    );

    commands.forEach((command, index) => {
      console.log(
        colors.success(
          `   ${index + 1}. /${command.name} - ${command.description}`,
        ),
      );
    });

    console.log(
      colors.info("🕒 Note: Global commands may take up to 1 hour to appear."),
    );
    console.log(colors.info("   Guild commands appear immediately."));
    console.log(
      colors.info(
        "   Commands are automatically overwritten (no need to delete old ones).",
      ),
    );

    // Best practices reminder
    console.log(colors.info("💡 Best Practices:"));
    console.log(colors.info("   • Use guild commands for development/testing"));
    console.log(colors.info("   • Use global commands for production"));
    console.log(colors.info("   • Keep command names lowercase with hyphens"));
    console.log(
      colors.info("   • Provide clear descriptions for all commands"),
    );
    console.log("");

    // Update help command choices after successful deployment
    await updateHelpCommandChoices();
  } catch (error) {
    console.error(
      createErrorMessage(`Command deployment failed: ${error.message}`),
    );
    console.error(
      createInfoBox(
        "Troubleshooting",
        [
          "Verify your bot token is correct",
          'Ensure the bot has the "applications.commands" scope',
          "Check that CLIENT_ID matches your application",
          "For guild deployment, verify GUILD_ID is correct",
          "If you get rate limited, wait a few minutes and try again",
        ],
        { borderColor: "red" },
      ),
    );
    process.exit(1);
  }
}

// Error handling
process.on("unhandledRejection", error => {
  console.error(
    createErrorMessage(`Unhandled promise rejection: ${error.message}`),
  );
  process.exit(1);
});

process.on("uncaughtException", error => {
  console.error(createErrorMessage(`Uncaught exception: ${error.message}`));
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(colors.warning("\n🛑 Deployment interrupted"));
  process.exit(0);
});

// Start deployment
await deployCommands();
