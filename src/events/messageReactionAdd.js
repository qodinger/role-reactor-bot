import { Events } from "discord.js";
import { getRoleMapping } from "../utils/discord/roleManager.js";
import { getLogger } from "../utils/logger.js";

export const name = Events.MessageReactionAdd;

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

    // Get role mapping for this message
    const roleMapping = await getRoleMapping(reaction.message.id);
    if (!roleMapping) {
      return;
    }

    const rolesObj = roleMapping.roles ? roleMapping.roles : roleMapping;
    const emoji = reaction.emoji.name;
    const roleConfig = rolesObj[emoji];
    if (!roleConfig) {
      return;
    }

    // Use role ID directly if available (for test mocks)
    let roleId;
    if (typeof roleConfig === "string") {
      roleId = roleConfig;
    } else if (roleConfig.roleId) {
      roleId = roleConfig.roleId;
    } else {
      // Fallback to finding by name
      const roleName =
        roleConfig.roleName || roleConfig.role || roleConfig.name;
      const role = guild.roles.cache.find(r => r.name === roleName);
      roleId = role ? role.id : undefined;
    }

    if (!roleId) {
      return;
    }

    // Check if user already has the role
    if (member.roles.cache.has(roleId)) {
      return;
    }

    await member.roles.add(roleId);
    logger.info(`✅ Role assigned: ${roleId} to ${user.tag}`);
  } catch (error) {
    logger.error("Error processing reaction", error);
  }
}
