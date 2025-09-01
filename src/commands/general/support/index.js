import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("support")
  .setDescription(`Get support and help information`);

export { execute };
