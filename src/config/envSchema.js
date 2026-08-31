import { z } from "zod";

const envSchema = z
  .object({
    // ── Required ──────────────────────────────────────────────
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
    DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),

    // ── Environment ───────────────────────────────────────────
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PERFORMANCE_MONITORING: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    MEMORY_THRESHOLD: z.coerce.number().default(768_000_000),

    // ── Server / API ──────────────────────────────────────────
    API_PORT: z.coerce.number().default(3030),
    SERVE_STATIC: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    DOCKER_ENV: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    DOCKER_HEALTH_CHECK: z
      .string()
      .transform(v => v === "true")
      .default("true"),
    HEALTH_CHECKS: z
      .string()
      .transform(v => v === "true")
      .default("true"),
    REQUEST_LOGGING: z
      .string()
      .transform(v => v === "true")
      .default("true"),

    // ── Discord Optional ──────────────────────────────────────
    DISCORD_GUILD_ID: z.string().optional(),
    DISCORD_DEVELOPERS: z.string().optional(),

    // ── Database ──────────────────────────────────────────────
    MONGODB_URI: z.string().optional(),
    MONGODB_DB: z.string().default("role-reactor-bot"),
    MONGODB_MAX_POOL_SIZE: z.coerce.number().default(5),
    MONGODB_MIN_POOL_SIZE: z.coerce.number().default(1),
    MONGODB_MAX_CONNECTING: z.coerce.number().default(2),

    // ── API Rate Limiting & CORS ──────────────────────────────
    API_RATE_LIMIT_MAX: z.coerce.number().default(100),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
    INTERNAL_API_KEY: z.string().optional(),
    PUBLIC_URL: z.string().optional(),
    BOT_URL: z.string().optional(),
    CORS_ALLOWED_ORIGINS: z.string().optional(),

    // ── Logging ───────────────────────────────────────────────
    LOG_LEVEL: z.enum(["ERROR", "WARN", "INFO", "DEBUG"]).default("INFO"),
    LOG_FILE: z.string().optional(),
    LOG_CONSOLE: z
      .string()
      .transform(v => v !== "false")
      .default("true"),

    // ── Auth ──────────────────────────────────────────────────
    DISCORD_CLIENT_SECRET: z.string().optional(),
    TOKEN_ENCRYPTION_KEY: z.string().optional(),
    SESSION_SECRET: z.string().optional(),

    // ── Streaming ─────────────────────────────────────────────
    TWITCH_STREAMING_ENABLED: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    TWITCH_REDIRECT_URI: z.string().optional(),
    TWITCH_BOT_USER_ID: z.string().optional(),
    TWITCH_BOT_LOGIN: z.string().optional(),
    TWITCH_BOT_ACCESS_TOKEN: z.string().optional(),
    TWITCH_BOT_REFRESH_TOKEN: z.string().optional(),
    KICK_STREAMING_ENABLED: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    KICK_CLIENT_ID: z.string().optional(),
    KICK_CLIENT_SECRET: z.string().optional(),
    KICK_REDIRECT_URI: z.string().optional(),
    YOUTUBE_STREAMING_ENABLED: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    YOUTUBE_CLIENT_ID: z.string().optional(),
    YOUTUBE_CLIENT_SECRET: z.string().optional(),
    YOUTUBE_REDIRECT_URI: z.string().optional(),

    // ── AI ────────────────────────────────────────────────────
    AI_USE_LONG_TERM_MEMORY: z
      .string()
      .transform(v => v === "true")
      .default("true"),
    AI_CONVERSATION_STORAGE_TYPE: z.string().default("mongodb"),
    AI_IMAGE_JOBS_STORAGE_TYPE: z.string().default("mongodb"),
    AI_IMAGE_JOBS_RETENTION_DAYS: z.coerce.number().default(7),
    AI_CONVERSATION_HISTORY_LENGTH: z.coerce.number().default(20),
    AI_CONVERSATION_TIMEOUT: z.coerce.number().default(604_800_000),
    AI_MAX_CONVERSATIONS: z.coerce.number().default(1000),
    AI_STREAMING_ENABLED: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    AI_MAX_CONCURRENT: z.coerce.number().default(5),
    AI_REQUEST_TIMEOUT: z.coerce.number().default(300_000),
    AI_USER_RATE_LIMIT: z.coerce.number().default(20),
    AI_USER_RATE_WINDOW: z.coerce.number().default(60_000),
    AI_RETRY_ATTEMPTS: z.coerce.number().default(2),
    AI_RETRY_DELAY: z.coerce.number().default(1000),
    AI_MAX_QUEUE_SIZE: z.coerce.number().default(100),
    AI_QUEUE_TIMEOUT: z.coerce.number().default(120_000),
    OPENROUTER_MAX_CONCURRENT: z.coerce.number().default(10),
    STABILITY_MAX_CONCURRENT: z.coerce.number().default(5),
    RUNPOD_MAX_CONCURRENT: z.coerce.number().default(2),
    RUNPOD_ENABLED: z
      .string()
      .transform(v => v === "true")
      .default("false"),

    // ── AI API Keys ───────────────────────────────────────────
    OPENROUTER_API_KEY: z.string().optional(),
    BRAVE_SEARCH_API_KEY: z.string().optional(),
    STABILITY_API_KEY: z.string().optional(),
    RUNPOD_API_KEY: z.string().optional(),
    RUNPOD_ENDPOINT_ID: z.string().optional(),
    CIVITAI_ENABLED: z
      .string()
      .transform(v => v === "true")
      .default("true"),
    CIVITAI_API_KEY: z.string().optional(),

    // ── Image Tools ───────────────────────────────────────────
    ILOVEPDF_PUBLIC_KEY: z.string().optional(),
    ILOVEPDF_SECRET_KEY: z.string().optional(),

    // ── Pricing ───────────────────────────────────────────────
    PRICE_CONVERSION_RATE: z.coerce.number().default(15),
    PRICE_PLATFORM_MARKUP: z.coerce.number().default(1.25),
    PRICE_MINIMUM_CHARGE: z.coerce.number().default(0.05),
    PRICE_CHAT_MIN: z.coerce.number().default(0.01),
    PRICE_CHAT_MAX: z.coerce.number().default(0.05),
    PRICE_CHAT_FALLBACK: z.coerce.number().default(0.01),
    PRICE_IMAGE_MIN: z.coerce.number().default(0.05),
    PRICE_IMAGE_FALLBACK: z.coerce.number().default(0.1),
    PRICE_IMAGE_DEFAULT: z.coerce.number().default(5.0),
    PRICE_CACHE_TTL_MS: z.coerce.number().default(3_600_000),

    // ── Image Provider Costs ──────────────────────────────────
    PRICE_STABILITY_LARGE: z.coerce.number().default(8.0),
    PRICE_STABILITY_LARGE_TURBO: z.coerce.number().default(5.0),
    PRICE_STABILITY_MEDIUM: z.coerce.number().default(4.0),
    PRICE_STABILITY_FLASH: z.coerce.number().default(5.0),
    PRICE_RUNPOD_DEFAULT: z.coerce.number().default(0.79),
    PRICE_CIVITAI_DEFAULT: z.coerce.number().default(0.01),
    PRICE_CIVITAI_ANIMAGINE: z.coerce.number().default(0.0068),
    PRICE_CIVITAI_ILLUSTRIOUS: z.coerce.number().default(0.0061),
    PRICE_CIVITAI_ANYTHING: z.coerce.number().default(0.005),
    PRICE_CIVITAI_PROTEUS: z.coerce.number().default(0.024),
    PRICE_OPENAI_GPT4O_MINI: z.coerce.number().default(0.08),
    PRICE_ANTHROPIC_SONNET: z.coerce.number().default(0.35),
    PRICE_DEEPSEEK_CHAT: z.coerce.number().default(0.08),
    PRICE_FLUX_FLEX: z.coerce.number().default(1.05),
    PRICE_FLUX_PRO: z.coerce.number().default(2.1),
    PRICE_STABILITY_COST_PER_TOKEN: z.coerce.number().default(0.00002),
    PRICE_RUNPOD_COST_PER_REQUEST: z.coerce.number().default(0.01),
    PRICE_CIVITAI_COST_PER_IMAGE: z.coerce.number().default(0.006),

    // ── Bulk Discounts ────────────────────────────────────────
    PRICE_DISCOUNT_TIER1_THRESHOLD: z.coerce.number().default(1000),
    PRICE_DISCOUNT_TIER1: z.coerce.number().default(0.03),
    PRICE_DISCOUNT_TIER2_THRESHOLD: z.coerce.number().default(2500),
    PRICE_DISCOUNT_TIER2: z.coerce.number().default(0.05),
    PRICE_DISCOUNT_TIER3_THRESHOLD: z.coerce.number().default(5000),
    PRICE_DISCOUNT_TIER3: z.coerce.number().default(0.08),

    // ── Loyalty ───────────────────────────────────────────────
    PRICE_LOYALTY_POINTS_PER_DOLLAR: z.coerce.number().default(1),
    PRICE_LOYALTY_TIER1_POINTS: z.coerce.number().default(100),
    PRICE_LOYALTY_TIER1_REWARD: z.string().default("3% bonus on next purchase"),
    PRICE_LOYALTY_TIER2_POINTS: z.coerce.number().default(250),
    PRICE_LOYALTY_TIER2_REWARD: z.string().default("5% bonus on next purchase"),
    PRICE_LOYALTY_TIER3_POINTS: z.coerce.number().default(500),
    PRICE_LOYALTY_TIER3_REWARD: z
      .string()
      .default("8% bonus + priority support"),

    // ── Dynamic Pricing ───────────────────────────────────────
    PRICE_PEAK_MULTIPLIER: z.coerce.number().default(1.2),
    PRICE_OFFPEAK_DISCOUNT: z.coerce.number().default(0.9),

    // ── Payments ──────────────────────────────────────────────
    TOPGG_WEBHOOK_AUTH: z.string().optional(),
    TOPGG_API_TOKEN: z.string().optional(),
    WEBSITE_URL: z.string().optional(),
    BOT_WEBSITE_URL: z.string().optional(),
    ALLOW_DM_WARNING: z
      .string()
      .transform(v => v === "true")
      .default("false"),
    PLISIO_SECRET_KEY: z.string().optional(),
    BUYMEACOFFEE_PAGE_URL: z.string().optional(),
    BUYMEACOFFEE_WEBHOOK_SECRET: z.string().optional(),
    BUYMEACOFFEE_API_TOKEN: z.string().optional(),

    // ── Polls ─────────────────────────────────────────────────
    POLL_CLEANUP_INTERVAL_MS: z.coerce.number().default(21_600_000),

    // ── Moderation ────────────────────────────────────────────
    MODERATION_TIMEOUT_AFTER_WARNINGS: z.coerce.number().default(3),
    MODERATION_KICK_AFTER_WARNINGS: z.coerce.number().default(5),
    MODERATION_AUTO_TIMEOUT_DURATION: z.string().default("1h"),

    // ── Misc ──────────────────────────────────────────────────
    BOT_NAME: z.string().default("Role Reactor Bot"),
    VOTE_URL: z.string().optional(),
  })
  .passthrough(); // Allow unknown env vars without failing

/**
 * Validate environment variables at startup.
 * Logs warnings for optional missing vars, throws for required ones.
 * @returns {z.infer<typeof envSchema>} Parsed & validated env
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const required = [];
    const warnings = [];

    for (const [key, issues] of Object.entries(formatted)) {
      if (key.startsWith("_")) continue;
      const msgs = issues._errors || [];
      if (msgs.length === 0) continue;

      // DISCORD_TOKEN and DISCORD_CLIENT_ID are hard requirements
      if (key === "DISCORD_TOKEN" || key === "DISCORD_CLIENT_ID") {
        required.push(`${key}: ${msgs.join(", ")}`);
      } else {
        warnings.push(`${key}: ${msgs.join(", ")}`);
      }
    }

    if (required.length > 0) {
      throw new Error(
        `Missing required environment variables:\n${required.join("\n")}`,
      );
    }

    if (warnings.length > 0) {
      // Lazy import to avoid circular dependency at top-level
      import("../utils/logger.js")
        .then(({ getLogger }) => {
          const logger = getLogger();
          logger.warn(
            `⚠️ Env validation warnings (using defaults):\n${warnings.join("\n")}`,
          );
        })
        .catch(() => {
          console.warn(
            `⚠️ Env validation warnings (using defaults):\n${warnings.join("\n")}`,
          );
        });
    }
  }

  return result.data;
}

export { envSchema };
