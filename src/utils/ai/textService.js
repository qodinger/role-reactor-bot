import { aiService } from "./aiService.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Specialized service for AI text generation
 */
export class TextService {
  constructor() {
    this.aiService = aiService;
  }

  /**
   * Generate AI text content
   * @param {string} prompt - Text generation prompt
   * @param {Object} config - Text configuration
   * @returns {Promise<Object>} Generated text data
   */
  async generateText(prompt, config = {}) {
    try {
      const result = await this.aiService.generateText(prompt, config);
      return result;
    } catch (error) {
      logger.error("Error generating AI text:", error);
      throw new Error(`Text generation failed: ${error.message}`);
    }
  }

  /**
   * Generate creative writing content
   * @param {string} prompt - Writing prompt
   * @param {string} style - Writing style
   * @param {number} length - Desired length in words
   * @returns {Promise<Object>} Generated creative writing
   */
  async generateCreativeWriting(prompt, style = "creative", length = 500) {
    const enhancedPrompt = this.buildCreativePrompt(prompt, style, length);

    const result = await this.generateText(enhancedPrompt, {
      model: "google/gemini-2.5-flash",
      max_tokens: Math.min(length * 2, 2000),
      temperature: 0.8,
    });

    return {
      ...result,
      style,
      targetLength: length,
    };
  }

  /**
   * Generate code explanations
   * @param {string} code - Code to explain
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Generated explanation
   */
  async generateCodeExplanation(code, language = "javascript") {
    const prompt = `Explain this ${language} code in detail:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:\n1. What the code does\n2. How it works\n3. Key concepts\n4. Potential improvements\n5. Common use cases`;

    const result = await this.generateText(prompt, {
      model: "google/gemini-2.5-flash",
      max_tokens: 1500,
      temperature: 0.3,
    });

    return {
      ...result,
      language,
      code,
    };
  }

  /**
   * Generate summaries
   * @param {string} content - Content to summarize
   * @param {number} maxLength - Maximum summary length
   * @returns {Promise<Object>} Generated summary
   */
  async generateSummary(content, maxLength = 200) {
    const prompt = `Summarize the following content in ${maxLength} words or less:\n\n${content}`;

    const result = await this.generateText(prompt, {
      model: "google/gemini-2.5-flash",
      max_tokens: Math.min(maxLength * 2, 1000),
      temperature: 0.2,
    });

    return {
      ...result,
      originalLength: content.length,
      targetLength: maxLength,
    };
  }

  /**
   * Build creative writing prompt
   * @param {string} prompt - Base prompt
   * @param {string} style - Writing style
   * @param {number} length - Target length
   * @returns {string} Enhanced prompt
   */
  buildCreativePrompt(prompt, style, length) {
    const styleInstructions = {
      creative:
        "Write in a creative, engaging style with vivid descriptions and emotional depth.",
      formal:
        "Write in a formal, professional tone with clear structure and precise language.",
      casual:
        "Write in a casual, conversational tone that's easy to read and relatable.",
      poetic:
        "Write in a poetic, lyrical style with rich imagery and flowing language.",
      technical:
        "Write in a technical, informative style with clear explanations and examples.",
    };

    const instruction = styleInstructions[style] || styleInstructions.creative;

    return `${instruction}\n\nTarget length: approximately ${length} words.\n\nPrompt: ${prompt}\n\nPlease write the content now:`;
  }

  /**
   * Get available writing styles
   * @returns {Object} Available styles with descriptions
   */
  getAvailableStyles() {
    return {
      creative: "🎨 Creative - Vivid descriptions and emotional depth",
      formal: "📝 Formal - Professional tone with clear structure",
      casual: "💬 Casual - Conversational and relatable",
      poetic: "🌸 Poetic - Lyrical with rich imagery",
      technical: "🔧 Technical - Informative with clear explanations",
    };
  }
}

export const textService = new TextService();
export const generateText = (prompt, config) =>
  textService.generateText(prompt, config);
export const generateCreativeWriting = (prompt, style, length) =>
  textService.generateCreativeWriting(prompt, style, length);
export const generateCodeExplanation = (code, language) =>
  textService.generateCodeExplanation(code, language);
export const generateSummary = (content, maxLength) =>
  textService.generateSummary(content, maxLength);
