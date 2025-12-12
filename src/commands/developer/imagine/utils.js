const MIN_PROMPT_LENGTH = 5;
const MAX_PROMPT_LENGTH = 2000;

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
