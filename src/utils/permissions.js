const { PermissionFlagsBits } = require("discord.js");

// Check if user has admin permissions
const hasAdminPermissions = (member) => {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageRoles) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
};

// Check if user has manage roles permission
const hasManageRolesPermission = (member) => {
  return member.permissions.has(PermissionFlagsBits.ManageRoles);
};

// Check if user has manage messages permission
const hasManageMessagesPermission = (member) => {
  return member.permissions.has(PermissionFlagsBits.ManageMessages);
};

// Check if bot has required permissions
const botHasRequiredPermissions = (guild) => {
  const botMember = guild.members.me;

  if (!botMember) return false;

  return (
    botMember.permissions.has(PermissionFlagsBits.ManageRoles) &&
    botMember.permissions.has(PermissionFlagsBits.ManageMessages) &&
    botMember.permissions.has(PermissionFlagsBits.AddReactions)
  );
};

// Get missing bot permissions
const getMissingBotPermissions = (guild) => {
  const botMember = guild.members.me;
  const requiredPermissions = [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.AddReactions,
  ];

  const missingPermissions = [];

  for (const permission of requiredPermissions) {
    if (!botMember.permissions.has(permission)) {
      missingPermissions.push(permission);
    }
  }

  return missingPermissions;
};

// Format permission names for display
const formatPermissionName = (permission) => {
  const permissionNames = {
    [PermissionFlagsBits.ManageRoles]: "Manage Roles",
    [PermissionFlagsBits.ManageMessages]: "Manage Messages",
    [PermissionFlagsBits.AddReactions]: "Add Reactions",
    [PermissionFlagsBits.Administrator]: "Administrator",
    [PermissionFlagsBits.ManageGuild]: "Manage Server",
  };

  return permissionNames[permission] || permission;
};

module.exports = {
  hasAdminPermissions,
  hasManageRolesPermission,
  hasManageMessagesPermission,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
};
