import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("rps")
  .setDescription("Play Rock Paper Scissors")
  .addSubcommand(subcommand =>
    subcommand
      .setName("play")
      .setDescription("Play against the bot")
      .addStringOption(option =>
        option
          .setName("choice")
          .setDescription("Your choice")
          .setRequired(true)
          .addChoices(
            { name: "Rock", value: "rock" },
            { name: "Paper", value: "paper" },
            { name: "Scissors", value: "scissors" },
          ),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("challenge")
      .setDescription("Challenge another user to Rock Paper Scissors")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("User to challenge")
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
      ),
  );

export { execute };
