import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("sponsor")
  .setDescription(`Get information about supporting the bot's development`);

export { execute };
