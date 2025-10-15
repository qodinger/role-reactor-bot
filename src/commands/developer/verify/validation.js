import {
  validateDonationAmount,
  validateCreditAmount,
  validateKoFiUrl,
} from "./utils.js";

// ============================================================================
// INPUT VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates all donation verification inputs
 * @param {Object} options - Interaction options
 * @returns {Object} Validation result
 */
export function validateDonationInputs(options) {
  const errors = [];

  // Validate user
  const user = options.getUser("user");
  if (!user) {
    errors.push("User is required");
  }

  // Validate amount
  const amount = options.getNumber("amount");
  const amountValidation = validateDonationAmount(amount);
  if (!amountValidation.valid) {
    errors.push(amountValidation.error);
  }

  // Validate Ko-fi URL (optional)
  const koFiUrl = options.getString("ko-fi-url");
  const urlValidation = validateKoFiUrl(koFiUrl);
  if (!urlValidation.valid) {
    errors.push(urlValidation.error);
  }

  // Validate notes (optional)
  const notes = options.getString("notes");
  if (notes && notes.length > 200) {
    errors.push("Notes cannot exceed 200 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      user,
      amount,
      koFiUrl,
      notes,
    },
  };
}

/**
 * Validates all subscription verification inputs
 * @param {Object} options - Interaction options
 * @returns {Object} Validation result
 */
export function validateSubscriptionInputs(options) {
  const errors = [];

  // Validate user
  const user = options.getUser("user");
  if (!user) {
    errors.push("User is required");
  }

  // Validate Ko-fi URL (optional)
  const koFiUrl = options.getString("ko-fi-url");
  const urlValidation = validateKoFiUrl(koFiUrl);
  if (!urlValidation.valid) {
    errors.push(urlValidation.error);
  }

  // Validate notes (optional)
  const notes = options.getString("notes");
  if (notes && notes.length > 200) {
    errors.push("Notes cannot exceed 200 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      user,
      koFiUrl,
      notes,
    },
  };
}

/**
 * Validates all manual credit inputs
 * @param {Object} options - Interaction options
 * @returns {Object} Validation result
 */
export function validateManualCreditsInputs(options) {
  const errors = [];

  // Validate user
  const user = options.getUser("user");
  if (!user) {
    errors.push("User is required");
  }

  // Validate credits
  const credits = options.getInteger("credits");
  const creditsValidation = validateCreditAmount(credits);
  if (!creditsValidation.valid) {
    errors.push(creditsValidation.error);
  }

  // Validate notes (optional)
  const notes = options.getString("notes");
  if (notes && notes.length > 200) {
    errors.push("Notes cannot exceed 200 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      user,
      credits,
      notes,
    },
  };
}

/**
 * Validates user object
 * @param {Object} user - Discord user object
 * @returns {Object} Validation result
 */
export function validateUser(user) {
  if (!user) {
    return { valid: false, error: "User is required" };
  }

  if (!user.id) {
    return { valid: false, error: "Invalid user object" };
  }

  if (user.bot) {
    return { valid: false, error: "Cannot verify credits for bot accounts" };
  }

  return { valid: true };
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
      text: "Core Verification • Input Validation",
      icon_url: client.user.displayAvatarURL(),
    },
  };
}
