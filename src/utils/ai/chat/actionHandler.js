import { actionExecutor } from "../actionExecutor.js";
import { actionTriggersReQuery } from "../actionRegistry.js";
import { systemPromptBuilder } from "../systemPromptBuilder.js";
import { conversationManager } from "../conversationManager.js";
import { FOLLOW_UP_QUERY_TIMEOUT } from "../constants.js";
import { getLogger } from "../../logger.js";
// Simple inline getPrompt function (replaces deleted prompts/index.js)
const getPrompt = async (category, promptName, variables = {}) => {
  if (category === "chat" && promptName === "followUpTemplate") {
    // Simple follow-up template
    let template =
      "I understand you'd like to continue our conversation. How can I help you further?";
    // Simple variable substitution
    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`{${key}}`, "g"), value);
    }
    return template;
  }
  return "How can I help you?";
};

const logger = getLogger();

// Follow-up prompt template (loaded dynamically with caching)
async function getFollowUpPromptTemplate(variables = {}) {
  return await getPrompt("chat", "followUpTemplate", variables);
}

/**
 * Execute structured actions from AI response
 * @param {Array} actions - Array of action objects
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client
 * @param {import('discord.js').User} user - User who triggered the action
 * @param {import('discord.js').Channel} channel - Channel where action was triggered
 * @returns {Promise<{results: Array<string>, commandResponses: Array<{command: string, response: object}>}>}
 */
export async function executeStructuredActions(
  actions,
  guild,
  client,
  user,
  channel,
) {
  return actionExecutor.executeStructuredActions(
    actions,
    guild,
    client,
    user,
    channel,
  );
}

/**
 * Process actions and handle re-query if needed
 * @param {Array} actions - Array of action objects
 * @param {string} finalResponse - Current AI response
 * @param {Object} context - Context object with guild, client, user, channel, userId, guildId, userMessage, locale, wantsDetail
 * @param {Object} services - Services object with aiService, parseAIResponse, deductCreditsIfNeeded, addToHistory
 * @returns {Promise<{finalResponse: string, responseSuppressed: boolean}>}
 */
export async function processActionsAndReQuery(
  actions,
  finalResponse,
  context,
  services,
) {
  const { guild, client, user, channel, userId, guildId } = context;
  const { addToHistory } = services;

  let actionResults = [];

  if (actions.length === 0 || !guild) {
    return { finalResponse, responseSuppressed: false };
  }

  try {
    // Execute actions and collect results
    const actionResult = await executeStructuredActions(
      actions,
      guild,
      client,
      user,
      channel,
    );
    actionResults = actionResult.results;

    // Check if any actions trigger re-query
    const fetchActions = actions.filter(a => actionTriggersReQuery(a.type));

    if (fetchActions.length > 0) {
      // Execute re-query with updated context
      const reQueryResult = await executeReQuery(
        fetchActions,
        actionResults,
        finalResponse,
        context,
        services,
      );
      return {
        finalResponse: reQueryResult.finalResponse,
        responseSuppressed: false,
      };
    } else {
      // Process non-fetch actions
      return await processNonFetchActions(
        actions,
        actionResults,
        finalResponse,
        userId,
        guildId,
        addToHistory,
      );
    }
  } catch (error) {
    logger.error("Error executing structured actions:", error);
    return { finalResponse, responseSuppressed: false };
  }
}

/**
 * Execute re-query with updated context after fetch actions
 * @param {Array} fetchActions - Actions that triggered re-query
 * @param {Array} actionResults - Results from action execution
 * @param {string} finalResponse - Current AI response
 * @param {Object} context - Context object
 * @param {Object} services - Services object
 * @returns {Promise<{finalResponse: string}>}
 */
export async function executeReQuery(
  fetchActions,
  actionResults,
  finalResponse,
  context,
  services,
) {
  const {
    guild,
    client,
    userId,
    guildId,
    userMessage,
    locale,
    wantsDetail,
    user,
  } = context;
  const { aiService, parseAIResponse, deductCreditsIfNeeded } = services;

  logger.debug(
    `[generateResponse] Re-querying after actions: ${fetchActions.map(a => a.type).join(", ")}`,
  );

  // Determine what data to force include based on action types
  const memberActions = fetchActions.filter(a => a.type === "fetch_members");

  // Rebuild system context with freshly fetched/updated data
  const updatedSystemMessage = await systemPromptBuilder.buildSystemContext(
    guild,
    client,
    userMessage,
    locale || "en-US",
    user || null,
    {
      userId,
      forceIncludeMemberList:
        memberActions.length > 0 ||
        fetchActions.some(a => a.type === "fetch_all"),
    },
  );

  // Get updated conversation history
  const updatedHistory = await conversationManager.getConversationHistory(
    userId,
    guildId,
  );

  // Build messages array with updated context
  const updatedMessages = [];
  const hasSystemMessage =
    updatedHistory.length > 0 && updatedHistory[0]?.role === "system";
  updatedMessages.push({
    role: "system",
    content: updatedSystemMessage,
  });

  const startIndex = hasSystemMessage ? 1 : 0;
  for (let i = startIndex; i < updatedHistory.length; i++) {
    updatedMessages.push({
      role: updatedHistory[i].role,
      content: updatedHistory[i].content,
    });
  }

  // Add user message and AI's previous response
  updatedMessages.push({ role: "user", content: userMessage });
  updatedMessages.push({
    role: "assistant",
    content: finalResponse,
  });

  // Build follow-up prompt with action results
  let followUpPrompt = await getFollowUpPromptTemplate();
  if (actionResults && actionResults.length > 0) {
    const errorResults = actionResults.filter(r => r.startsWith("Error:"));
    const successResults = actionResults.filter(r => r.startsWith("Success:"));

    if (errorResults.length > 0) {
      followUpPrompt += `\n\n**IMPORTANT - Action Results (Errors Occurred):**\n${errorResults.map(r => `- ${r}`).join("\n")}\n\n**You MUST inform the user about these errors.** Explain what went wrong and what data is available (if any).`;
    } else if (successResults.length > 0) {
      followUpPrompt += `\n\n**Action Results (Success):**\n${successResults.map(r => `- ${r}`).join("\n")}\n\n**You can mention this success to the user if relevant.**`;
    }
  }

  updatedMessages.push({
    role: "user",
    content: followUpPrompt,
  });

  // Re-query AI with updated context (with timeout)
  const followUpPromise = aiService.generate({
    type: "text",
    prompt: updatedMessages,
    config: {
      systemMessage: updatedSystemMessage,
      temperature: 0.7,
      maxTokens: wantsDetail ? 800 : 500,
      forceJson: true,
    },
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("Follow-up query timed out")),
      FOLLOW_UP_QUERY_TIMEOUT,
    );
  });

  let followUpResult;
  try {
    followUpResult = await Promise.race([followUpPromise, timeoutPromise]);

    // Deduct credits for re-query API call
    const reQueryText = followUpResult?.text || followUpResult?.response || "";
    if (reQueryText !== finalResponse) {
      await deductCreditsIfNeeded(userId, followUpResult, "re-query");
    }
  } catch (error) {
    logger.warn(
      `Re-query failed or timed out for user ${userId}: ${error.message}`,
    );
    followUpResult = { text: finalResponse };
  }

  const followUpResponse =
    followUpResult?.text || followUpResult?.response || finalResponse;

  // Parse follow-up response
  const followUpParsed = parseAIResponse(followUpResponse);
  if (followUpParsed.success) {
    finalResponse = followUpParsed.message;

    // SAFEGUARD: Check if re-query response contains actions that would trigger another re-query
    const followUpActions = followUpParsed.actions;
    const followUpReQueryActions = followUpActions.filter(a =>
      actionTriggersReQuery(a.type),
    );

    if (followUpReQueryActions.length > 0) {
      logger.warn(
        `[generateResponse] ⚠️ Re-query response contains actions that would trigger another re-query (${followUpReQueryActions.map(a => a.type).join(", ")}). Ignoring to prevent infinite loops. Maximum 2 API calls per request.`,
      );
    }

    logger.debug(`[generateResponse] Follow-up response generated`);
  } else {
    logger.warn(
      `[generateResponse] Follow-up response parse failed - using raw response`,
    );
    finalResponse = followUpResponse;
  }

  return { finalResponse };
}

/**
 * Process non-fetch actions (commands, data retrieval, etc.)
 * @param {Array} actions - Array of action objects
 * @param {Array} actionResults - Results from action execution
 * @param {string} finalResponse - Current AI response
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {Function} addToHistory - Function to add to history
 * @returns {Promise<{finalResponse: string, responseSuppressed: boolean}>}
 */
export async function processNonFetchActions(
  actions,
  actionResults,
  finalResponse,
  userId,
  guildId,
  addToHistory,
) {
  let responseSuppressed = false;

  const dataResults = actionResults.filter(
    r => r.startsWith("Data:") || r.startsWith("Found:"),
  );
  const commandResults = actionResults.filter(r =>
    r.startsWith("Command Result:"),
  );
  const statusResults = actionResults.filter(
    r =>
      !r.startsWith("Data:") &&
      !r.startsWith("Found:") &&
      !r.startsWith("Command Result:"),
  );

  // Handle command execution
  if (commandResults.length > 0) {
    logger.debug(
      `[generateResponse] Command executed - response sent by handler`,
    );

    // Store executed commands in LTM
    const executedCommands = actions
      .filter(a => a.type === "execute_command")
      .map(a => {
        const cmd = a.command;
        const subcmd = a.subcommand;
        const opts = a.options || {};
        let cmdStr = `/${cmd}`;
        if (subcmd) {
          cmdStr += ` ${subcmd}`;
        }
        const optStrings = Object.entries(opts)
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return `${key}:${value.join(",")}`;
            }
            return `${key}:${value}`;
          })
          .filter(Boolean);
        if (optStrings.length > 0) {
          cmdStr += ` ${optStrings.join(" ")}`;
        }
        return cmdStr;
      });

    if (executedCommands.length > 0) {
      const commandHistoryMessage = `[Action completed - do not retry: ${executedCommands.join(", ")}]`;
      await addToHistory(userId, guildId, {
        role: "assistant",
        content: commandHistoryMessage,
      });
      logger.debug(
        `[generateResponse] Stored command execution in LTM: ${commandHistoryMessage}`,
      );
    }

    // Suppress AI response when command executes successfully
    const hasErrorInfo =
      /error|failed|unable|cannot|issue|problem|exception|crash/i.test(
        finalResponse,
      );

    if (!hasErrorInfo) {
      finalResponse = "";
      responseSuppressed = true;
      logger.debug(
        `[generateResponse] Suppressed AI message (command executed)`,
      );
    }
  }

  // Add data results to response
  if (dataResults.length > 0) {
    finalResponse += `\n\n**Additional Information:**\n${dataResults.map(r => r.replace(/^(Data:|Found:)\s*/, "")).join("\n")}`;
  }

  // Handle error/status results
  if (statusResults.length > 0) {
    const errorMessages = statusResults.filter(
      r => r.includes("Error") || r.includes("Failed"),
    );
    if (errorMessages.length > 0) {
      if (!finalResponse) {
        finalResponse = "";
      }
      finalResponse += `\n\n**⚠️ Action Errors:**\n${errorMessages.join("\n")}`;

      // Store error information in LTM
      const errorHistoryMessage = `[Action completed with errors - do not retry: ${errorMessages.map(e => e.replace(/Command Error: /, "")).join("; ")}]`;
      await addToHistory(userId, guildId, {
        role: "assistant",
        content: errorHistoryMessage,
      });
      logger.debug(
        `[generateResponse] Stored command error in LTM for AI learning: ${errorHistoryMessage}`,
      );
    }
  }

  return { finalResponse, responseSuppressed };
}
