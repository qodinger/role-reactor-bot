import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("wyr")
  .setDescription("Get a random 'Would You Rather' question")
  .addStringOption(option =>
    option
      .setName("category")
      .setDescription("Choose a specific category for the question")
      .setRequired(false)
      .addChoices(
        { name: "Funny", value: "FUNNY" },
        { name: "Superhero", value: "SUPERHERO" },
        { name: "Life Choices", value: "LIFE_CHOICES" },
        { name: "Philosophical", value: "PHILOSOPHICAL" },
        { name: "Challenging", value: "CHALLENGING" },
        { name: "Pop Culture", value: "POP_CULTURE" },
      ),
  );

export { execute };
