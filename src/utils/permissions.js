import { PermissionFlagsBits } from "discord.js";
import config from "../config/config.js";
import { COMMAND_CATEGORIES } from "../commands/general/help/helpData.js";

// Check if user is a developer
const isDeveloper = userId => {
  const developers = config.discord.developers;
  if (!developers || developers.length === 0) return false;

  return developers.includes(userId);
};

// Check if user has admin permissions
const hasAdminPermissions = member => {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageRoles) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
};

// Check if user has bot management permissions (developer)
const hasBotManagementPermissions = userId => {
  return isDeveloper(userId);
};

// Check if user has manage roles permission
const hasManageRolesPermission = member => {
  return member.permissions.has(PermissionFlagsBits.ManageRoles);
};

// Check if user has manage messages permission
const hasManageMessagesPermission = member => {
  return member.permissions.has(PermissionFlagsBits.ManageMessages);
};

// Updated required permissions for the bot
const requiredPermissions = [
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
];

// Check if bot has required permissions
const botHasRequiredPermissions = guild => {
  const botMember = guild.members.me;
  if (!botMember) return false;
  return requiredPermissions.every(perm => botMember.permissions.has(perm));
};

// Get missing bot permissions
const getMissingBotPermissions = guild => {
  const botMember = guild.members.me;
  const missingPermissions = [];
  for (const permission of requiredPermissions) {
    if (!botMember.permissions.has(permission)) {
      missingPermissions.push(permission);
    }
  }
  return missingPermissions;
};

// Format permission names for display
const formatPermissionName = permission => {
  const permissionNames = {
    [PermissionFlagsBits.ManageRoles]: "Manage Roles",
    [PermissionFlagsBits.ManageMessages]: "Manage Messages",
    [PermissionFlagsBits.AddReactions]: "Add Reactions",
    [PermissionFlagsBits.ReadMessageHistory]: "Read Message History",
    [PermissionFlagsBits.ViewChannel]: "View Channel",
    [PermissionFlagsBits.SendMessages]: "Send Messages",
    [PermissionFlagsBits.EmbedLinks]: "Embed Links",
    [PermissionFlagsBits.Administrator]: "Administrator",
    [PermissionFlagsBits.ManageGuild]: "Manage Server",
  };
  return permissionNames[permission] || permission;
};

// Check if user has a specific permission
const hasPermission = (member, permission) => {
  if (!member || !member.permissions) return false;
  return member.permissions.has(permission);
};

// Check if user has required permissions for an interaction
const checkUserPermissions = (interaction, requiredPermissions) => {
  if (!interaction || !interaction.member) return false;
  return requiredPermissions.every(permission =>
    interaction.member.permissions.has(permission),
  );
};

// Get required permissions for different command types
const getRequiredPermissions = commandName => {
  for (const category of Object.values(COMMAND_CATEGORIES)) {
    if (category.commands.includes(commandName)) {
      return category.requiredPermissions || [];
    }
  }
  return [];
};

export {
  hasAdminPermissions,
  hasBotManagementPermissions,
  isDeveloper,
  hasManageRolesPermission,
  hasManageMessagesPermission,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
  requiredPermissions,
  hasPermission,
  checkUserPermissions,
  getRequiredPermissions,
};
