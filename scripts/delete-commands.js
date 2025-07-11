import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import {
  createSuccessMessage,
  createErrorMessage,
  createSpinner,
  colors,
} from "../src/utils/terminal.js";

dotenv.config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function deleteAllCommands() {
  const spinner = createSpinner("Removing global commands...");
  spinner.start();

  // Remove global commands
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: [],
  });
  spinner.succeed(colors.success("All global commands removed."));

  // Remove guild commands (if you use GUILD_ID)
  if (process.env.GUILD_ID) {
    const guildSpinner = createSpinner(
      `Removing guild commands for ${process.env.GUILD_ID}...`,
    );
    guildSpinner.start();
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ),
      { body: [] },
    );
    guildSpinner.succeed(
      colors.success(
        `All guild commands removed for guild ${process.env.GUILD_ID}.`,
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
