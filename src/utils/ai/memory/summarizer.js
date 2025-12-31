import { getLogger } from "../../logger.js";
import { multiProviderAIService } from "../multiProviderAIService.js";

const logger = getLogger();

/**
 * Summarizes conversations to reduce token usage while preserving important context
 */
export class ConversationSummarizer {
  constructor() {
    this.aiService = multiProviderAIService;
  }

  /**
   * Summarize a conversation, preserving important facts and context
   * @param {Array} messages - Array of message objects with role and content
   * @param {string|null} existingSummary - Previous summary to update (optional)
   * @returns {Promise<string>} Summary of the conversation
   */
  async summarizeConversation(messages, existingSummary = null) {
    if (!messages || messages.length === 0) {
      return existingSummary || "";
    }

    try {
      const prompt = this.buildSummarizationPrompt(messages, existingSummary);

      const summary = await this.aiService.generate({
        type: "text",
        prompt,
        config: {
          maxTokens: 300, // Keep summaries concise
          temperature: 0.3, // More deterministic for summaries
        },
      });

      return summary.trim();
    } catch (error) {
      logger.error("Failed to summarize conversation:", error);
      // Fallback: return existing summary or empty
      return existingSummary || "";
    }
  }

  /**
   * Build the summarization prompt
   * @param {Array} messages - Messages to summarize
   * @param {string|null} existingSummary - Previous summary (if updating)
   * @returns {string} Prompt for summarization
   */
  buildSummarizationPrompt(messages, existingSummary = null) {
    const formattedMessages = this.formatMessages(messages);

    if (existingSummary) {
      return `You are summarizing a conversation. Update the existing summary with new information while keeping important context.

Previous summary:
${existingSummary}

New messages to add:
${formattedMessages}

Create an updated summary that:
- Preserves all important facts and information from the previous summary
- Adds new important information from the new messages
- Removes redundant or less important details
- Keeps user preferences, context, and key decisions
- Maintains a concise format (under 300 words)

Updated summary:`;
    }

    return `Summarize this conversation, preserving important information while keeping it concise.

Conversation:
${formattedMessages}

Create a summary that includes:
- Important facts and information mentioned
- User preferences and context (timezone, language, etc.)
- Key decisions or actions taken
- Important details that should be remembered for future conversations
- Keep it concise (under 300 words)

Summary:`;
  }

  /**
   * Format messages for summarization
   * @param {Array} messages - Array of message objects
   * @returns {string} Formatted message string
   */
  formatMessages(messages) {
    return messages
      .filter(m => m.role !== "system") // Exclude system messages
      .map(m => {
        const role = m.role === "user" ? "User" : "Assistant";
        return `${role}: ${m.content}`;
      })
      .join("\n\n");
  }

  /**
   * Check if a conversation should be summarized
   * @param {number} messageCount - Number of messages in conversation
   * @param {number} threshold - Threshold for summarization (default: 10)
   * @returns {boolean} True if should summarize
   */
  shouldSummarize(messageCount, threshold = 10) {
    return messageCount > threshold;
  }
}
