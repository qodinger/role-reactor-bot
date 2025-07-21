/**
 * Creates the message options for a role selection message.
 * @param {Array<object>} roles The roles to include in the message.
 * @param {string} [title="Role Selection"] The title of the message.
 * @param {string} [description="React to get roles"] The description of the message.
 * @returns {object} The message options.
 */
export function createMessageOptions(
  roles,
  title = "Role Selection",
  description = "React to get roles",
) {
  if (!roles) {
    throw new Error("Roles parameter is required");
  }
  const content = generateMessageContent(title, description, roles);
  const components = createActionRows(createRoleButtons(roles));

  return {
    content,
    components,
  };
}

/**
 * Generates the content for a role selection message.
 * @param {string} title The title of the message.
 * @param {string} description The description of the message.
 * @param {Array<object>} roles The roles to include in the message.
 * @returns {string} The message content.
 */
function generateMessageContent(title, description, roles) {
  return `**${title}**\n\n${description}\n\n${formatRoleList(roles)}`;
}

/**
 * Formats a list of roles for display.
 * @param {Array<object>} roles The roles to format.
 * @returns {string} The formatted list of roles.
 */
function formatRoleList(roles) {
  if (!roles || roles.length === 0) {
    return "No roles available";
  }
  return roles.map(role => `• ${role.name}`).join("\n");
}

/**
 * Creates the role buttons for a role selection message.
 * @param {Array<object>} roles The roles to create buttons for.
 * @returns {Array<object>} The role buttons.
 */
function createRoleButtons(roles) {
  if (!roles || roles.length === 0) return [];
  return roles.slice(0, 25).map(role => createRoleButton(role));
}

/**
 * Creates the action rows for a role selection message.
 * @param {Array<object>} buttons The buttons to include in the action rows.
 * @returns {Array<object>} The action rows.
 */
function createActionRows(buttons) {
  if (!buttons || buttons.length === 0) return [];
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push({
      type: 1,
      components: buttons.slice(i, i + 5),
    });
  }
  return rows;
}

/**
 * Creates an individual role button.
 * @param {object} role The role to create a button for.
 * @param {string} [style="secondary"] The style of the button.
 * @returns {object} The role button.
 */
function createRoleButton(role, style = "secondary") {
  if (!role || !role.id) {
    throw new Error("Invalid role data: missing id");
  }
  return {
    type: 2,
    style: getButtonStyle(style),
    label: role.name || "Unknown Role",
    customId: `role_${role.id}`,
  };
}

/**
 * Gets the style for a button.
 * @param {string} style The style name.
 * @returns {number} The button style code.
 */
function getButtonStyle(style) {
  const styles = {
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4,
    link: 5,
  };
  return styles[style] || 2;
}
