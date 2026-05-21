/**
 * Detects bad words in content based on automod settings.
 * @param {string} content - The message content to check
 * @param {Object} settings - The badWords settings object from automod config
 * @param {string} [settings.mode] - Detection mode: "simple" | "wildcard" | "regex"
 * @param {string[]} [settings.words] - Simple word list
 * @param {string[]} [settings.wildcardWords] - Wildcard patterns (use * as wildcard)
 * @param {string[]} [settings.regexPatterns] - Regex pattern strings
 * @param {string[]} [settings.advancedWords] - Advanced word list (simple mode only)
 * @returns {boolean} True if a bad word was detected
 */
export function detectBadWords(content, settings) {
  const {
    mode = "simple",
    words = [],
    wildcardWords = [],
    regexPatterns = [],
    advancedWords = [],
  } = settings;

  const lowerContent = content.toLowerCase();
  let hasBadWord = false;

  if (mode === "wildcard" && wildcardWords.length > 0) {
    hasBadWord = wildcardWords.some(pattern => {
      const regex = new RegExp(pattern.toLowerCase().replace(/\*/g, ".*"), "i");
      return regex.test(lowerContent);
    });
  } else if (mode === "regex" && regexPatterns.length > 0) {
    hasBadWord = regexPatterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, "i");
        return regex.test(lowerContent);
      } catch {
        return false;
      }
    });
  } else if (words.length > 0) {
    hasBadWord = words.some(word => lowerContent.includes(word.toLowerCase()));
  }

  if (advancedWords.length > 0 && mode === "simple") {
    hasBadWord = advancedWords.some(word =>
      lowerContent.includes(word.toLowerCase()),
    );
  }

  return hasBadWord;
}
