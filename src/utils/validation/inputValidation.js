/**
 * Comprehensive Input Validation Utility
 * Provides sanitization and validation for all user inputs
 */

const HTML_TAG_REGEX = /<[^>]*>/gi;
const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const SCRIPT_EVENT_HANDLERS = /\bon\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_PROTOCOL = /javascript:/gi;
const DATA_URL_REGEX = /data:[^;]+;base64,/gi;

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const DISCORD_ID_REGEX = /^\d{17,19}$/;

export const INPUT_LIMITS = {
  SHORT_TEXT: 100,
  MEDIUM_TEXT: 500,
  LONG_TEXT: 2000,
  EMBED_DESCRIPTION: 4096,
  POLL_QUESTION: 300,
  POLL_OPTION: 55,
  DISCORD_USERNAME: 32,
  MESSAGE_CONTENT: 2000,
  EMBED_TITLE: 256,
  EMBED_FIELD_NAME: 256,
  EMBED_FIELD_VALUE: 1024,
};

export const VALIDATION_MESSAGES = {
  REQUIRED: field => `${field} is required`,
  TOO_SHORT: (field, min) => `${field} must be at least ${min} characters`,
  TOO_LONG: (field, max) => `${field} must be at most ${max} characters`,
  INVALID_EMAIL: "Please enter a valid email address",
  INVALID_DISCORD_ID: "Invalid Discord ID format",
  INVALID_NUMBER: field => `${field} must be a valid number`,
  NUMBER_OUT_OF_RANGE: (field, min, max) =>
    `${field} must be between ${min} and ${max}`,
  CONTAINS_HTML: field => `${field} contains disallowed HTML or script content`,
  INVALID_CHARACTERS: field => `${field} contains invalid characters`,
};

export class ValidationError extends Error {
  constructor(message, field, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.code = code;
  }
}

export class InputSanitizer {
  /**
   * Remove all HTML tags from text
   * @param {string} input - Input text
   * @returns {string} Sanitized text
   */
  static stripHtml(input) {
    if (typeof input !== "string") return "";
    return input
      .replace(HTML_TAG_REGEX, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Remove script tags and event handlers
   * @param {string} input - Input text
   * @returns {string} Sanitized text
   */
  static removeScripts(input) {
    if (typeof input !== "string") return "";
    return input
      .replace(SCRIPT_REGEX, "")
      .replace(SCRIPT_EVENT_HANDLERS, "")
      .replace(JAVASCRIPT_PROTOCOL, "")
      .replace(DATA_URL_REGEX, "");
  }

  /**
   * Comprehensive sanitization for all text inputs
   * @param {string} input - Input text
   * @returns {string} Fully sanitized text
   */
  static sanitize(input) {
    if (typeof input !== "string") return "";
    let sanitized = input;
    sanitized = this.removeScripts(sanitized);
    sanitized = this.stripHtml(sanitized);
    sanitized = sanitized.trim();
    return sanitized;
  }

  /**
   * Sanitize text but preserve line breaks
   * @param {string} input - Input text
   * @returns {string} Sanitized text with preserved line breaks
   */
  static sanitizePreserveLines(input) {
    if (typeof input !== "string") return "";
    let sanitized = input;
    sanitized = this.removeScripts(sanitized);
    sanitized = this.stripHtml(sanitized);
    sanitized = sanitized.replace(/[\r\n]+/g, "\n").trim();
    return sanitized;
  }

  /**
   * Escape special characters for database queries (MongoDB-safe)
   * @param {string} input - Input text
   * @returns {string} Escaped text
   */
  static escapeForDb(input) {
    if (typeof input !== "string") return "";
    return input
      .replace(/\\/g, "\\\\")
      .replace(/\$/g, "\\$")
      .replace(/\./g, "\\.")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");
  }

  /**
   * Escape for regex patterns
   * @param {string} input - Input text
   * @returns {string} Escaped text
   */
  static escapeForRegex(input) {
    if (typeof input !== "string") return "";
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

export class InputValidator {
  /**
   * Validate required field
   * @param {*} value - Value to check
   * @param {string} fieldName - Field name for error message
   * @returns {ValidationError|null}
   */
  static validateRequired(value, fieldName) {
    if (value === undefined || value === null || value === "") {
      return new ValidationError(
        VALIDATION_MESSAGES.REQUIRED(fieldName),
        fieldName,
        "REQUIRED",
      );
    }
    return null;
  }

  /**
   * Validate text length
   * @param {string} value - Text to validate
   * @param {string} fieldName - Field name
   * @param {number} min - Minimum length
   * @param {number} max - Maximum length
   * @returns {ValidationError|null}
   */
  static validateLength(value, fieldName, min = 0, max = Infinity) {
    if (typeof value !== "string") {
      return new ValidationError(
        `${fieldName} must be a string`,
        fieldName,
        "INVALID_TYPE",
      );
    }

    if (value.length < min) {
      return new ValidationError(
        VALIDATION_MESSAGES.TOO_SHORT(fieldName, min),
        fieldName,
        "TOO_SHORT",
      );
    }

    if (value.length > max) {
      return new ValidationError(
        VALIDATION_MESSAGES.TOO_LONG(fieldName, max),
        fieldName,
        "TOO_LONG",
      );
    }

    return null;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @param {string} fieldName - Field name for error message
   * @returns {ValidationError|null}
   */
  static validateEmail(email, fieldName = "Email") {
    if (typeof email !== "string" || !email.trim()) {
      return new ValidationError(
        VALIDATION_MESSAGES.REQUIRED(fieldName),
        fieldName,
        "REQUIRED",
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return new ValidationError(
        VALIDATION_MESSAGES.INVALID_EMAIL,
        fieldName,
        "INVALID_EMAIL",
      );
    }

    return null;
  }

  /**
   * Validate Discord ID format
   * @param {string|number} id - ID to validate
   * @param {string} fieldName - Field name
   * @returns {ValidationError|null}
   */
  static validateDiscordId(id, fieldName = "ID") {
    const strId = String(id);
    if (!DISCORD_ID_REGEX.test(strId)) {
      return new ValidationError(
        VALIDATION_MESSAGES.INVALID_DISCORD_ID,
        fieldName,
        "INVALID_DISCORD_ID",
      );
    }
    return null;
  }

  /**
   * Validate number range
   * @param {*} value - Value to validate
   * @param {string} fieldName - Field name
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {ValidationError|null}
   */
  static validateNumber(value, fieldName, min = -Infinity, max = Infinity) {
    const num = Number(value);

    if (isNaN(num)) {
      return new ValidationError(
        VALIDATION_MESSAGES.INVALID_NUMBER(fieldName),
        fieldName,
        "INVALID_NUMBER",
      );
    }

    if (num < min || num > max) {
      return new ValidationError(
        VALIDATION_MESSAGES.NUMBER_OUT_OF_RANGE(fieldName, min, max),
        fieldName,
        "OUT_OF_RANGE",
      );
    }

    return null;
  }

  /**
   * Check for potentially malicious content
   * @param {string} input - Input to check
   * @returns {boolean}
   */
  static containsMaliciousContent(input) {
    if (typeof input !== "string") return false;

    const patterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:[^;]+;base64/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<link/i,
      /<meta/i,
    ];

    return patterns.some(pattern => pattern.test(input));
  }
}

export class FormValidator {
  constructor(schema) {
    this.schema = schema;
    this.errors = [];
  }

  /**
   * Validate a single field
   * @param {string} fieldName - Field name
   * @param {*} value - Field value
   * @returns {ValidationError|null}
   */
  validateField(fieldName, value) {
    const rules = this.schema[fieldName];
    if (!rules) return null;

    if (rules.required) {
      const requiredError = InputValidator.validateRequired(value, fieldName);
      if (requiredError) return requiredError;
    }

    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (rules.type === "string") {
      let sanitized = InputSanitizer.sanitize(String(value));

      if (rules.stripHtml !== false) {
        sanitized = InputSanitizer.stripHtml(sanitized);
      }

      if (rules.removeScripts !== false) {
        sanitized = InputSanitizer.removeScripts(sanitized);
      }

      if (rules.minLength !== undefined) {
        const error = InputValidator.validateLength(
          sanitized,
          fieldName,
          rules.minLength,
          rules.maxLength || Infinity,
        );
        if (error) return error;
      }

      if (rules.maxLength !== undefined) {
        const error = InputValidator.validateLength(
          sanitized,
          fieldName,
          0,
          rules.maxLength,
        );
        if (error) return error;
      }

      if (rules.email) {
        const error = InputValidator.validateEmail(sanitized, fieldName);
        if (error) return error;
      }

      if (rules.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(sanitized)) {
          return new ValidationError(
            rules.patternMessage ||
              VALIDATION_MESSAGES.INVALID_CHARACTERS(fieldName),
            fieldName,
            "PATTERN_MISMATCH",
          );
        }
      }

      if (rules.noHtml) {
        if (InputValidator.containsMaliciousContent(value)) {
          return new ValidationError(
            VALIDATION_MESSAGES.CONTAINS_HTML(fieldName),
            fieldName,
            "CONTAINS_HTML",
          );
        }
      }
    }

    if (rules.type === "number") {
      const error = InputValidator.validateNumber(
        value,
        fieldName,
        rules.min,
        rules.max,
      );
      if (error) return error;
    }

    return null;
  }

  /**
   * Validate all fields in data
   * @param {Object} data - Data to validate
   * @returns {{ valid: boolean, errors: ValidationError[], sanitized: Object }}
   */
  validate(data) {
    this.errors = [];
    const sanitized = {};

    for (const [fieldName, rules] of Object.entries(this.schema)) {
      const value = data[fieldName];
      const error = this.validateField(fieldName, value);

      if (error) {
        this.errors.push(error);
      } else if (value !== undefined && value !== null) {
        if (rules.type === "string") {
          let cleanValue = InputSanitizer.sanitize(String(value));
          if (rules.maxLength) {
            cleanValue = cleanValue.slice(0, rules.maxLength);
          }
          sanitized[fieldName] = cleanValue;
        } else {
          sanitized[fieldName] = value;
        }
      }
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      sanitized,
    };
  }
}

export function createValidator(schema) {
  return new FormValidator(schema);
}

export const commonValidationSchemas = {
  email: {
    type: "string",
    required: true,
    email: true,
    maxLength: INPUT_LIMITS.MEDIUM_TEXT,
  },
  username: {
    type: "string",
    required: true,
    maxLength: INPUT_LIMITS.DISCORD_USERNAME,
    stripHtml: true,
    removeScripts: true,
  },
  message: {
    type: "string",
    maxLength: INPUT_LIMITS.MESSAGE_CONTENT,
    stripHtml: true,
    removeScripts: true,
  },
  discordId: {
    type: "string",
    required: true,
    pattern: /^\d{17,19}$/,
    patternMessage: VALIDATION_MESSAGES.INVALID_DISCORD_ID,
  },
  pollQuestion: {
    type: "string",
    required: true,
    maxLength: INPUT_LIMITS.POLL_QUESTION,
    stripHtml: true,
    removeScripts: true,
  },
  pollOption: {
    type: "string",
    required: true,
    maxLength: INPUT_LIMITS.POLL_OPTION,
    stripHtml: true,
    removeScripts: true,
  },
  xpValue: {
    type: "number",
    required: true,
    min: 1,
    max: 10000,
  },
  cooldown: {
    type: "number",
    required: true,
    min: 1,
    max: 3600,
  },
};

export class ModalFormValidator {
  constructor(formName) {
    this.formName = formName;
    this.fields = [];
    this.errors = [];
  }

  addTextField(name, config = {}) {
    this.fields.push({
      name,
      type: "text",
      required: config.required ?? false,
      maxLength: config.maxLength ?? INPUT_LIMITS.MESSAGE_CONTENT,
      minLength: config.minLength ?? 0,
      stripHtml: config.stripHtml ?? true,
      removeScripts: config.removeScripts ?? true,
      pattern: config.pattern ?? null,
      patternMessage: config.patternMessage ?? null,
      validate: config.validate ?? null,
      customError: config.customError ?? null,
    });
    return this;
  }

  addEmailField(name, config = {}) {
    this.fields.push({
      name,
      type: "email",
      required: config.required ?? false,
      maxLength: config.maxLength ?? INPUT_LIMITS.MEDIUM_TEXT,
    });
    return this;
  }

  addNumberField(name, config = {}) {
    this.fields.push({
      name,
      type: "number",
      required: config.required ?? false,
      min: config.min ?? -Infinity,
      max: config.max ?? Infinity,
      parseAs: config.parseAs ?? "int",
    });
    return this;
  }

  validate(data) {
    this.errors = [];
    const sanitized = {};
    const fieldMap = {};
    for (const field of this.fields) {
      fieldMap[field.name] = field;
    }

    for (const field of this.fields) {
      const value = data[field.name];
      const error = this.validateField(field, value, fieldMap);
      if (error) {
        this.errors.push(error);
      } else if (value !== undefined && value !== null) {
        sanitized[field.name] = this.sanitizeField(field, value);
      }
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      sanitized,
      hasErrors: this.errors.length > 0,
      getErrorMessages: () => this.errors.map(e => e.message),
      getFirstError: () => this.errors[0] || null,
    };
  }

  validateField(field, value, _fieldMap) {
    if (
      field.required &&
      (value === undefined || value === null || value === "")
    ) {
      return new ValidationError(
        `${field.name} is required`,
        field.name,
        "REQUIRED",
      );
    }

    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (field.type === "text" || field.type === "email") {
      if (typeof value !== "string") {
        return new ValidationError(
          `${field.name} must be a string`,
          field.name,
          "INVALID_TYPE",
        );
      }

      let processed = value;

      if (field.removeScripts) {
        processed = InputSanitizer.removeScripts(processed);
      }

      if (field.stripHtml) {
        processed = InputSanitizer.stripHtml(processed);
      }

      processed = processed.trim();

      if (processed.length < field.minLength) {
        return new ValidationError(
          `${field.name} must be at least ${field.minLength} characters`,
          field.name,
          "TOO_SHORT",
        );
      }

      if (processed.length > field.maxLength) {
        return new ValidationError(
          `${field.name} must be at most ${field.maxLength} characters (${processed.length} provided)`,
          field.name,
          "TOO_LONG",
        );
      }

      if (field.type === "email") {
        const emailError = InputValidator.validateEmail(processed, field.name);
        if (emailError) {
          return emailError;
        }
      }

      if (field.pattern && !field.pattern.test(processed)) {
        return new ValidationError(
          field.patternMessage || `${field.name} contains invalid characters`,
          field.name,
          "PATTERN_MISMATCH",
        );
      }

      if (field.customError && typeof field.customError === "function") {
        const customResult = field.customError(processed);
        if (customResult !== true) {
          return new ValidationError(
            typeof customResult === "string"
              ? customResult
              : `${field.name} is invalid`,
            field.name,
            "CUSTOM_VALIDATION",
          );
        }
      }

      if (InputValidator.containsMaliciousContent(processed)) {
        return new ValidationError(
          `${field.name} contains disallowed HTML or script content`,
          field.name,
          "CONTAINS_MALICIOUS",
        );
      }

      if (field.validate && typeof field.validate === "function") {
        const validateResult = field.validate(processed);
        if (validateResult !== true) {
          return new ValidationError(
            typeof validateResult === "string"
              ? validateResult
              : `${field.name} validation failed`,
            field.name,
            "VALIDATION_FAILED",
          );
        }
      }
    }

    if (field.type === "number") {
      const numValue =
        field.parseAs === "float" ? parseFloat(value) : parseInt(value, 10);
      if (isNaN(numValue)) {
        return new ValidationError(
          `${field.name} must be a valid number`,
          field.name,
          "INVALID_NUMBER",
        );
      }
      if (numValue < field.min) {
        return new ValidationError(
          `${field.name} must be at least ${field.min}`,
          field.name,
          "OUT_OF_RANGE",
        );
      }
      if (numValue > field.max) {
        return new ValidationError(
          `${field.name} must be at most ${field.max}`,
          field.name,
          "OUT_OF_RANGE",
        );
      }
    }

    return null;
  }

  sanitizeField(field, value) {
    if (field.type === "text" || field.type === "email") {
      let sanitized = String(value);
      if (field.removeScripts) {
        sanitized = InputSanitizer.removeScripts(sanitized);
      }
      if (field.stripHtml) {
        sanitized = InputSanitizer.stripHtml(sanitized);
      }
      sanitized = sanitized.trim();
      if (field.maxLength) {
        sanitized = sanitized.slice(0, field.maxLength);
      }
      return sanitized;
    }
    if (field.type === "number") {
      return field.parseAs === "float"
        ? parseFloat(value)
        : parseInt(value, 10);
    }
    return value;
  }
}

export function createModalValidator(formName) {
  return new ModalFormValidator(formName);
}

export const formValidationErrors = {
  REQUIRED: field => `${field} is required`,
  TOO_SHORT: (field, min) => `${field} must be at least ${min} characters`,
  TOO_LONG: (field, max) => `${field} must be at most ${max} characters`,
  INVALID_EMAIL: "Please enter a valid email address (e.g., user@example.com)",
  INVALID_EMAIL_FORMAT: "Email must be in format: user@domain.com",
  INVALID_EMAIL_DOMAINS: "Email domain is not allowed",
  INVALID_DISCORD_ID: "Invalid Discord ID format (expected 17-19 digits)",
  INVALID_NUMBER: field => `${field} must be a valid number`,
  NUMBER_OUT_OF_RANGE: (field, min, max) =>
    `${field} must be between ${min} and ${max}`,
  CONTAINS_HTML: field => `${field} contains disallowed HTML or script content`,
  INVALID_CHARACTERS: field => `${field} contains invalid characters`,
  INVALID_USER_ID: "Please enter a valid Discord user ID or @mention",
  INVALID_ROLE_ID: "Invalid role ID format. Use a role mention or ID",
  INVALID_CHANNEL_ID: "Invalid channel ID format. Use a channel mention or ID",
  INVALID_DURATION: "Duration must be in format: 30m, 2h, 1d, 1w",
  INVALID_EMOJI: "Please enter a valid emoji",
  INVALID_COLOR: "Color must be a valid hex color (e.g., #FF5500)",
  TEXT_TOO_LONG: (field, max) => `${field} cannot exceed ${max} characters`,
  TEXT_TOO_SHORT: (field, min) => `${field} must be at least ${min} characters`,
  EMPTY_INPUT: field => `${field} cannot be empty`,
  INVALID_FORMAT: (field, format) => `${field} must be in format: ${format}`,
};
