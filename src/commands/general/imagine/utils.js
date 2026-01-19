const MIN_PROMPT_LENGTH = 5;
const MAX_PROMPT_LENGTH = 2000;

/**
 * Parse inline parameters from prompt (--ar 2:3, --model animagine, --nsfw, etc.)
 * @param {string} input - Raw prompt input
 * @returns {Object} Parsed result with cleaned prompt and extracted parameters
 */
export function parseInlineParameters(input) {
  if (!input || typeof input !== "string") {
    return {
      prompt: "",
      aspectRatio: null,
      nsfw: false,
    };
  }

  let prompt = input.trim();
  let aspectRatio = null;
  let nsfw = false;

  // Parse --ar or --aspect (aspect ratio)
  const arPattern = /--(?:ar|aspect)\s+(\d+:\d+)/gi;
  const arMatch = arPattern.exec(prompt);
  if (arMatch) {
    aspectRatio = arMatch[1];
    prompt = prompt.replace(arPattern, "").trim();
  }

  // Parse --nsfw flag (enables NSFW content generation)
  const nsfwPattern = /--nsfw\b/gi;
  const nsfwMatch = nsfwPattern.exec(prompt);
  if (nsfwMatch) {
    nsfw = true;
    prompt = prompt.replace(nsfwPattern, "").trim();
  }

  // Parse --hq flag
  const hqPattern = /--(?:hq|quality)\b/gi;
  let hq = hqPattern.test(prompt);
  if (hq) {
    prompt = prompt.replace(hqPattern, "").trim();
  }

  // Parse --no or --negative (negative prompt)
  let negativePrompt = null;
  const noPattern = /--(?:no|negative)\s+([^--]+)/gi;
  const noMatch = noPattern.exec(prompt);
  if (noMatch) {
    negativePrompt = noMatch[1].trim();
    prompt = prompt.replace(noPattern, "").trim();
  }

  // Clean up multiple spaces
  prompt = prompt.replace(/\s+/g, " ").trim();

  return {
    prompt,
    aspectRatio,
    nsfw,
    hq,
    negativePrompt,
  };
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
