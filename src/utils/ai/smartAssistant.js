/**
 * Smart Assistant
 *
 * A modern, effective approach that leverages the LLM's natural
 * language understanding instead of complex custom logic.
 */

import { getLogger } from "../logger.js";
import { chatService } from "./chatService.js";

const logger = getLogger();

export class SmartAssistant {
  constructor() {
    this.conversationMemory = new Map(); // Simple conversation tracking
    this.serverContextCache = new Map(); // Basic server context caching
    this.initialized = true; // Always ready
  }

  /**
   * Process message with smart assistance
   * Uses the LLM itself for intent recognition and response strategy
   */
  async processMessage(userMessage, guild, client, options = {}) {
    try {
      // Build enhanced system prompt with smart context
      const smartSystemPrompt = await this._buildSmartSystemPrompt(
        userMessage,
        guild,
        client,
        options,
      );

      // Use existing chat service with enhanced prompt
      const response = await chatService.generateResponse(
        userMessage,
        guild,
        client,
        {
          ...options,
          systemMessage: smartSystemPrompt,
          smartMode: true,
        },
      );

      // Update conversation memory
      this._updateConversationMemory(
        options.userId,
        guild?.id,
        userMessage,
        response,
      );

      return response;
    } catch (error) {
      logger.error("[SmartAssistant] Error processing message:", error);

      // Fallback to regular chat service
      return await chatService.generateResponse(
        userMessage,
        guild,
        client,
        options,
      );
    }
  }

  /**
   * Build smart system prompt that leverages LLM capabilities
   */
  async _buildSmartSystemPrompt(userMessage, guild, client, options) {
    try {
      // Get base system prompt
      const { systemPromptBuilder } = await import("./systemPromptBuilder.js");
      const basePrompt = await systemPromptBuilder.buildSystemContext(
        guild,
        client,
        userMessage,
        options.locale || "en-US",
        options.user,
      );

      // Add smart assistant enhancements
      const smartEnhancements = this._buildSmartEnhancements(
        userMessage,
        guild,
        options,
      );

      return `${basePrompt}

${smartEnhancements}`;
    } catch (error) {
      logger.warn(
        "[SmartAssistant] Error building smart prompt, using fallback:",
        error,
      );

      // Fallback to basic smart prompt
      return this._buildFallbackSmartPrompt(userMessage, guild, options);
    }
  }

  /**
   * Build fallback smart prompt if systemPromptBuilder fails
   */
  _buildFallbackSmartPrompt(userMessage, guild, options) {
    const serverInfo = guild
      ? `Server: ${guild.name} (${guild.memberCount || 0} members)`
      : "Direct Message";

    return `You are a helpful Discord bot assistant.

## Current Context
${serverInfo}
User: ${options.user?.username || "User"}

## Smart Response Instructions
- If the user is asking "how to" do something, provide step-by-step instructions
- If the user mentions a problem, offer specific solutions
- If the user seems new or confused, be extra helpful and explain things clearly
- If the user is asking about server setup, consider their server size and suggest appropriate approaches
- Always be proactive - if you see an opportunity to help beyond their question, mention it briefly

## Response Style
- Be helpful and direct
- Provide specific examples when possible
- If giving instructions, break them into clear steps
- If multiple approaches exist, briefly mention the best option for their situation`;
  }

  /**
   * Build smart enhancements using simple, effective patterns
   */
  _buildSmartEnhancements(userMessage, guild, options) {
    const enhancements = [];

    // Add conversation context if available
    const conversationContext = this._getConversationContext(
      options.userId,
      guild?.id,
    );
    if (conversationContext) {
      enhancements.push(`## Conversation Context
Previous interaction: ${conversationContext.lastMessage}
User seems to be: ${conversationContext.userPattern}
`);
    }

    // Add server-specific guidance
    if (guild) {
      const serverGuidance = this._getServerGuidance(guild);
      enhancements.push(`## Server-Specific Guidance
${serverGuidance}
`);
    }

    // Add smart response instructions
    enhancements.push(`## Smart Response Instructions
- If the user is asking "how to" do something, provide step-by-step instructions
- If the user mentions a problem, offer specific solutions
- If the user seems new or confused, be extra helpful and explain things clearly
- If the user is asking about server setup, consider their server size and suggest appropriate approaches
- Always be proactive - if you see an opportunity to help beyond their question, mention it briefly

## Response Style
- Be helpful and direct
- Provide specific examples when possible
- If giving instructions, break them into clear steps
- If multiple approaches exist, briefly mention the best option for their situation
`);

    return enhancements.join("\n");
  }

  /**
   * Get conversation context (simple approach)
   */
  _getConversationContext(userId, guildId) {
    if (!userId || !guildId) return null;

    const key = `${userId}_${guildId}`;
    const context = this.conversationMemory.get(key);

    if (!context) return null;

    // Check if context is recent (within 30 minutes)
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    if (context.timestamp < thirtyMinutesAgo) {
      this.conversationMemory.delete(key);
      return null;
    }

    return context;
  }

  /**
   * Update conversation memory (simple approach)
   */
  _updateConversationMemory(userId, guildId, userMessage, _response) {
    if (!userId || !guildId) return;

    const key = `${userId}_${guildId}`;

    // Determine user pattern from message
    let userPattern = "experienced";
    if (
      userMessage.toLowerCase().includes("how") ||
      userMessage.toLowerCase().includes("help") ||
      userMessage.toLowerCase().includes("don't know")
    ) {
      userPattern = "needs guidance";
    }

    this.conversationMemory.set(key, {
      lastMessage: userMessage.substring(0, 100), // Keep it short
      userPattern,
      timestamp: Date.now(),
    });

    // Clean up old entries (keep memory usage reasonable)
    if (this.conversationMemory.size > 1000) {
      const oldestEntries = Array.from(this.conversationMemory.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 200); // Remove oldest 200 entries

      oldestEntries.forEach(([key]) => this.conversationMemory.delete(key));
    }
  }

  /**
   * Get server-specific guidance
   */
  _getServerGuidance(guild) {
    const memberCount = guild.memberCount || 0;
    const guidance = [];

    if (memberCount < 50) {
      guidance.push(
        "- This is a small server - suggest simple, easy-to-manage solutions",
      );
      guidance.push("- Focus on essential features rather than complex setups");
    } else if (memberCount < 200) {
      guidance.push(
        "- This is a medium-sized server - balanced approach to features",
      );
      guidance.push("- Can suggest moderate complexity solutions");
    } else {
      guidance.push(
        "- This is a large server - can handle more complex setups",
      );
      guidance.push("- Consider scalability and moderation needs");
    }

    // Check for common server features
    const hasRoles = guild.roles?.cache?.size > 1;
    const hasChannels = guild.channels?.cache?.size > 1;

    if (!hasRoles) {
      guidance.push(
        "- Server has minimal roles - might need role setup guidance",
      );
    }

    if (!hasChannels) {
      guidance.push(
        "- Server has minimal channels - might need channel organization help",
      );
    }

    return guidance.join("\n");
  }

  /**
   * Get component status (simplified)
   */
  getComponentStatus() {
    return {
      simplified: true,
      initialized: this.initialized,
      conversationMemorySize: this.conversationMemory.size,
      serverContextCacheSize: this.serverContextCache.size,
      status: "healthy",
    };
  }

  /**
   * Check if ready (always true for simplified version)
   */
  isReady() {
    return true;
  }

  /**
   * Initialize (no-op for simplified version)
   */
  async initialize() {
    this.initialized = true;
    return true;
  }
}

// Export singleton
export const smartAssistant = new SmartAssistant();
export default smartAssistant;
