/**
 * Shared constants for AI modules
 */

// Conversation management constants
export const DEFAULT_MAX_HISTORY_LENGTH = 20;
export const DEFAULT_CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_MAX_CONVERSATIONS = 1000;
export const DEFAULT_USER_RATE_LIMIT = 30; // 30 requests
export const DEFAULT_USER_RATE_WINDOW = 60 * 1000; // per 1 minute

// Response length constants
export const MAX_RESPONSE_LENGTH = 2000; // Discord embed limit is 4096, but we use 2000 for safety
export const DEFAULT_RESPONSE_LENGTH = 500; // Default concise response length

// System prompt cache constants
export const SYSTEM_MESSAGE_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
export const MAX_SYSTEM_CACHE_SIZE = 500;

// Follow-up query timeout
export const FOLLOW_UP_QUERY_TIMEOUT = 30000; // 30 seconds for follow-up queries

// Action loop depth - max re-queries before stopping (prevents infinite loops)
export const MAX_ACTION_LOOP_DEPTH =
  parseInt(process.env.AI_MAX_ACTION_LOOP_DEPTH) || 1; // Default: 1 re-query (2 API calls total)

// Performance monitoring constants
export const PERFORMANCE_METRICS_ENABLED = true;
export const PERFORMANCE_LOG_THRESHOLD = 3000; // Log if response time > 3 seconds
export const MAX_METRICS_HISTORY = 1000; // Keep last 1000 metrics

// Provider fallback constants
export const PROVIDER_FALLBACK_ENABLED = true;
export const PROVIDER_RETRY_ATTEMPTS = 2; // Retry with next provider
export const PROVIDER_RETRY_DELAY = 1000; // 1 second delay between retries

// Response streaming constants
export const STREAMING_ENABLED =
  process.env.AI_STREAMING_ENABLED === "true" || false;
export const STREAMING_UPDATE_INTERVAL =
  parseInt(process.env.AI_STREAMING_UPDATE_INTERVAL) || 500; // ms
export const STREAMING_MIN_CHUNK_SIZE =
  parseInt(process.env.AI_STREAMING_MIN_CHUNK_SIZE) || 10; // characters

// JSON parsing patterns
export const JSON_MARKDOWN_PATTERNS = {
  jsonBlock: /^```json\s*/i,
  codeBlock: /^```\s*/i,
  closingBlock: /\s*```$/i,
  jsonObject: /\{[\s\S]*\}/,
};

// Admin command safety - commands the AI should NEVER execute even for admins
// These are destructive/irreversible operations that require human intent
export const AI_ADMIN_COMMAND_BLOCKLIST = (
  process.env.AI_ADMIN_COMMAND_BLOCKLIST || ""
)
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Default blocklist if env var is not set
export const AI_DEFAULT_ADMIN_BLOCKLIST = [
  "moderation", // kick/ban/timeout - too destructive for AI
];

// Audit logging for AI actions
export const AI_AUDIT_LOGGING_ENABLED =
  process.env.AI_AUDIT_LOGGING !== "false"; // Enabled by default
