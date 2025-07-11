import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function deleteAllCommands() {
  // Remove global commands
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: [],
  });
  console.log("✅ All global commands removed.");

  // Remove guild commands (if you use GUILD_ID)
  if (process.env.GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ),
      { body: [] },
    );
    console.log(
      `✅ All guild commands removed for guild ${process.env.GUILD_ID}.`,
    );
  }
}

deleteAllCommands()
  .then(() => {
    console.log("All commands removed. You can now redeploy cleanly.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error removing commands:", err);
    process.exit(1);
  });
