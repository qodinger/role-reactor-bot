import { actionExecutor } from "../actionExecutor.js";
import { actionTriggersReQuery } from "../actionRegistry.js";
import {
  TOOL_DEFINITIONS,
  translateToolCallsToActions,
} from "../toolDefinitions.js";
import { AI_STATUS_MESSAGES } from "../statusMessages.js";
import { systemPromptBuilder } from "../systemPromptBuilder.js";
import { conversationManager } from "../conversationManager.js";
import { checkAICredits } from "../aiCreditManager.js";
import {
  FOLLOW_UP_QUERY_TIMEOUT,
  MAX_ACTION_LOOP_DEPTH,
  TOKEN_BUDGET_OUTPUT_SOFT_LIMIT,
} from "../constants.js";
import { getLogger } from "../../logger.js";
import { followUpTemplate } from "../../../config/prompts/chat/responses.js";

const logger = getLogger();

// Follow-up prompt template (from config/prompts system)
async function getFollowUpPromptTemplate() {
  return followUpTemplate;
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

  let currentActions = actions;
  let response = finalResponse;
  let responseSuppressed = false;
  let depth = 0;

  const emitStatus = async text => {
    if (context.onStatus) {
      try {
        await context.onStatus(text);
      } catch (_e) {
        // status is best-effort UI feedback — never break the flow
      }
    }
  };

  while (currentActions.length > 0 && guild) {
    try {
      // Show what the tools are about to do (slow web/data steps)
      const typeSet = new Set(currentActions.map(a => a.type));
      if (typeSet.has("fetch_page")) {
        await emitStatus(AI_STATUS_MESSAGES.READING_PAGE);
      } else if (typeSet.has("web_search")) {
        await emitStatus(AI_STATUS_MESSAGES.SEARCHING_WEB);
      } else if (
        ["fetch_channels", "fetch_roles", "fetch_all"].some(t => typeSet.has(t))
      ) {
        await emitStatus(AI_STATUS_MESSAGES.FETCHING_SERVER_DATA);
      }

      // Execute actions and collect results (results stay index-aligned with actions)
      const actionResult = await executeStructuredActions(
        currentActions,
        guild,
        client,
        user,
        channel,
      );
      const results = actionResult.results;

      const reQueryActions = [];
      const reQueryResults = [];
      const otherActions = [];
      const otherResults = [];
      currentActions.forEach((a, i) => {
        if (actionTriggersReQuery(a.type)) {
          reQueryActions.push(a);
          reQueryResults.push(results[i]);
        } else {
          otherActions.push(a);
          otherResults.push(results[i]);
        }
      });

      // Process non-re-query actions (commands, read-only data) in this iteration
      if (otherActions.length > 0) {
        const sub = await processNonFetchActions(
          otherActions,
          otherResults,
          response,
          userId,
          guildId,
          addToHistory,
        );
        response = sub.finalResponse;
        responseSuppressed = sub.responseSuppressed;
      }

      if (reQueryActions.length === 0) {
        return { finalResponse: response, responseSuppressed };
      }

      // Loop guard: stop re-querying once the configured depth is exhausted
      if (depth >= MAX_ACTION_LOOP_DEPTH) {
        logger.warn(
          `[processActionsAndReQuery] ⚠️ Max action loop depth (${MAX_ACTION_LOOP_DEPTH}) reached; further re-query actions are ignored.`,
        );
        return { finalResponse: response, responseSuppressed };
      }
      depth++;
      await emitStatus(AI_STATUS_MESSAGES.SYNTHESIZING_FINDINGS);

      // Re-query with updated context; continue looping with any new actions
      const reQueryResult = await executeReQuery(
        reQueryActions,
        reQueryResults,
        response,
        context,
        services,
      );
      response = reQueryResult.finalResponse;
      currentActions = reQueryResult.actions || [];
    } catch (error) {
      logger.error("Error executing structured actions:", error);
      return { finalResponse: response, responseSuppressed };
    }
  }

  return { finalResponse: response, responseSuppressed };
}

/**
 * Execute re-query with updated context after fetch actions
 * @param {Array} fetchActions - Actions that triggered re-query
 * @param {Array} actionResults - Results from action execution
 * @param {string} finalResponse - Current AI response
 * @param {Object} context - Context object
 * @param {Object} services - Services object
 * @returns {Promise<{finalResponse: string, actions: Array}>}
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
    initialOutputTokens = 0,
  } = context;
  const { aiService, parseAIResponse, deductCreditsIfNeeded } = services;

  logger.debug(
    `[generateResponse] Re-querying after actions: ${fetchActions.map(a => a.type).join(", ")}`,
  );

  // Guard: skip the re-query (and its API cost) if the user is out of credits.
  // They already received a response from the initial call — this just prevents a
  // free second API call when their balance hits zero between the two calls.
  if (userId) {
    const creditCheck = await checkAICredits(userId);
    if (!creditCheck.hasCredits) {
      logger.warn(
        `[executeReQuery] Skipping re-query for ${userId}: insufficient credits (${creditCheck.credits} < ${creditCheck.creditsNeeded})`,
      );
      return { finalResponse };
    }
  }

  // Determine what data to force include based on action types
  // Note: fetch_members has been removed - no longer supported

  // Rebuild system context with freshly fetched/updated data
  const updatedSystemMessage = await systemPromptBuilder.buildSystemContext(
    guild,
    client,
    userMessage,
    locale || "en-US",
    user || null,
    {
      forceIncludeMemberList: fetchActions.some(a => a.type === "fetch_all"),
    },
  );

  // Get updated conversation history
  const updatedHistory = await conversationManager.getConversationHistory(
    userId,
    guildId,
  );

  // Build messages array with updated context.
  // Note: the provider prepends config.systemMessage, so we don't push it here
  // (previously the system prompt was sent twice, doubling token cost).
  const updatedMessages = [];
  const hasSystemMessage =
    updatedHistory.length > 0 && updatedHistory[0]?.role === "system";
  const startIndex = hasSystemMessage ? 1 : 0;
  for (let i = startIndex; i < updatedHistory.length; i++) {
    updatedMessages.push({
      role: updatedHistory[i].role,
      content: updatedHistory[i].content,
    });
  }

  // Add user message if not already present in history
  const lastHistoryMessage = updatedHistory[updatedHistory.length - 1];
  if (
    lastHistoryMessage?.content !== userMessage ||
    lastHistoryMessage?.role !== "user"
  ) {
    updatedMessages.push({ role: "user", content: userMessage });
  }

  // Add AI's previous response (containing the actions)
  updatedMessages.push({
    role: "assistant",
    content: finalResponse,
  });

  // Build follow-up prompt with action results
  let followUpPrompt = await getFollowUpPromptTemplate();
  if (actionResults && actionResults.length > 0) {
    const isError = r =>
      r.startsWith("Error:") ||
      r.startsWith("Command Error:") ||
      r.startsWith("Web search failed") ||
      r.startsWith("Web search error") ||
      r.startsWith("Web search blocked") ||
      r.includes("not configured") ||
      r.startsWith("No web results") ||
      r.startsWith("No members found") ||
      r.startsWith("No selection") ||
      r.includes("Failed to execute") ||
      r.includes("Cannot");

    const errorResults = actionResults.filter(isError);
    const successResults = actionResults.filter(
      r =>
        !errorResults.includes(r) &&
        (r.startsWith("Success:") ||
          r.startsWith("Command Result:") ||
          r.includes("successfully")),
    );
    const dataResults = actionResults.filter(
      r =>
        !errorResults.includes(r) &&
        !successResults.includes(r) &&
        (r.startsWith("Data:") || r.startsWith("Found:")),
    );
    // Anything the model produced that fits no known prefix (e.g. raw tool
    // output like "Fetched all channels", or unexpected strings) must still
    // reach the model — dropping it would make the AI hallucinate the result.
    const otherResults = actionResults.filter(
      r =>
        !errorResults.includes(r) &&
        !successResults.includes(r) &&
        !dataResults.includes(r),
    );

    if (errorResults.length > 0) {
      followUpPrompt += `\n\n**IMPORTANT - Action Results (Errors/Failures Occurred):**\n${errorResults.map(r => `- ${r}`).join("\n")}\n\n**The tool did NOT succeed.** You MUST inform the user honestly about what failed (e.g. web search unavailable/no results). Do NOT fabricate results as if the search worked — answer from what you genuinely know and clearly say you could not verify it live.`;
    }

    if (successResults.length > 0) {
      followUpPrompt += `\n\n**Action Results (Success):**\n${successResults.map(r => `- ${r}`).join("\n")}\n\n**You can mention this success to the user if relevant.**`;
    }

    if (dataResults.length > 0) {
      followUpPrompt += `\n\n**Data Retrieved:**\n${dataResults.map(r => `- ${r}`).join("\n")}\n\n**Incorporate this information cleanly into your answer.**`;
    }

    if (otherResults.length > 0) {
      followUpPrompt += `\n\n**Other Action Results:**\n${otherResults.map(r => `- ${r}`).join("\n")}\n\n**Reflect these outcomes accurately in your answer.**`;
    }
  }

  updatedMessages.push({
    role: "user",
    content: followUpPrompt,
  });

  // Token budget: if the initial response was already large, give a tighter cap
  // to the re-query to keep total costs predictable.
  const tokensTight = initialOutputTokens > TOKEN_BUDGET_OUTPUT_SOFT_LIMIT;
  const reQueryMaxTokens = tokensTight ? 300 : wantsDetail ? 800 : 500;
  if (tokensTight) {
    logger.debug(
      `[executeReQuery] Token budget tight (${initialOutputTokens} output tokens), capping re-query at ${reQueryMaxTokens}`,
    );
    updatedMessages[updatedMessages.length - 1].content +=
      "\n\n[Token budget is tight — be concise.]";
  }

  // Re-query AI with updated context (with timeout)
  const followUpPromise = aiService.generate({
    type: "text",
    prompt: updatedMessages,
    config: {
      systemMessage: updatedSystemMessage,
      temperature: 0.7,
      maxTokens: reQueryMaxTokens,
      forceJson: true,
      tools: TOOL_DEFINITIONS,
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
    // Synthesis failed — the initial text may read like an intro promising a
    // lookup; append an honest footer so the user isn't left with a dangling
    // "let me search that for you…" and no answer.
    followUpResult = {
      text: finalResponse
        ? `${finalResponse}\n\n_I couldn't finish verifying that live — the above may be out of date._`
        : "I couldn't complete that — something went wrong while checking. Please try again.",
    };
  }

  // Structured tool_calls path (preferred): return actions for the loop to execute
  if (followUpResult?.toolCalls?.length > 0) {
    logger.debug(
      `[generateResponse] Re-query returned ${followUpResult.toolCalls.length} tool call(s)`,
    );
    return {
      finalResponse: followUpResult.text || finalResponse,
      actions: translateToolCallsToActions(followUpResult.toolCalls),
    };
  }

  const followUpResponse =
    followUpResult?.text || followUpResult?.response || finalResponse;

  // Parse follow-up response (legacy JSON path)
  const followUpParsed = parseAIResponse(followUpResponse);
  if (followUpParsed.success) {
    logger.debug(`[generateResponse] Follow-up response generated`);
    return {
      finalResponse: followUpParsed.message,
      actions: followUpParsed.actions || [],
    };
  }

  logger.warn(
    `[generateResponse] Follow-up response parse failed - using raw response`,
  );
  return { finalResponse: followUpResponse, actions: [] };
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
