import { validateUserId, validateUserData } from "./utils.js";

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
  const subcommand = interaction.options?.getSubcommand();
  if (!subcommand) {
    errors.push("Subcommand is required");
  } else if (!["balance", "pricing"].includes(subcommand)) {
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
 * Validates pricing subcommand inputs
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result
 */
export function validatePricingInputs(interaction) {
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
 * Validates user data for display
 * @param {Object} userData - User data to validate
 * @returns {Object} Validation result
 */
export function validateUserDataForDisplay(userData) {
  const validation = validateUserData(userData);
  if (!validation.valid) {
    return validation;
  }

  // Additional validation for display
  if (userData.isCore && !userData.coreTier) {
    return {
      valid: false,
      error: "Core members must have a tier specified",
    };
  }

  return { valid: true };
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

/**
 * Validates string length
 * @param {string} str - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Object} Validation result
 */
export function validateStringLength(str, maxLength, fieldName) {
  if (str && str.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} cannot exceed ${maxLength} characters`,
    };
  }

  return { valid: true };
}

/**
 * Validates numeric range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Object} Validation result
 */
export function validateNumericRange(value, min, max, fieldName) {
  if (typeof value !== "number" || isNaN(value)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (value < min) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${min}`,
    };
  }

  if (value > max) {
    return {
      valid: false,
      error: `${fieldName} cannot exceed ${max}`,
    };
  }

  return { valid: true };
}

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Object} Validation result
 */
export function validateUrl(url, fieldName) {
  if (!url) {
    return { valid: true }; // Optional field
  }

  try {
    new URL(url);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: `Invalid ${fieldName} URL format`,
    };
  }
}
