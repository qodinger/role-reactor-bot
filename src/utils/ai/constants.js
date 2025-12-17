/**
 * Shared constants for AI modules
 */

// Conversation management constants
export const DEFAULT_MAX_HISTORY_LENGTH = 20;
export const DEFAULT_CONVERSATION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days
export const DEFAULT_MAX_CONVERSATIONS = 1000;

// Member fetching constants
export const MEMBER_FETCH_TIMEOUT = 5000; // 5 seconds
export const MAX_MEMBER_FETCH_SERVER_SIZE = 1000;
export const MAX_MEMBERS_TO_DISPLAY = 50;

// Response length constants
export const MAX_RESPONSE_LENGTH = 2000; // Discord embed limit is 4096, but we use 2000 for safety
export const DEFAULT_RESPONSE_LENGTH = 500; // Default concise response length

// System prompt cache constants
export const SYSTEM_MESSAGE_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
export const MAX_SYSTEM_CACHE_SIZE = 500;

// Follow-up query timeout
export const FOLLOW_UP_QUERY_TIMEOUT = 30000; // 30 seconds for follow-up queries

// JSON parsing patterns
export const JSON_MARKDOWN_PATTERNS = {
  jsonBlock: /^```json\s*/i,
  codeBlock: /^```\s*/i,
  closingBlock: /\s*```$/i,
  jsonObject: /\{[\s\S]*\}/,
};
