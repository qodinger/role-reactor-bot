import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("invite")
  .setDescription(`Get the bot's invite link for your server`);

export { execute };
