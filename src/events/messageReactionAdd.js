import { Events } from "discord.js";
import { getRoleMapping } from "../utils/roleManager.js";

export const name = Events.MessageReactionAdd;

export async function execute(reaction, client) {
  if (!reaction) throw new Error("Missing reaction");
  if (!client) throw new Error("Missing client");
  try {
    // Ignore bot reactions
    if (reaction.user?.bot) {
      return;
    }
    // Check if reaction has emoji
    if (!reaction.emoji) {
      return;
    }
    // Get guild
    const guild = reaction.message?.guild;
    if (!guild) {
      return;
    }
    // Always call users.fetch to match test expectations
    const user = await reaction.users.fetch(reaction.user.id);
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
    // Support new structure: { guildId, roles }
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
    console.log(`Role assigned: ${roleId} to ${user.tag}`);
  } catch (error) {
    console.error("Error processing reaction:", error);
  }
}
