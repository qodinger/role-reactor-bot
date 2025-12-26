import { JSON_MARKDOWN_PATTERNS } from "./constants.js";

/**
 * JSON Parser for AI responses
 * Handles parsing JSON from AI responses that may contain markdown code blocks or extra text
 */
export class JsonParser {
  /**
   * Parse JSON response from AI, handling markdown code blocks and extra text
   * @param {string} rawResponse - Raw AI response text
   * @returns {Object} Parsed result with {success: boolean, data?: object, error?: string, parsedKeys?: Array<string>, rawResponse?: string}
   */
  static parseJsonResponse(rawResponse) {
    try {
      let jsonString = rawResponse.trim();

      // Remove markdown code blocks if present
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.jsonBlock, "");
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.codeBlock, "");
      jsonString = jsonString.replace(JSON_MARKDOWN_PATTERNS.closingBlock, "");
      jsonString = jsonString.trim();

      // Try to extract JSON if there's extra text before/after
      const jsonMatch = jsonString.match(JSON_MARKDOWN_PATTERNS.jsonObject);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonString);

      // Validate structure
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed
      ) {
        // Ensure message is a string (handle null/undefined)
        const message =
          typeof parsed.message === "string"
            ? parsed.message
            : String(parsed.message || "");

        // Ensure actions is an array (handle null/undefined/invalid types)
        const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

        return {
          success: true,
          data: {
            message,
            actions,
          },
        };
      }

      return {
        success: false,
        error: "Invalid JSON structure - missing 'message' field",
        parsedKeys: Object.keys(parsed),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to parse JSON",
        rawResponse: rawResponse.substring(0, 500),
      };
    }
  }
}

// Export singleton instance for convenience
export const jsonParser = JsonParser;
