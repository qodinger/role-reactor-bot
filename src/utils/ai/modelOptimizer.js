/**
 * Model Optimizer - Provides optimized parameters for different AI models
 * Optimizes maxTokens and temperature based on model characteristics for better speed and quality
 */

/**
 * Get optimized parameters for a specific model
 * @param {string|null} modelName - Model name/identifier
 * @returns {Object} Optimized parameters { maxTokens, temperature }
 */
export function getModelOptimizations(modelName) {
  if (!modelName) {
    // Default fallback
    return { maxTokens: 2000, temperature: 0.7 };
  }

  const modelLower = modelName.toLowerCase();

  // DeepSeek models (optimize based on model type)
  if (modelLower.includes("deepseek-r2")) {
    return { maxTokens: 1800, temperature: 0.5 }; // R2 is faster, can handle more tokens
  }
  if (modelLower.includes("deepseek-r1-0528")) {
    return { maxTokens: 2000, temperature: 0.5 }; // Enhanced R1: Better performance, can handle more
  }
  if (modelLower.includes("deepseek-r1")) {
    return { maxTokens: 1500, temperature: 0.5 }; // R1 is slower reasoning model, reduce tokens
  }
  if (
    modelLower.includes("deepseek-chat") ||
    modelLower.includes("deepseek-v3")
  ) {
    return { maxTokens: 2000, temperature: 0.7 }; // V3/Chat: Fast general purpose, matches GPT-4o
  }
  if (modelLower.includes("deepseek-v3-base")) {
    return { maxTokens: 2000, temperature: 0.7 }; // V3 Base: Free model, good performance
  }
  if (modelLower.includes("deepseek")) {
    return { maxTokens: 2000, temperature: 0.6 }; // Other DeepSeek variants
  }

  // Claude models (fast, excellent reasoning)
  if (
    modelLower.includes("claude-3.5-haiku") ||
    modelLower.includes("claude-3-haiku")
  ) {
    return { maxTokens: 2000, temperature: 0.6 }; // Haiku is optimized for speed
  }
  if (
    modelLower.includes("claude-3.5-sonnet") ||
    modelLower.includes("claude-3-sonnet")
  ) {
    return { maxTokens: 2000, temperature: 0.7 }; // Sonnet is balanced
  }
  if (
    modelLower.includes("claude-3.5-opus") ||
    modelLower.includes("claude-3-opus")
  ) {
    return { maxTokens: 2000, temperature: 0.7 }; // Opus is high quality
  }
  if (modelLower.includes("claude")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Other Claude models
  }

  // GPT models
  if (modelLower.includes("gpt-4o-mini") || modelLower.includes("gpt-4-mini")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Fast and efficient
  }
  if (modelLower.includes("gpt-4o") || modelLower.includes("gpt-4-turbo")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Fast GPT-4 variants
  }
  if (modelLower.includes("gpt-4")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Standard GPT-4
  }
  if (modelLower.includes("gpt-3.5-turbo")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Fast GPT-3.5
  }
  if (modelLower.includes("gpt")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Other GPT models
  }

  // Mistral models
  if (
    modelLower.includes("mistral-medium") ||
    modelLower.includes("mistral-large")
  ) {
    return { maxTokens: 2000, temperature: 0.7 }; // Balanced Mistral models
  }
  if (modelLower.includes("mistral")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Other Mistral models
  }

  // Gemini models
  if (
    modelLower.includes("gemini-pro") ||
    modelLower.includes("gemini-flash")
  ) {
    return { maxTokens: 2000, temperature: 0.7 }; // Fast Gemini models
  }
  if (modelLower.includes("gemini")) {
    return { maxTokens: 2000, temperature: 0.7 }; // Other Gemini models
  }

  // Self-hosted models (typically slower, optimize for speed)
  if (modelLower.includes("llama") || modelLower.includes("ollama")) {
    return { maxTokens: 1500, temperature: 0.6 }; // Self-hosted models benefit from lower limits
  }

  // Default fallback for unknown models
  return { maxTokens: 2000, temperature: 0.7 };
}
