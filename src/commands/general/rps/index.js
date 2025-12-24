import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("rps")
  .setDescription("Challenge someone to Rock Paper Scissors")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("User to challenge (can be a bot or another user)")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("choice")
      .setDescription("Your choice (hidden from opponent)")
      .setRequired(true)
      .addChoices(
        { name: "Rock", value: "rock" },
        { name: "Paper", value: "paper" },
        { name: "Scissors", value: "scissors" },
      ),
  );

export { execute };
