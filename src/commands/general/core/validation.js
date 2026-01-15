import { validateUserId } from "./utils.js";

// ============================================================================
// INPUT VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates core command inputs
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result
 */
export function validateCoreCommandInputs(interaction) {
  const errors = [];

  // Validate interaction
  if (!interaction) {
    errors.push("Interaction is required");
    return { valid: false, errors, data: null };
  }

  // Validate user
  if (!interaction.user) {
    errors.push("User is required");
  } else {
    const userValidation = validateUserId(interaction.user.id);
    if (!userValidation.valid) {
      errors.push(userValidation.error);
    }
  }

  // Validate subcommand
  const validSubcommands = ["balance"];
  const subcommand = interaction.options?.getSubcommand();
  if (!subcommand) {
    errors.push("Subcommand is required");
  } else if (!validSubcommands.includes(subcommand)) {
    errors.push("Invalid subcommand");
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      user: interaction.user,
      subcommand,
    },
  };
}

/**
 * Validates balance subcommand inputs
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result
 */
export function validateBalanceInputs(interaction) {
  const errors = [];

  // Validate user
  if (!interaction.user) {
    errors.push("User is required");
  } else {
    const userValidation = validateUserId(interaction.user.id);
    if (!userValidation.valid) {
      errors.push(userValidation.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      user: interaction.user,
    },
  };
}

/**
 * Validates interaction state
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result
 */
export function validateInteractionState(interaction) {
  if (!interaction) {
    return { valid: false, error: "Interaction is required" };
  }

  if (!interaction.isRepliable()) {
    return { valid: false, error: "Interaction is no longer repliable" };
  }

  if (!interaction.isChatInputCommand()) {
    return { valid: false, error: "Interaction must be a chat input command" };
  }

  return { valid: true };
}

/**
 * Validates command permissions
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result
 */
export function validateCommandPermissions(interaction) {
  if (!interaction) {
    return { valid: false, error: "Interaction is required" };
  }

  if (!interaction.user) {
    return { valid: false, error: "User is required" };
  }

  if (interaction.user.bot) {
    return { valid: false, error: "Bots cannot use this command" };
  }

  return { valid: true };
}

/**
 * Creates a validation error embed
 * @param {Array<string>} errors - Array of error messages
 * @param {Object} client - Discord client
 * @returns {Object} Discord embed object
 */
export function createValidationErrorEmbed(errors, client) {
  return {
    color: 0xff6b6b, // Red color
    title: "❌ Validation Error",
    description: "Please fix the following errors:",
    fields: [
      {
        name: "Errors",
        value: errors
          .map((error, index) => `${index + 1}. ${error}`)
          .join("\n"),
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Command • Input Validation",
      icon_url: client.user.displayAvatarURL(),
    },
  };
}
