import { getLogger } from "../../../utils/logger.js";

/**
 * Format role information for display
 * @param {Object} role
 * @returns {string}
 */
export function formatRoleInfo(role) {
  const color = role.color
    ? `#${role.color.toString(16).padStart(6, "0")}`
    : "No color";
  return `${role.name} (${color})`;
}

/**
 * Filter roles by name
 * @param {Array} roles
 * @param {string} searchTerm
 * @returns {Array}
 */
export function filterRoles(roles, searchTerm) {
  if (!searchTerm) {
    return roles;
  }

  const term = searchTerm.toLowerCase();
  return roles.filter(role => role.name.toLowerCase().includes(term));
}

/**
 * Process role mappings for display
 * @param {Object} rolesObj
 * @returns {Array}
 */
export function processRoleMappings(rolesObj) {
  if (!rolesObj) return [];

  return Array.isArray(rolesObj) ? rolesObj : Object.values(rolesObj);
}

/**
 * Create role mentions string
 * @param {Array} roles
 * @returns {string}
 */
export function createRoleMentions(roles) {
  return roles
    .map(role =>
      role.roleId ? `<@&${role.roleId}>` : role.roleName || "Unknown",
    )
    .join(", ");
}

/**
 * Log list roles activity
 * @param {string} guildId
 * @param {string} userId
 * @param {number} count
 */
export function logListRolesActivity(guildId, userId, count) {
  const logger = getLogger();
  logger.info(
    `List Roles accessed - Guild: ${guildId}, User: ${userId}, Found: ${count} messages`,
  );
}
