import { Events } from "discord.js";
import { getRoleMapping } from "../utils/roleManager.js";

export default {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    // Ignore bot reactions
    if (user.bot) {
      return;
    }

    // Fetch the reaction if it's partial
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error(
          "Something went wrong when fetching the reaction:",
          error,
        );
        return;
      }
    }

    // Get the guild and member
    const guild = reaction.message.guild;
    if (!guild) {
      return;
    }

    let member;
    try {
      member = await guild.members.fetch(user.id);
      if (!member) {
        return;
      }
    } catch (error) {
      console.error(`Error fetching member for user ${user.tag}:`, error);
      return;
    }

    try {
      // Get role mapping for this message
      const roleMapping = await getRoleMapping(reaction.message.id);

      if (!roleMapping) {
        return;
      }

      // Support new structure: { guildId, roles }
      const rolesObj =
        roleMapping && roleMapping.roles ? roleMapping.roles : roleMapping;
      const emoji = reaction.emoji.name;
      const roleConfig = rolesObj[emoji];

      if (!roleConfig) {
        return;
      }

      // Support both string and object mapping for backward compatibility
      let roleName, limit;
      if (typeof roleConfig === "string") {
        roleName = roleConfig;
        limit = null;
      } else {
        roleName = roleConfig.roleName || roleConfig.role || roleConfig.name;
        limit = roleConfig.limit;
      }

      // Find the role
      const role = guild.roles.cache.find(r => r.name === roleName);

      if (!role) {
        console.error(`Role "${roleName}" not found in guild ${guild.name}`);
        return;
      }

      // Check if user already has the role
      if (member.roles.cache.has(role.id)) {
        return;
      }

      // Enforce role limit if set
      if (limit && role.members.size >= limit) {
        try {
          await user.send(
            `❌ The **${roleName}** role is limited to ${limit} users. Current count: ${role.members.size}/${limit}.`,
          );
        } catch {
          // User might have DMs disabled, that's okay
        }
        return;
      }

      // Add the role
      await member.roles.add(role);
      console.log(`✅ Added role "${roleName}" to ${user.tag}`);

      // Optional: Send DM notification
      try {
        await user.send(
          `You've been assigned the **${roleName}** role in ${guild.name}!`,
        );
      } catch {
        // User might have DMs disabled, that's okay
      }
    } catch (error) {
      console.error("Error handling reaction add:", error);
    }
  },
};
