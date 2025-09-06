import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription(`Get a user's avatar with interactive features`)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user whose avatar you want to see (defaults to you)")
      .setRequired(false),
  );

export { execute };
