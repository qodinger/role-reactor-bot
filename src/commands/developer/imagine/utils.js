const MIN_PROMPT_LENGTH = 5;
const MAX_PROMPT_LENGTH = 2000;

/**
 * Parse inline parameters from prompt (--ar 2:3, --seed 12345, --style anime, --nsfw, etc.)
 * @param {string} input - Raw prompt input
 * @returns {Object} Parsed result with cleaned prompt and extracted parameters
 */
export function parseInlineParameters(input) {
  if (!input || typeof input !== "string") {
    return {
      prompt: "",
      aspectRatio: null,
      seed: null,
      style: null,
      steps: null,
      cfg: null,
      nsfw: false,
    };
  }

  let prompt = input.trim();
  let aspectRatio = null;
  let seed = null;
  let style = null;
  let steps = null;
  let cfg = null;
  let nsfw = false;

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

  // Parse --style (anime, realistic, fantasy, etc.)
  const stylePattern = /--style\s+(\w+)/gi;
  const styleMatch = stylePattern.exec(prompt);
  if (styleMatch) {
    style = styleMatch[1].toLowerCase();
    prompt = prompt.replace(stylePattern, "").trim();
  }

  // Parse --steps (10-50, optimal: 20-30)
  const stepsPattern = /--steps\s+(\d+)/gi;
  const stepsMatch = stepsPattern.exec(prompt);
  if (stepsMatch) {
    const stepsValue = parseInt(stepsMatch[1], 10);
    if (stepsValue >= 10 && stepsValue <= 50) {
      steps = stepsValue;
    }
    prompt = prompt.replace(stepsPattern, "").trim();
  }

  // Parse --cfg (1-20, optimal: 6-12)
  const cfgPattern = /--cfg\s+(\d+(?:\.\d+)?)/gi;
  const cfgMatch = cfgPattern.exec(prompt);
  if (cfgMatch) {
    const cfgValue = parseFloat(cfgMatch[1]);
    if (cfgValue >= 1 && cfgValue <= 20) {
      cfg = cfgValue;
    }
    prompt = prompt.replace(cfgPattern, "").trim();
  }

  // Parse --nsfw flag (enables NSFW content generation)
  const nsfwPattern = /--nsfw\b/gi;
  const nsfwMatch = nsfwPattern.exec(prompt);
  if (nsfwMatch) {
    nsfw = true;
    prompt = prompt.replace(nsfwPattern, "").trim();
  }

  // Clean up multiple spaces
  prompt = prompt.replace(/\s+/g, " ").trim();

  return {
    prompt,
    aspectRatio,
    seed,
    style,
    steps,
    cfg,
    nsfw,
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
