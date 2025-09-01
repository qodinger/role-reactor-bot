import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("sponsor")
  .setDescription(`Get information about sponsoring the bot`);

export { execute };
