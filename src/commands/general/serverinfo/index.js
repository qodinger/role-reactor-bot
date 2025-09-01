import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription(`Get information about this server`);

export { execute };
