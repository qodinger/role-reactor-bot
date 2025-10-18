import { getLogger } from "../../../utils/logger.js";

/**
 * Validates if an interaction is still valid and can be processed
 * @param {Object} interaction - Discord interaction object
 * @param {number} maxAge - Maximum age in milliseconds (default: 3000)
 * @returns {Object} Validation result with success boolean and error message
 */
export function validateInteraction(interaction, maxAge = 2000) {
  const logger = getLogger();

  // Check if already acknowledged
  if (interaction.replied || interaction.deferred) {
    logger.warn("Interaction already acknowledged", {
      interactionId: interaction.id,
      replied: interaction.replied,
      deferred: interaction.deferred,
    });
    return {
      success: false,
      error: "Interaction already acknowledged",
      skipCleanup: true,
    };
  }

  // Check if interaction has expired
  const interactionAge = Date.now() - interaction.createdTimestamp;
  logger.debug("Interaction age check", {
    age: interactionAge,
    maxAge,
    interactionId: interaction.id,
  });

  if (interactionAge > maxAge) {
    logger.warn("Interaction has expired", {
      age: interactionAge,
      maxAge,
      interactionId: interaction.id,
    });
    return {
      success: false,
      error: "Interaction has expired",
      skipCleanup: true,
    };
  }

  return { success: true };
}

/**
 * Validates if the bot member is available for permission checks
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result with success boolean and error response
 */
export function validateBotMember(interaction) {
  const logger = getLogger();

  if (!interaction.guild.members.me) {
    logger.error("Bot member not available", {
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
    });

    return {
      success: false,
      errorResponse: {
        title: "Bot Permission Error",
        description: "I cannot access my member information in this server.",
        solution:
          "Please make sure I have the necessary permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix",
            value:
              "1. Go to **Server Settings** → **Roles**\n2. Make sure my role (Role Reactor) exists\n3. Grant me basic permissions like **View Channels**\n4. Try the command again",
            inline: false,
          },
        ],
      },
    };
  }

  return { success: true };
}

/**
 * Validates schedule input options
 * @param {Object} options - Schedule options from interaction
 * @returns {Object} Validation result with success boolean and data/error
 */
export function validateScheduleOptions(options) {
  const logger = getLogger();

  logger.debug("Validating schedule options", { options });

  // Validate role
  if (!options.role) {
    return {
      success: false,
      errorResponse: {
        title: "Invalid Role",
        description: "Please select a valid role to assign.",
      },
    };
  }

  if (options.role.managed || (options.role.tags && options.role.tags.botId)) {
    return {
      success: false,
      errorResponse: {
        title: "Invalid Role",
        description:
          "Cannot assign managed roles or bot roles as temporary roles.",
      },
    };
  }

  // Validate users
  const userIds = parseUserInput(options.users);
  if (userIds.length === 0) {
    return {
      success: false,
      errorResponse: {
        title: "Invalid Users",
        description: "Please provide valid user mentions or IDs.",
      },
    };
  }

  logger.debug("Schedule options validation successful", {
    userIdsCount: userIds.length,
    roleId: options.role.id,
  });

  return {
    success: true,
    data: { userIds },
  };
}

/**
 * Parses user input string into user IDs
 * @param {string} usersInput - Comma-separated user input
 * @returns {Array} Array of user IDs
 */
function parseUserInput(usersInput) {
  return usersInput
    .split(",")
    .map(user => user.trim())
    .filter(user => user.length > 0)
    .map(user => {
      const match = user.match(/<@!?(\d+)>/);
      return match ? match[1] : user;
    });
}
