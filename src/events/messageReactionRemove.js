import { Events } from "discord.js";
import { getRoleMapping } from "../utils/roleManager.js";

export default {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    console.log("🔥 MESSAGE REACTION REMOVE EVENT TRIGGERED!");
    console.log("Reaction object:", {
      emoji: reaction.emoji?.name || reaction.emoji?.toString(),
      userId: user?.id,
      messageId: reaction.message?.id,
      guildId: reaction.message?.guild?.id,
    });

    // Log every reaction event
    console.log("messageReactionRemove event fired!", {
      emoji: reaction.emoji.name,
      user: user.tag,
      messageId: reaction.message.id,
      guild: reaction.message.guild?.name || "DM",
    });

    // Ignore bot reactions
    if (user.bot) {
      console.log("Ignoring bot reaction");
      return;
    }

    // Fetch the reaction if it's partial
    if (reaction.partial) {
      try {
        console.log("Fetching partial reaction...");
        await reaction.fetch();
        console.log("Successfully fetched partial reaction");
      } catch (error) {
        console.error(
          "Something went wrong when fetching the reaction:",
          error
        );
        return;
      }
    }

    // Get the guild and member
    const guild = reaction.message.guild;
    if (!guild) {
      console.log("No guild found for reaction");
      return;
    }

    let member;
    try {
      member = await guild.members.fetch(user.id);
      if (!member) {
        console.log(`Could not fetch member for user ${user.tag}`);
        return;
      }
    } catch (error) {
      console.error(`Error fetching member for user ${user.tag}:`, error);
      return;
    }

    try {
      // Get role mapping for this message
      console.log(
        `Looking for role mapping for message ${reaction.message.id}`
      );
      const roleMapping = await getRoleMapping(reaction.message.id);

      if (!roleMapping) {
        console.log(`No role mapping found for message ${reaction.message.id}`);
        return;
      }

      console.log("Found role mapping:", roleMapping);

      const emoji = reaction.emoji.name;
      const roleName = roleMapping[emoji];

      if (!roleName) {
        console.log(`No role found for emoji ${emoji}`);
        return;
      }

      console.log(`Found role "${roleName}" for emoji ${emoji}`);

      // Find the role
      const role = guild.roles.cache.find(r => r.name === roleName);

      if (!role) {
        console.error(`Role "${roleName}" not found in guild ${guild.name}`);
        return;
      }

      // Check if user has the role
      if (!member.roles.cache.has(role.id)) {
        console.log(`User ${user.tag} doesn't have role ${roleName}`);
        return;
      }

      // Remove the role
      await member.roles.remove(role);
      console.log(`❌ Removed role "${roleName}" from ${user.tag}`);

      // Optional: Send DM notification
      try {
        await user.send(
          `You've been removed from the **${roleName}** role in ${guild.name}.`
        );
      } catch (dmError) {
        // User might have DMs disabled, that's okay
        console.log(`Could not send DM to ${user.tag}: ${dmError.message}`);
      }
    } catch (error) {
      console.error("Error handling reaction remove:", error);
    }
  },
};
