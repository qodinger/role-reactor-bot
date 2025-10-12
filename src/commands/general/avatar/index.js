import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Generate a unique anime-style avatar using AI")
  .addStringOption(option =>
    option
      .setName("prompt")
      .setDescription(
        "Describe the avatar (e.g., 'cool boy with spiky hair', 'cute girl in red dress')",
      )
      .setRequired(true)
      .setMaxLength(500),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export { execute };
