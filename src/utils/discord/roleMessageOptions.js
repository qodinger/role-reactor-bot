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

// Create message options for role selection
const createMessageOptions = (
  roles,
  title = "Role Selection",
  description = "React to get roles",
) => {
  if (!roles) {
    throw new Error("Roles parameter is required");
  }
  const content = generateMessageContent(title, description);
  const buttons = createRoleButtons(roles);
  const components = createActionRows(buttons);

  return {
    content,
    components,
  };
};

// Generate message content
const generateMessageContent = (
  title = "Role Selection",
  description = "React to get roles",
) => {
  return `**${title}**\n\n${description}\n\n${formatRoleList([])}`;
};

// Format role list
const formatRoleList = roles => {
  if (!roles || roles.length === 0) {
    return "No roles available";
  }
  return roles.map(role => `• ${role.name}`).join("\n");
};

// Create role buttons
const createRoleButtons = roles => {
  if (!roles || roles.length === 0) return [];
  return roles.slice(0, 25).map(role => createRoleButton(role));
};

// Create action rows
const createActionRows = buttons => {
  if (!buttons || buttons.length === 0) return [];
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push({
      type: 1,
      components: buttons.slice(i, i + 5),
    });
  }
  return rows;
};

// Create individual role button
const createRoleButton = (role, style = "secondary") => {
  if (!role || !role.id) {
    throw new Error("Invalid role data: missing id");
  }
  return {
    type: 2,
    style: getButtonStyle(style),
    label: role.name || "Unknown Role",
    customId: `role_${role.id}`,
  };
};

// Get button style
const getButtonStyle = style => {
  const styles = {
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4,
    link: 5,
  };
  return styles[style] || 2; // Default to secondary
};

export {
  createMessageOptions,
  generateMessageContent,
  formatRoleList,
  createRoleButtons,
  createActionRows,
  createRoleButton,
  getButtonStyle,
};
