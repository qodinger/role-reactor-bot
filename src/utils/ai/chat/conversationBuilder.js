import { conversationManager } from "../conversationManager.js";

/**
 * Build messages array with system context, history, and user message
 * @param {string} userId - User ID
 * @param {string|null} guildId - Guild ID
 * @param {string} userMessage - User's message
 * @param {string} systemMessage - System context
 * @param {Array} history - Conversation history
 * @param {string} locale - User locale
 * @param {boolean} needsAction - Whether action reminder is needed
 * @param {Function} addToHistory - Function to add message to history
 * @param {boolean} addToHistoryFlag - Whether to add system message to history (default: true)
 * @returns {Promise<Array>} Messages array
 */
export async function buildMessagesArray(
  userId,
  guildId,
  userMessage,
  systemMessage,
  history,
  locale,
  needsAction,
  addToHistory,
  addToHistoryFlag = true,
) {
  const messages = [];

  // Handle system message and summary
  const hasSystemMessage = history.length > 0 && history[0]?.role === "system";
  const hasSummary =
    hasSystemMessage &&
    history[0]?.content?.includes("Previous conversation summary:");

  if (hasSystemMessage) {
    if (hasSummary) {
      messages.push(history[0]); // Add summary
      messages.push({ role: "system", content: systemMessage });
    } else {
      messages.push({ role: "system", content: systemMessage });
      // Update in memory only (system messages are not persisted to storage)
      if (history[0].content !== systemMessage) {
        history[0].content = systemMessage;
      }
    }
  } else {
    messages.push({ role: "system", content: systemMessage });
    // System messages are kept in memory only, not persisted to storage
    if (addToHistoryFlag) {
      await addToHistory(userId, guildId, {
        role: "system",
        content: systemMessage,
      });
    }
  }

  // Add conversation history (skip system/summary, already added)
  const startIndex = hasSystemMessage ? 1 : 0;
  for (let i = startIndex; i < history.length; i++) {
    messages.push({
      role: history[i].role,
      content: history[i].content,
    });
  }

  // Add user message with date/time context and action reminder
  const userLocale = locale || "en-US";
  const now = new Date();
  const userDate = now.toLocaleDateString(userLocale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const userTime = now.toLocaleTimeString(userLocale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const reminder = needsAction
    ? `[REMINDER: If you need to execute a command to fulfill this request, use JSON: {"message": "...", "actions": [...]}. If the information is already in context, respond in plain text — no JSON if actions array would be empty.]`
    : null;

  const userMessageWithContext = reminder
    ? `[Current Date and Time for User: ${userDate} at ${userTime}]\n\n${userMessage}\n\n${reminder}`
    : `[Current Date and Time for User: ${userDate} at ${userTime}]\n\n${userMessage}`;
  messages.push({ role: "user", content: userMessageWithContext });

  return messages;
}

/**
 * Prepare conversation context (history, action detection, messages array)
 * @param {string} userId - User ID
 * @param {string|null} guildId - Guild ID
 * @param {string} userMessage - User's message
 * @param {string} systemMessage - System context
 * @param {import('discord.js').Client} client - Discord client
 * @param {string} locale - User locale
 * @param {Function} onStatus - Optional status callback
 * @param {Function} detectActionRequest - Function to detect action requests
 * @param {Function} getConversationContext - Function to get conversation context
 * @param {Function} addToHistory - Function to add to history
 * @param {boolean} useMemoryManager - Whether to use memory manager (true) or conversation manager (false)
 * @returns {Promise<{history: Array, messages: Array, isActionRequest: boolean}>}
 */
export async function prepareConversationContext(
  userId,
  guildId,
  userMessage,
  systemMessage,
  client,
  locale,
  onStatus,
  detectActionRequest,
  getConversationContext,
  addToHistory,
  useMemoryManager = true,
) {
  // Get conversation context with summarization (if enabled)
  if (onStatus) {
    const { AI_STATUS_MESSAGES } = await import("../statusMessages.js");
    await onStatus(AI_STATUS_MESSAGES.REVIEWING_CONVERSATION);
  }
  const history = useMemoryManager
    ? await getConversationContext(userId, guildId)
    : await conversationManager.getConversationHistory(userId, guildId);

  // Detect if user is asking for an action
  const isActionRequest = await detectActionRequest(userMessage, client);

  // Build messages array with system context, history, and user message
  const messages = await buildMessagesArray(
    userId,
    guildId,
    userMessage,
    systemMessage,
    history,
    locale || "en-US",
    isActionRequest,
    addToHistory,
    true, // Add system message to history
  );

  return { history, messages, isActionRequest };
}
