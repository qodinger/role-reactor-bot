const MIN_PROMPT_LENGTH = 5;
const MAX_PROMPT_LENGTH = 2000;

/**
 * Parse inline parameters from prompt (e.g., --ar 2:3, --seed 12345)
 * @param {string} input - Raw prompt input
 * @returns {Object} Parsed result with cleaned prompt and extracted parameters
 */
export function parseInlineParameters(input) {
  if (!input || typeof input !== "string") {
    return { prompt: "", aspectRatio: null, seed: null };
  }

  let prompt = input.trim();
  let aspectRatio = null;
  let seed = null;

  // Parse --ar or --aspect (aspect ratio)
  const arPattern = /--(?:ar|aspect)\s+(\d+:\d+)/gi;
  const arMatch = arPattern.exec(prompt);
  if (arMatch) {
    aspectRatio = arMatch[1];
    prompt = prompt.replace(arPattern, "").trim();
  }

  // Parse --seed
  const seedPattern = /--seed\s+(-?\d+)/gi;
  const seedMatch = seedPattern.exec(prompt);
  if (seedMatch) {
    seed = parseInt(seedMatch[1], 10);
    prompt = prompt.replace(seedPattern, "").trim();
  }

  // Clean up multiple spaces
  prompt = prompt.replace(/\s+/g, " ").trim();

  return { prompt, aspectRatio, seed };
}

export function validatePrompt(input) {
  if (!input || typeof input !== "string") {
    return {
      isValid: false,
      reason: "Please provide a description for the image you want to create.",
    };
  }

  const prompt = input.trim();
  if (prompt.length < MIN_PROMPT_LENGTH) {
    return {
      isValid: false,
      reason: "Your prompt is too short. Add a few more descriptive details.",
    };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      isValid: false,
      reason: `Prompts must be under ${MAX_PROMPT_LENGTH} characters.`,
    };
  }

  return { isValid: true, prompt };
}
