import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("8ball")
  .setDescription(`Ask the magic 8-ball a question`)
  .addStringOption(option =>
    option
      .setName("question")
      .setDescription("Your question for the magic 8-ball")
      .setRequired(true),
  );

export { execute };
