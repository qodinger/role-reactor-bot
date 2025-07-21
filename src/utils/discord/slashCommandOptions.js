import { SlashCommandStringOption } from "discord.js";

/**
 * Creates a slash command option for the message title.
 * @returns {SlashCommandStringOption} The title option.
 */
export function titleOption() {
  return new SlashCommandStringOption()
    .setName("title")
    .setDescription("Title for the role message (e.g., 'Server Roles')")
    .setRequired(false)
    .setMaxLength(256);
}

/**
 * Creates a slash command option for the message description.
 * @returns {SlashCommandStringOption} The description option.
 */
export function descriptionOption() {
  return new SlashCommandStringOption()
    .setName("description")
    .setDescription("Description for the role message")
    .setRequired(false)
    .setMaxLength(2000);
}

/**
 * Creates a slash command option for the roles.
 * @param {boolean} [required=true] Whether the option is required.
 * @returns {SlashCommandStringOption} The roles option.
 */
export function rolesOption(required = true) {
  return new SlashCommandStringOption()
    .setName("roles")
    .setDescription(
      "Role-emoji pairs (format: emoji:role, one per line or comma-separated)",
    )
    .setRequired(required)
    .setMaxLength(4000);
}

/**
 * Creates a slash command option for the message color.
 * @returns {SlashCommandStringOption} The color option.
 */
export function colorOption() {
  return new SlashCommandStringOption()
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
}
