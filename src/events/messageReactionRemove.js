import { Events } from "discord.js";
import {
  getRoleMapping,
  decrementRoleUsage,
} from "../utils/discord/roleMappingManager.js";
import { getLogger } from "../utils/logger.js";

export const name = Events.MessageReactionRemove;

export async function execute(reaction, user, client) {
  const logger = getLogger();

  if (!reaction) throw new Error("Missing reaction");
  if (!user) throw new Error("Missing user");
  if (!client) throw new Error("Missing client");

  try {
    // Check if reaction has emoji
    if (!reaction.emoji) {
      return;
    }

    // Get guild
    const guild = reaction.message?.guild;
    if (!guild) {
      return;
    }

    // Ignore bot reactions
    if (user.bot) {
      return;
    }

    // Get member
    const member = await guild.members.fetch(user.id);
    if (!member) {
      return;
    }

    // Note: Poll reactions are now handled by Discord's native poll system
    // This event handler only processes role assignment reactions

    // Get role mapping for this message
    const roleMapping = await getRoleMapping(reaction.message.id);
    if (!roleMapping) {
      return;
    }

    let rolesObj = roleMapping.roles ? roleMapping.roles : roleMapping;

    // Handle double-nested roles (cache stores { roles: {emoji_map}, hideList })
    if (
      rolesObj.roles &&
      typeof rolesObj.roles === "object" &&
      !Array.isArray(rolesObj.roles)
    ) {
      rolesObj = rolesObj.roles;
    }

    // Handle both custom emojis and Unicode emojis
    let emoji;
    if (reaction.emoji.id) {
      // Custom emoji: use the full format <:name:id>
      emoji = `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
    } else {
      // Unicode emoji: use the name property
      emoji = reaction.emoji.name;
    }

    const roleConfig = rolesObj[emoji];
    if (!roleConfig) {
      return;
    }

    // Handle multiple roles per emoji
    let roleIds = [];

    // Check if this is a multi-role configuration
    if (roleConfig.roleIds && Array.isArray(roleConfig.roleIds)) {
      roleIds = roleConfig.roleIds;
    } else if (roleConfig.roleId) {
      // Single role (legacy format)
      roleIds = [roleConfig.roleId];
    } else if (typeof roleConfig === "string") {
      // Simple string format (legacy)
      roleIds = [roleConfig];
    } else {
      // Fallback to finding by name
      const roleName =
        roleConfig.roleName || roleConfig.role || roleConfig.name;
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (role) {
        roleIds = [role.id];
      }
    }

    if (roleIds.length === 0) {
      return;
    }

    // Determine which roles actually need to be removed
    const rolesToRemove = roleIds.filter(id => member.roles.cache.has(id));

    if (rolesToRemove.length === 0) {
      return;
    }

    // Remove roles via a single API call to prevent rate limits
    await member.roles.remove(rolesToRemove);

    // Decrement usage counter
    if (roleConfig.limit && roleConfig.limit > 0) {
      await decrementRoleUsage(reaction.message.id, emoji);
    }

    for (const id of rolesToRemove) {
      logger.info(`✅ Role removed: ${id} from ${user.tag}`);
    }
  } catch (error) {
    logger.error("Error processing reaction removal", error);
  }
}
