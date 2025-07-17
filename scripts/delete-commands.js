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
  const spinner = createSpinner("Removing global commands...");
  spinner.start();

  // Remove global commands
  await rest.put(Routes.applicationCommands(config.discord.clientId), {
    body: [],
  });
  spinner.succeed(colors.success("All global commands removed."));

  // Remove guild commands (if you use GUILD_ID)
  if (config.discord.guildId) {
    const guildSpinner = createSpinner(
      `Removing guild commands for ${config.discord.guildId}...`,
    );
    guildSpinner.start();
    await rest.put(
      Routes.applicationGuildCommands(
        config.discord.clientId,
        config.discord.guildId,
      ),
      { body: [] },
    );
    guildSpinner.succeed(
      colors.success(
        `All guild commands removed for guild ${config.discord.guildId}.`,
      ),
    );
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
