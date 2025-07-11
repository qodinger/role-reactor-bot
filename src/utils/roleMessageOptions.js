import { SlashCommandStringOption } from "discord.js";

export const titleOption = () =>
  new SlashCommandStringOption()
    .setName("title")
    .setDescription("Title for the role message (e.g., 'Server Roles')")
    .setRequired(false)
    .setMaxLength(256);

export const descriptionOption = () =>
  new SlashCommandStringOption()
    .setName("description")
    .setDescription("Description for the role message")
    .setRequired(false)
    .setMaxLength(2000);

export const rolesOption = (required = true) =>
  new SlashCommandStringOption()
    .setName("roles")
    .setDescription(
      "Role-emoji pairs (format: emoji:role, one per line or comma-separated)",
    )
    .setRequired(required)
    .setMaxLength(4000);

export const colorOption = () =>
  new SlashCommandStringOption()
    .setName("color")
    .setDescription(
      "Embed color (hex code, e.g., #0099ff) or select from choices",
    )
    .setRequired(false)
    .setMaxLength(7)
    .addChoices(
      { name: "Blue", value: "#0099ff" },
      { name: "Green", value: "#00ff00" },
      { name: "Red", value: "#ff0000" },
      { name: "Yellow", value: "#ffff00" },
      { name: "Purple", value: "#a259ff" },
      { name: "Orange", value: "#ff9900" },
      { name: "Gray", value: "#95a5a6" },
    );
