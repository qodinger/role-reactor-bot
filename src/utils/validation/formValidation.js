import { EmbedBuilder } from "discord.js";
import {
  InputSanitizer,
  InputValidator,
  formValidationErrors,
  INPUT_LIMITS,
} from "../validation/inputValidation.js";

export function createFormValidationEmbed(field, message) {
  return new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("Input Validation Error")
    .setDescription(`**Field:** ${field}\n**Issue:** ${message}`)
    .addFields({
      name: "Action Required",
      value: "Please correct your input and try again.",
    })
    .setTimestamp()
    .setFooter({ text: "Form validation failed" });
}

export function createFormValidationErrorEmbed(
  title,
  description,
  solution = null,
) {
  const embed = new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (solution) {
    embed.addFields({
      name: "Solution",
      value: solution,
    });
  }

  return embed;
}

export function getModalFields(interaction) {
  const fields = {};
  for (const actionRow of interaction.components) {
    for (const component of actionRow.components) {
      if (component.type === 1 && component.components) {
        for (const textInput of component.components) {
          if (textInput.type === 4) {
            fields[textInput.customId] =
              textInput.value || textInput._value || "";
          }
        }
      }
    }
  }
  return fields;
}

export function getAllModalFieldValues(interaction) {
  const values = {};
  interaction.fields.fields.forEach(field => {
    values[field.customId] = field.value || "";
  });
  return values;
}

export function validateModalInput(input, fieldName, options = {}) {
  const {
    required = false,
    maxLength = INPUT_LIMITS.MESSAGE_CONTENT,
    minLength = 0,
    stripHtml = true,
    removeScripts = true,
    pattern = null,
    patternMessage = null,
    customValidation = null,
  } = options;

  if (!input && required) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Required Field",
        `${fieldName} is required.`,
        "Please provide a value for this field.",
      ),
      field: fieldName,
      code: "REQUIRED",
    };
  }

  if (!input) {
    return { valid: true, sanitized: "", error: null };
  }

  let sanitized = input;

  if (removeScripts) {
    sanitized = InputSanitizer.removeScripts(sanitized);
  }

  if (stripHtml) {
    sanitized = InputSanitizer.stripHtml(sanitized);
  }

  sanitized = sanitized.trim();

  if (InputValidator.containsMaliciousContent(input)) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Invalid Input",
        `${fieldName} contains disallowed HTML or script content.`,
        "Remove any HTML tags, scripts, or special code and try again.",
      ),
      field: fieldName,
      code: "CONTAINS_MALICIOUS",
    };
  }

  if (sanitized.length < minLength) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Input Too Short",
        `${fieldName} must be at least ${minLength} characters.`,
        `Please enter a longer ${fieldName.toLowerCase()}.`,
      ),
      field: fieldName,
      code: "TOO_SHORT",
    };
  }

  if (sanitized.length > maxLength) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Input Too Long",
        `${fieldName} cannot exceed ${maxLength} characters (${sanitized.length} provided).`,
        `Please shorten your ${fieldName.toLowerCase()} to under ${maxLength} characters.`,
      ),
      field: fieldName,
      code: "TOO_LONG",
    };
  }

  if (pattern && !pattern.test(sanitized)) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Invalid Format",
        patternMessage || `${fieldName} contains invalid characters.`,
        "Please check the format and try again.",
      ),
      field: fieldName,
      code: "PATTERN_MISMATCH",
    };
  }

  if (customValidation) {
    const customResult = customValidation(sanitized);
    if (customResult !== true && typeof customResult === "string") {
      return {
        valid: false,
        error: createFormValidationErrorEmbed(
          "Validation Failed",
          customResult,
          "Please correct your input and try again.",
        ),
        field: fieldName,
        code: "CUSTOM_VALIDATION",
      };
    }
    if (customResult === false) {
      return {
        valid: false,
        error: createFormValidationErrorEmbed(
          "Validation Failed",
          `${fieldName} validation failed.`,
          "Please check your input and try again.",
        ),
        field: fieldName,
        code: "CUSTOM_VALIDATION",
      };
    }
  }

  sanitized = sanitized.slice(0, maxLength);

  return { valid: true, sanitized, error: null };
}

export function validateEmail(email, fieldName = "Email") {
  const validation = InputValidator.validateEmail(email, fieldName);
  if (validation) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Invalid Email",
        validation.message,
        "Please enter a valid email address (e.g., user@example.com)",
      ),
      field: fieldName,
      code: validation.code,
    };
  }
  return { valid: true, sanitized: email.trim().toLowerCase(), error: null };
}

export function validateDiscordId(input, fieldName = "Discord ID") {
  const sanitized = InputSanitizer.sanitize(input);

  const mentionMatch = sanitized.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    const id = mentionMatch[1];
    if (/^\d{17,19}$/.test(id)) {
      return { valid: true, sanitized: id, error: null };
    }
  }

  if (/^\d{17,19}$/.test(sanitized)) {
    return { valid: true, sanitized, error: null };
  }

  return {
    valid: false,
    error: createFormValidationErrorEmbed(
      "Invalid Discord ID",
      formValidationErrors.INVALID_USER_ID,
      "Use a user mention (e.g., @username) or enter a valid Discord user ID (17-19 digits).",
    ),
    field: fieldName,
    code: "INVALID_DISCORD_ID",
  };
}

export function validateRoleInput(input, fieldName = "Role") {
  if (!input || !input.trim()) {
    return { valid: true, sanitized: "", error: null };
  }

  const sanitized = InputSanitizer.sanitize(input);

  if (InputValidator.containsMaliciousContent(input)) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Invalid Input",
        `${fieldName} contains disallowed content.`,
        "Please use a role mention or valid role ID.",
      ),
      field: fieldName,
      code: "CONTAINS_MALICIOUS",
    };
  }

  const mentionMatch = sanitized.match(/^<@&(\d+)>$/);
  if (mentionMatch) {
    const id = mentionMatch[1];
    if (/^\d{17,19}$/.test(id)) {
      return { valid: true, sanitized: id, error: null };
    }
  }

  if (/^\d{17,19}$/.test(sanitized)) {
    return { valid: true, sanitized, error: null };
  }

  return {
    valid: false,
    error: createFormValidationErrorEmbed(
      "Invalid Role Format",
      formValidationErrors.INVALID_ROLE_ID,
      "Use a role mention (e.g., @RoleName) or enter a valid role ID.",
    ),
    field: fieldName,
    code: "INVALID_ROLE_ID",
  };
}

export function validateChannelInput(input, fieldName = "Channel") {
  const sanitized = InputSanitizer.sanitize(input);

  const mentionMatch = sanitized.match(/^<#(\d+)>$/);
  if (mentionMatch) {
    const id = mentionMatch[1];
    if (/^\d{17,19}$/.test(id)) {
      return { valid: true, sanitized: id, error: null };
    }
  }

  if (/^\d{17,19}$/.test(sanitized)) {
    return { valid: true, sanitized, error: null };
  }

  return {
    valid: false,
    error: createFormValidationErrorEmbed(
      "Invalid Channel Format",
      formValidationErrors.INVALID_CHANNEL_ID,
      "Use a channel mention (e.g., #channel-name) or enter a valid channel ID.",
    ),
    field: fieldName,
    code: "INVALID_CHANNEL_ID",
  };
}

export function validateDuration(input, fieldName = "Duration") {
  if (!input || !input.trim()) {
    return { valid: true, sanitized: "", error: null };
  }

  const sanitized = input.trim();
  const durationRegex = /^(\d+)(m|h|d|w)$/i;

  if (!durationRegex.test(sanitized)) {
    return {
      valid: false,
      error: createFormValidationErrorEmbed(
        "Invalid Duration Format",
        formValidationErrors.INVALID_DURATION,
        "Use format: 30m (minutes), 2h (hours), 1d (days), 1w (weeks)",
      ),
      field: fieldName,
      code: "INVALID_DURATION",
    };
  }

  return { valid: true, sanitized: sanitized.toLowerCase(), error: null };
}

export function validateEmoji(input, fieldName = "Emoji") {
  if (!input || !input.trim()) {
    return { valid: true, sanitized: "", error: null };
  }

  const sanitized = input.trim();

  const unicodeEmojiRegex =
    /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}-\u{23FA}]+$/u;
  const customEmojiRegex = /^<a?:\w+:\d+>$/;

  if (unicodeEmojiRegex.test(sanitized) || customEmojiRegex.test(sanitized)) {
    return { valid: true, sanitized, error: null };
  }

  return {
    valid: false,
    error: createFormValidationErrorEmbed(
      "Invalid Emoji",
      formValidationErrors.INVALID_EMOJI,
      "Use a standard emoji or Discord custom emoji.",
    ),
    field: fieldName,
    code: "INVALID_EMOJI",
  };
}

export function validateHexColor(input, fieldName = "Color") {
  if (!input || !input.trim()) {
    return { valid: true, sanitized: "", error: null };
  }

  const sanitized = input.trim();
  const hexRegex = /^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

  if (hexRegex.test(sanitized)) {
    const color = sanitized.startsWith("#") ? sanitized : `#${sanitized}`;
    return { valid: true, sanitized: color.toUpperCase(), error: null };
  }

  return {
    valid: false,
    error: createFormValidationErrorEmbed(
      "Invalid Color Format",
      formValidationErrors.INVALID_COLOR,
      "Enter a valid hex color (e.g., #FF5500 or FF5500)",
    ),
    field: fieldName,
    code: "INVALID_COLOR",
  };
}

export function escapeForDatabase(input) {
  return InputSanitizer.escapeForDb(input);
}

export function validateAndSanitizeAll(inputs, schema) {
  const results = {};
  const errors = [];

  for (const [fieldName, config] of Object.entries(schema)) {
    const input = inputs[fieldName];
    let result;

    switch (config.type) {
      case "text":
        result = validateModalInput(input, config.label || fieldName, {
          required: config.required,
          maxLength: config.maxLength || INPUT_LIMITS.MESSAGE_CONTENT,
          minLength: config.minLength || 0,
          stripHtml: config.stripHtml !== false,
          removeScripts: config.removeScripts !== false,
          pattern: config.pattern,
          patternMessage: config.patternMessage,
          customValidation: config.customValidation,
        });
        break;
      case "email":
        result = validateEmail(input, config.label || fieldName);
        break;
      case "discordId":
        result = validateDiscordId(input, config.label || fieldName);
        break;
      case "roleId":
        result = validateRoleInput(input, config.label || fieldName);
        break;
      case "channelId":
        result = validateChannelInput(input, config.label || fieldName);
        break;
      case "duration":
        result = validateDuration(input, config.label || fieldName);
        break;
      case "emoji":
        result = validateEmoji(input, config.label || fieldName);
        break;
      case "color":
        result = validateHexColor(input, config.label || fieldName);
        break;
      case "number":
        result = validateModalInput(input, config.label || fieldName, {
          required: config.required,
          minLength: 1,
          maxLength: 20,
          customValidation: val => {
            const num = parseFloat(val);
            if (isNaN(num)) return "Must be a valid number";
            if (config.min !== undefined && num < config.min) {
              return `Must be at least ${config.min}`;
            }
            if (config.max !== undefined && num > config.max) {
              return `Must be at most ${config.max}`;
            }
            return true;
          },
        });
        if (result.valid && result.sanitized) {
          result.sanitized =
            config.parseAs === "float"
              ? parseFloat(result.sanitized)
              : parseInt(result.sanitized, 10);
        }
        break;
      default:
        result = { valid: true, sanitized: input || "", error: null };
    }

    if (!result.valid) {
      errors.push(result);
    } else {
      results[fieldName] = result.sanitized;
    }
  }

  return {
    valid: errors.length === 0,
    sanitized: results,
    errors,
    firstError: errors[0] || null,
  };
}

export default {
  createFormValidationEmbed,
  createFormValidationErrorEmbed,
  getModalFields,
  getAllModalFieldValues,
  validateModalInput,
  validateEmail,
  validateDiscordId,
  validateRoleInput,
  validateChannelInput,
  validateDuration,
  validateEmoji,
  validateHexColor,
  escapeForDatabase,
  validateAndSanitizeAll,
};
