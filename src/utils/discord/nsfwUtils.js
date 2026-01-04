/**
 * NSFW Utilities
 * Helper functions for NSFW content detection and channel validation
 */

/**
 * Check if a Discord channel is marked as NSFW
 * @param {Object} channel - Discord channel object
 * @returns {boolean} True if channel is NSFW
 */
export function isNSFWChannel(channel) {
  if (!channel) return false;

  // Check if channel has NSFW property
  if (typeof channel.nsfw === "boolean") {
    return channel.nsfw;
  }

  // Fallback: check channel name for NSFW indicators
  if (channel.name) {
    const nsfwKeywords = ["nsfw", "adult", "18+", "mature", "explicit"];
    const channelName = channel.name.toLowerCase();
    return nsfwKeywords.some(keyword => channelName.includes(keyword));
  }

  return false;
}

/**
 * Detect if a prompt contains NSFW content
 * @param {string} prompt - The prompt to analyze
 * @returns {boolean} True if prompt appears to contain NSFW content
 */
export function detectNSFWPrompt(prompt) {
  if (!prompt || typeof prompt !== "string") return false;

  const lowerPrompt = prompt.toLowerCase();

  // NSFW keywords (comprehensive but not overly restrictive)
  const nsfwKeywords = [
    // Explicit terms
    "nude",
    "naked",
    "topless",
    "bottomless",
    "undressed",
    "sex",
    "sexual",
    "erotic",
    "porn",
    "xxx",
    "adult",
    "nsfw",
    "explicit",
    "mature",
    "18+",

    // Body parts (contextual)
    "breasts",
    "boobs",
    "tits",
    "nipples",
    "pussy",
    "penis",
    "dick",
    "cock",
    "vagina",
    "genitals",
    "intimate",
    "private parts",

    // Actions
    "masturbat",
    "orgasm",
    "climax",
    "penetrat",
    "intercourse",
    "blowjob",
    "handjob",
    "oral sex",
    "anal",
    "threesome",

    // Positions/scenarios
    "missionary",
    "doggy",
    "cowgirl",
    "reverse cowgirl",
    "sixty nine",
    "69",
    "bondage",
    "bdsm",
    "fetish",
    "kinky",
    "dominat",
    "submiss",

    // Clothing states
    "lingerie",
    "underwear",
    "panties",
    "bra",
    "bikini", // These might be borderline
  ];

  // Check for NSFW keywords
  const hasNSFWKeywords = nsfwKeywords.some(keyword =>
    lowerPrompt.includes(keyword),
  );

  // Check for suggestive phrases
  const suggestivePatterns = [
    /\b(no|without|remove|take off).*(cloth|dress|shirt|pants|bra|panties)\b/i,
    /\b(spread|open).*(legs|thighs)\b/i,
    /\b(large|big|huge|massive).*(breast|boob|tit)\b/i,
    /\b(sexy|seductive|sensual).*(body|figure|curves)\b/i, // Removed "perfect|beautiful" to avoid false positives
    /\b(bedroom|bed|shower|bath).*(scene|setting|background)\b/i,
    /\b(naked|nude|topless).*(body|figure|pose)\b/i, // More specific pattern for explicit nudity
  ];

  const hasSuggestivePatterns = suggestivePatterns.some(pattern =>
    pattern.test(prompt),
  );

  return hasNSFWKeywords || hasSuggestivePatterns;
}

/**
 * Get NSFW validation result for a prompt and channel
 * @param {string} prompt - The prompt to validate
 * @param {Object} channel - Discord channel object
 * @returns {Object} Validation result with isAllowed and reason
 */
export function validateNSFWRequest(prompt, channel) {
  const isNSFW = detectNSFWPrompt(prompt);
  const isChannelNSFW = isNSFWChannel(channel);

  if (!isNSFW) {
    // Non-NSFW prompt, always allowed
    return { isAllowed: true, isNSFW: false };
  }

  if (isNSFW && isChannelNSFW) {
    // NSFW prompt in NSFW channel, allowed
    return { isAllowed: true, isNSFW: true };
  }

  if (isNSFW && !isChannelNSFW) {
    // NSFW prompt in non-NSFW channel, not allowed
    return {
      isAllowed: false,
      isNSFW: true,
      reason:
        "NSFW content can only be generated in NSFW-marked channels. Please use an NSFW channel or modify your prompt.",
    };
  }

  return { isAllowed: true, isNSFW: false };
}
