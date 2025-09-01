import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription(`Check the bot's latency and connection status`);

export { execute };
