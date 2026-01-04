import { systemPromptBuilder } from "../systemPromptBuilder.js";
// Simple inline data fetcher (replaces deleted dataFetcher)
const dataFetcher = {
  smartMemberFetch: async (guild, userMessage) => {
    const needsFetch = userMessage.toLowerCase().includes("member");
    if (!needsFetch) {
      return { fetched: false, reason: "Not needed" };
    }
    try {
      const before = guild.members.cache.size;
      await guild.members.fetch();
      const after = guild.members.cache.size;
      return {
        fetched: true,
        fetchedCount: after - before,
        cached: after,
        total: guild.memberCount,
      };
    } catch (error) {
      return { fetched: false, reason: error.message };
    }
  },
};
import { AI_STATUS_MESSAGES } from "../statusMessages.js";
import { getLogger } from "../../logger.js";

const logger = getLogger();

/**
 * Detect if user message suggests an action should be performed
 * This is a general detection that works for ALL actions, not just specific ones
 * @param {string} userMessage - User's message
 * @param {import('discord.js').Client} client - Discord client (optional, for command name checking)
 * @returns {Promise<boolean>} True if message suggests an action should be performed
 */
export async function detectActionRequest(userMessage, client = null) {
  if (!userMessage || typeof userMessage !== "string") {
    return false;
  }

  const userMessageLower = userMessage.toLowerCase().trim();

  // Common action verbs that suggest the user wants something done
  const actionVerbs = [
    "play",
    "execute",
    "run",
    "show",
    "get",
    "fetch",
    "create",
    "add",
    "remove",
    "delete",
    "kick",
    "ban",
    "timeout",
    "warn",
    "send",
    "pin",
    "unpin",
    "modify",
    "change",
    "update",
    "set",
    "give",
    "take",
    "grant",
    "revoke",
    "challenge",
    "start",
    "begin",
    "do",
    "make",
    "perform",
    "carry out",
  ];

  // Check if message starts with or contains action verbs
  const startsWithAction = actionVerbs.some(
    verb =>
      userMessageLower.startsWith(verb) ||
      userMessageLower.startsWith(`let's ${verb}`) ||
      userMessageLower.startsWith(`let us ${verb}`),
  );

  // Check if message contains action verbs followed by common objects/commands
  const containsActionPattern = actionVerbs.some(verb => {
    const verbIndex = userMessageLower.indexOf(verb);
    if (verbIndex === -1) return false;

    // Check if verb is followed by something (not just standalone)
    const afterVerb = userMessageLower
      .substring(verbIndex + verb.length)
      .trim();
    return afterVerb.length > 0 && !afterVerb.startsWith("?");
  });

  // Check for imperative patterns (commands/directives)
  const imperativePatterns = [
    /^(please\s+)?(can you|could you|would you|will you)\s+/i,
    /^(please\s+)?(do|make|show|get|fetch|execute|run|play)\s+/i,
    /^(let's|let us)\s+/i,
    /^(i want|i need|i'd like)\s+/i,
  ];
  const isImperative = imperativePatterns.some(pattern =>
    pattern.test(userMessage),
  );

  // Check if message mentions command names (if client is available)
  let mentionsCommand = false;
  if (client?.commands) {
    try {
      // Get command names from client
      const commandNames = Array.from(client.commands.keys());
      mentionsCommand = commandNames.some(
        cmdName =>
          userMessageLower.includes(cmdName.toLowerCase()) ||
          userMessageLower.includes(`/${cmdName}`),
      );
    } catch (_error) {
      // Ignore errors
    }
  }

  // Check for action-related keywords
  const actionKeywords = [
    "command",
    "action",
    "again",
    "retry",
    "another",
    "next",
    "more",
    "serverinfo",
    "userinfo",
    "avatar",
    "poll",
    "rps",
    "rock",
    "paper",
    "scissors",
    "leaderboard",
    "level",
    "xp",
    "members",
    "roles",
    "channels",
  ];
  const hasActionKeywords = actionKeywords.some(keyword =>
    userMessageLower.includes(keyword),
  );

  // Return true if any indicator suggests an action
  return (
    startsWithAction ||
    containsActionPattern ||
    isImperative ||
    mentionsCommand ||
    hasActionKeywords
  );
}

/**
 * Prepare system context and log summary
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').Client} client - Discord client
 * @param {string} userMessage - User's message
 * @param {Object} options - Options with userId, locale, user, onStatus
 * @returns {Promise<string>} System message
 */
export async function prepareSystemContextAndLog(
  guild,
  client,
  userMessage,
  options = {},
) {
  const { userId, locale, user, onStatus } = options;

  if (onStatus) await onStatus(AI_STATUS_MESSAGES.PREPARING);
  const systemMessage = await systemPromptBuilder.buildSystemContext(
    guild,
    client,
    userMessage,
    locale || "en-US",
    user || null,
    { userId },
  );

  // Log system context summary (debug level)
  logger.debug(
    `[AI] Context: User ${userId || "unknown"} | Guild: ${guild?.name || "DM"} | Prompt: ${systemMessage.length} chars`,
  );
  if (guild) {
    const memberCount = guild.members.cache.filter(m => !m.user.bot).size;
    const roleCount = guild.roles.cache.size;
    const channelCount = guild.channels.cache.size;
    logger.debug(
      `[AI] Server context: ${memberCount} members, ${roleCount} roles, ${channelCount} channels`,
    );

    // Check if member list is in the prompt
    const hasMemberList = systemMessage.includes(
      "COMPLETE LIST OF HUMAN MEMBER NAMES",
    );
    if (hasMemberList) {
      // Extract the member list section - look for the section until next section or end
      const memberListMatch = systemMessage.match(
        /COMPLETE LIST OF HUMAN MEMBER NAMES[\s\S]*?(?=\n\n##|\n\n━━|$)/,
      );
      if (memberListMatch) {
        const memberListSection = memberListMatch[0];
        // Match list items - handle various formats:
        // "- name", "1. name", "- name 🟢 (status)", etc.
        // Use multiline flag and match across lines
        const memberLines =
          memberListSection.match(/^\s*[-•*]\s+.+$/gm) ||
          memberListSection.match(/^\s*\d+\.\s+.+$/gm) ||
          [];
        const memberNames = memberLines.length;

        if (memberNames > 0) {
          logger.debug(`[AI] Member list in prompt: ${memberNames} members`);
        }
      }
    }
  }

  return systemMessage;
}

/**
 * Perform smart member fetching based on user query
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {string} userMessage - User's message
 * @param {Function} onStatus - Optional status callback
 * @returns {Promise<Object>} Fetch result
 */
export async function performSmartMemberFetch(
  guild,
  userMessage,
  onStatus = null,
) {
  if (!guild || !userMessage) {
    return { fetched: false, reason: "No guild or message" };
  }

  if (onStatus) await onStatus(AI_STATUS_MESSAGES.CHECKING_SERVER);
  const fetchResult = await dataFetcher.smartMemberFetch(guild, userMessage);
  if (fetchResult.fetched) {
    logger.debug(
      `[generateResponse] Auto-fetched ${fetchResult.fetchedCount} members (${fetchResult.cached}/${fetchResult.total} cached)`,
    );
  } else {
    logger.debug(
      `[generateResponse] Smart fetch skipped: ${fetchResult.reason} (${fetchResult.cached || 0}/${fetchResult.total || 0} cached)`,
    );
  }
  return fetchResult;
}
