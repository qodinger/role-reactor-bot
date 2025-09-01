import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("level")
  .setDescription(`Check your level and experience`)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to check (defaults to you)")
      .setRequired(false),
  );

// Award XP before executing so the latest XP is reflected in the embed
export const preAwardXP = true;

export { execute };
