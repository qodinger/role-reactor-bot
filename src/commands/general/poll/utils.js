import { EMOJIS } from "../../../config/theme.js";

/**
 * Get default emoji for poll option index
 * @param {number} index - Option index
 * @returns {string} Default emoji
 */
export function getDefaultEmoji(index) {
  const defaultEmojis = [
    EMOJIS.NUMBERS.ONE,
    EMOJIS.NUMBERS.TWO,
    EMOJIS.NUMBERS.THREE,
    EMOJIS.NUMBERS.FOUR,
    EMOJIS.NUMBERS.FIVE,
    EMOJIS.NUMBERS.SIX,
    EMOJIS.NUMBERS.SEVEN,
    EMOJIS.NUMBERS.EIGHT,
    EMOJIS.NUMBERS.NINE,
    EMOJIS.NUMBERS.TEN,
  ];
  return defaultEmojis[index] || EMOJIS.UI.QUESTION;
}

/**
 * Parse poll options from string - supports both pipe-separated and newline-separated formats
 * @param {string} optionsString - Options string (pipe-separated or newline-separated)
 * @returns {Array<string>} Array of parsed options
 */
export function parsePollOptions(optionsString) {
  if (!optionsString || optionsString.trim().length === 0) {
    return [];
  }

  // Check if the string contains pipe separators
  if (optionsString.includes("|")) {
    // Parse pipe-separated format: "Option 1|Option 2|Option 3"
    return optionsString
      .split("|")
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);
  } else {
    // Parse newline-separated format: "Option 1\nOption 2\nOption 3"
    return optionsString
      .split("\n")
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);
  }
}

// formatPollDuration function removed - not used with native Discord polls
