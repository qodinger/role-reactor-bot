import { REST, Routes } from "discord.js";
import config from "../src/config/config.js";
import {
  createSuccessMessage,
  createErrorMessage,
  createSpinner,
  colors,
} from "../src/utils/terminal.js";

const rest = new REST({ version: "10" }).setToken(config.discord.token);

async function deleteAllCommands() {
  try {
    console.log(colors.info("🗑️  Starting command deletion process..."));

    // Determine what to delete based on arguments
    const deleteGlobal = process.argv.includes("--global");
    const deleteGuild = process.argv.includes("--guild") || !deleteGlobal;

    if (deleteGlobal) {
      const globalSpinner = createSpinner("Removing global commands...");
      globalSpinner.start();

      try {
        await rest.put(Routes.applicationCommands(config.discord.clientId), {
          body: [],
        });
        globalSpinner.succeed(
          colors.success("✅ All global commands removed."),
        );
      } catch (error) {
        globalSpinner.fail(colors.error("❌ Failed to remove global commands"));
        if (error.code === 429) {
          console.error(
            colors.warning(
              "⚠️  Rate limited - wait a few minutes and try again",
            ),
          );
        } else if (error.code === 50001) {
          console.error(colors.error("❌ Missing access to application"));
        } else {
          console.error(colors.error(`❌ Error: ${error.message}`));
        }
        throw error;
      }
    }

    if (deleteGuild && config.discord.guildId) {
      const guildSpinner = createSpinner(
        `Removing guild commands for ${config.discord.guildId}...`,
      );
      guildSpinner.start();

      try {
        await rest.put(
          Routes.applicationGuildCommands(
            config.discord.clientId,
            config.discord.guildId,
          ),
          { body: [] },
        );
        guildSpinner.succeed(
          colors.success(
            `✅ All guild commands removed for guild ${config.discord.guildId}.`,
          ),
        );
      } catch (error) {
        guildSpinner.fail(colors.error("❌ Failed to remove guild commands"));
        if (error.code === 429) {
          console.error(
            colors.warning(
              "⚠️  Rate limited - wait a few minutes and try again",
            ),
          );
        } else if (error.code === 50001) {
          console.error(colors.error("❌ Missing access to application"));
        } else if (error.code === 50013) {
          console.error(colors.error("❌ Missing permissions"));
        } else {
          console.error(colors.error(`❌ Error: ${error.message}`));
        }
        throw error;
      }
    }

    // Show summary
    console.log(colors.info("📊 Deletion Summary:"));
    if (deleteGlobal) {
      console.log(colors.info("   🌍 Global commands: Removed"));
    }
    if (deleteGuild && config.discord.guildId) {
      console.log(
        colors.info(
          `   🏠 Guild commands: Removed from ${config.discord.guildId}`,
        ),
      );
    }

    console.log(colors.info("💡 Note: You can now redeploy commands cleanly."));
  } catch (error) {
    console.error(
      createErrorMessage(`Command deletion failed: ${error.message}`),
    );
    console.error(colors.info("💡 Troubleshooting:"));
    console.error(colors.info("   • Verify your bot token is correct"));
    console.error(colors.info("   • Ensure the bot has proper permissions"));
    console.error(
      colors.info("   • Check that CLIENT_ID matches your application"),
    );
    console.error(
      colors.info("   • If rate limited, wait a few minutes and try again"),
    );
    throw error;
  }
}

deleteAllCommands()
  .then(() => {
    console.log(
      createSuccessMessage(
        "All commands removed. You can now redeploy cleanly.",
      ),
    );
    process.exit(0);
  })
  .catch(err => {
    console.error(
      createErrorMessage(`Error removing commands: ${err.message}`),
    );
    process.exit(1);
  });
