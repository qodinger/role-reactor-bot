import pLimit from "p-limit";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { processRoles, setRoleMapping } from "./utils.js";
import { createSetupRolesEmbed } from "./embeds.js";

/**
 * Processes role input and validates roles
 * @param {Object} interaction - Discord interaction object
 * @param {string} rolesString - Roles string from command options
 * @returns {Object} Processing result with success boolean and data/error
 */
export async function processRoleInput(interaction, rolesString) {
  const logger = getLogger();

  logger.debug("Processing role input", { rolesString });

  const roleProcessingResult = await processRoles(interaction, rolesString);
  if (!roleProcessingResult.success) {
    logger.warn("Role processing failed", {
      errors: roleProcessingResult.errors,
      error: roleProcessingResult.error,
    });

    return {
      success: false,
      errorResponse: errorEmbed({
        title: "Role Processing Error",
        description:
          roleProcessingResult.errors?.join("\n") || roleProcessingResult.error,
        solution: "Please check your role format and try again.",
      }),
    };
  }

  logger.debug("Role processing successful", {
    validRolesCount: roleProcessingResult.validRoles.length,
  });

  return {
    success: true,
    data: {
      validRoles: roleProcessingResult.validRoles,
      roleMapping: roleProcessingResult.roleMapping,
    },
  };
}

/**
 * Creates and sends a role-reaction message
 * @param {Object} interaction - Discord interaction object
 * @param {Object} messageData - Message data (title, description, color, validRoles)
 * @param {Object} client - Discord client
 * @returns {Object} Result with success boolean and message/error
 */
export async function createRoleReactionMessage(
  interaction,
  messageData,
  client,
) {
  const logger = getLogger();

  const { title, description, color, validRoles } = messageData;

  logger.debug("Creating role-reaction message", {
    title,
    description,
    color,
    rolesCount: validRoles.length,
  });

  const embed = createSetupRolesEmbed(
    title,
    description,
    color,
    validRoles,
    client,
  );

  try {
    const message = await interaction.channel.send({ embeds: [embed] });
    logger.debug("Successfully sent role-reaction message", {
      messageId: message.id,
    });

    return {
      success: true,
      message,
    };
  } catch (error) {
    logger.error("Failed to send role-reaction message", {
      error: error.message,
    });

    return {
      success: false,
      errorResponse: errorEmbed({
        title: "Failed to Send Message",
        description: `Unable to send the role-reaction message to this channel: ${error.message}`,
        solution: "Please check my permissions in this channel and try again.",
        fields: [
          {
            name: "🔧 Required Permissions",
            value:
              "• **Send Messages** - To send the role-reaction message\n• **Embed Links** - To create rich embeds\n• **Add Reactions** - To add emoji reactions",
            inline: false,
          },
        ],
      }),
    };
  }
}

/**
 * Adds reactions to a message with rate limiting
 * @param {Object} message - Discord message object
 * @param {Array} validRoles - Array of valid role objects
 * @returns {Object} Result with success boolean and failed reactions
 */
export async function addReactionsToMessage(message, validRoles) {
  const logger = getLogger();

  logger.debug("Adding reactions to message", {
    messageId: message.id,
    rolesCount: validRoles.length,
  });

  const limiter = pLimit(3);
  const reactionResults = await Promise.allSettled(
    validRoles.map(role =>
      limiter(async () => {
        try {
          await message.react(role.emoji);
          logger.debug(`Added reaction ${role.emoji} for role ${role.name}`);
          return { success: true, role: role.name, emoji: role.emoji };
        } catch (error) {
          logger.warn(
            `Failed to add reaction ${role.emoji} for role ${role.name}`,
            {
              error: error.message,
            },
          );
          return {
            success: false,
            role: role.name,
            emoji: role.emoji,
            error: error.message,
          };
        }
      }),
    ),
  );

  // Check if any reactions failed
  const failedReactions = reactionResults
    .filter(result => result.status === "fulfilled" && !result.value.success)
    .map(result => result.value);

  if (failedReactions.length > 0) {
    logger.warn(`Failed to add ${failedReactions.length} reactions`, {
      failedReactions,
    });
  }

  return {
    success: failedReactions.length === 0,
    failedReactions,
  };
}

/**
 * Handles reaction addition failures
 * @param {Array} failedReactions - Array of failed reaction objects
 * @param {Array} validRoles - Array of all valid roles
 * @returns {Object|null} Error response if all reactions failed, null otherwise
 */
export function handleReactionFailures(failedReactions, validRoles) {
  const logger = getLogger();

  // If all reactions failed, it's likely a permission issue
  if (failedReactions.length === validRoles.length) {
    logger.error("All reactions failed - likely permission issue", {
      failedCount: failedReactions.length,
      totalRoles: validRoles.length,
    });

    return errorEmbed({
      title: "Failed to Add Reactions",
      description:
        "I couldn't add any emoji reactions to the message. This usually means I don't have the **Add Reactions** permission in this channel.",
      solution:
        "Please grant me the **Add Reactions** permission in this channel and try again.",
      fields: [
        {
          name: "🔧 How to Fix",
          value:
            "1. Right-click on this channel → **Edit Channel**\n2. Go to **Permissions** tab\n3. Find my role (Role Reactor) or @everyone\n4. Enable **Add Reactions** permission\n5. Make sure no other role is denying this permission",
          inline: false,
        },
      ],
    });
  }

  // Some reactions failed but not all - log warning but continue
  if (failedReactions.length > 0) {
    logger.warn("Some reactions failed but continuing", {
      failedCount: failedReactions.length,
      totalRoles: validRoles.length,
    });
  }

  return null;
}

/**
 * Saves role mapping to storage
 * @param {string} messageId - Discord message ID
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - Discord channel ID
 * @param {Object} roleMapping - Role mapping object
 * @returns {Promise<void>}
 */
export async function saveRoleMapping(
  messageId,
  guildId,
  channelId,
  roleMapping,
) {
  const logger = getLogger();

  logger.debug("Saving role mapping", {
    messageId,
    guildId,
    channelId,
    rolesCount: Object.keys(roleMapping).length,
  });

  try {
    await setRoleMapping(messageId, guildId, channelId, roleMapping);
    logger.debug("Role mapping saved successfully");
  } catch (error) {
    logger.error("Failed to save role mapping", {
      error: error.message,
      messageId,
      guildId,
    });
    throw error;
  }
}
