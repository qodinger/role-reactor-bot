import { EmbedBuilder } from "discord.js";
import { isValidEmoji, isValidDuration } from "./inputUtils.js";
import { validateColor as isValidHexColor } from "./roleValidator.js";

/**
 * Creates a validation error embed.
 * @param {string} field The field that failed validation.
 * @param {string} reason The reason for the validation failure.
 * @returns {EmbedBuilder} The error embed.
 */
export function createValidationErrorEmbed(field, reason) {
  return new EmbedBuilder()
    .setColor("#FF0000")
    .setTitle("❌ Validation Error")
    .setDescription(`**Field:** ${field}\n**Issue:** ${reason}`)
    .setTimestamp()
    .setFooter({ text: "Please check your input and try again" });
}

/**
 * Validates all inputs for a command.
 * @param {object} inputs An object containing the input values.
 * @returns {{isValid: boolean, errors: Array<string>}} The validation result.
 */
export function validateCommandInputs(inputs) {
  const errors = [];

  for (const [field, value] of Object.entries(inputs)) {
    if (value === null || value === undefined) {
      errors.push(`${field} is required`);
      continue;
    }

    switch (field) {
      case "color":
        if (value && !isValidHexColor(value)) {
          errors.push(`${field} must be a valid hex color (e.g., #0099ff)`);
        }
        break;
      case "duration":
        if (value && !isValidDuration(value)) {
          errors.push(`${field} must be in format: 30m, 2h, 1d, 1w`);
        }
        break;
      case "emoji":
        if (value && !isValidEmoji(value)) {
          errors.push(`${field} must be a valid emoji`);
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
