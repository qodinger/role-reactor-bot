import { Events } from "discord.js";
import { getRoleMapping } from "../utils/discord/roleMappingManager.js";
import { getLogger } from "../utils/logger.js";
import { getCachedMember } from "../utils/discord/roleManager.js";

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

    // Get member using cached method to reduce API calls
    const member = await getCachedMember(guild, user.id);
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

    // Capture selectionMode before unwrapping (it lives alongside roles)
    const selectionMode =
      roleMapping.selectionMode || rolesObj.selectionMode || "standard";

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

    // Handle Unique mode: remove other roles from this menu concurrently
    if (selectionMode === "unique") {
      // Fetch the message to access all reactions
      const message = reaction.message.partial
        ? await reaction.message.fetch()
        : reaction.message;

      // Collect all remove operations to run in parallel
      const removeOps = [];

      for (const [emojiKey, config] of Object.entries(rolesObj)) {
        // Skip non-role keys
        if (
          emojiKey === "hideList" ||
          emojiKey === "selectionMode" ||
          emojiKey === "roles"
        )
          continue;
        if (
          typeof config === "boolean" ||
          config === null ||
          config === undefined
        )
          continue;
        // Skip the current emoji (the one they just reacted to)
        if (emojiKey === emoji) continue;

        // Resolve role ID for this emoji
        let otherRoleId;
        if (typeof config === "string") {
          otherRoleId = config;
        } else if (config.roleId) {
          otherRoleId = config.roleId;
        }

        // Queue role removal if member has it
        if (otherRoleId && member.roles.cache.has(otherRoleId)) {
          removeOps.push(
            member.roles
              .remove(otherRoleId)
              .catch(() => null)
              .then(() => {
                logger.info(
                  `🔄 Unique mode: removed role ${otherRoleId} from ${user.tag}`,
                );
              }),
          );
        }

        // Queue reaction removal for the other emoji
        const otherReaction = message.reactions.cache.find(r => {
          if (r.emoji.id) {
            return `<:${r.emoji.name}:${r.emoji.id}>` === emojiKey;
          }
          return r.emoji.name === emojiKey;
        });

        if (otherReaction) {
          removeOps.push(otherReaction.users.remove(user.id).catch(() => null));
        }
      }

      // If user already has the new role and nothing to remove, bail early
      if (member.roles.cache.has(roleId) && removeOps.length === 0) {
        return;
      }

      // Run all removals AND the new role grant simultaneously
      await Promise.all([
        ...removeOps,
        member.roles.cache.has(roleId)
          ? Promise.resolve()
          : member.roles.add(roleId).then(() => {
              logger.info(`✅ Role assigned: ${roleId} to ${user.tag}`);
            }),
      ]);

      return;
    }

    // Standard toggle mode
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
