/**
 * Ticketing System Configuration
 * Free tier limits and Pro Engine features
 */

// Free tier limits - features available without Pro Engine
export const FREE_TIER = {
  MAX_TICKETS_PER_MONTH: 50, // Monthly ticket limit
  MAX_PANELS: 1, // Maximum ticket panels
  MAX_CATEGORIES: 3, // Maximum categories per panel
  TRANSCRIPT_RETENTION_DAYS: 7, // Days before transcript deletion
  EXPORT_FORMATS: ["html"], // Available export formats
  ANALYTICS: "basic", // Analytics level: 'basic' | 'advanced'
  AUTOMATION: false, // Auto-close, auto-assign rules
  CUSTOM_BRANDING: false, // Custom colors, footer, etc.
  STAFF_PERFORMANCE_TRACKING: false, // Staff statistics
  PRIORITY_NOTIFICATIONS: false, // Priority staff pings
  BOT_BRANDING_FOOTER: true, // Show "Powered by" footer
  MAX_ACTIVE_TICKETS: 10, // Maximum simultaneously open tickets
  DAILY_TICKET_LIMIT: 5, // Maximum tickets per day
};

// Pro Engine features - unlocked with subscription
export const PRO_ENGINE = {
  MAX_TICKETS_PER_MONTH: 500, // 10x free tier
  MAX_PANELS: 10, // Multiple panels
  MAX_CATEGORIES: 20, // Many categories
  TRANSCRIPT_RETENTION_DAYS: -1, // Unlimited (-1 = no expiry)
  EXPORT_FORMATS: ["html", "pdf", "json"], // All formats
  ANALYTICS: "advanced", // Full analytics dashboard
  AUTOMATION: true, // Automation rules enabled
  CUSTOM_BRANDING: true, // Remove bot branding
  STAFF_PERFORMANCE_TRACKING: true, // Staff performance stats
  PRIORITY_NOTIFICATIONS: true, // Priority pings
  BOT_BRANDING_FOOTER: false, // No "Powered by" footer
  MAX_ACTIVE_TICKETS: 50, // More simultaneous tickets
  DAILY_TICKET_LIMIT: 50, // Higher daily limit
  TEMPLATES: true, // Save/load panel templates
  CUSTOM_COLORS: true, // Custom embed colors
  MULTI_SERVER_STATS: true, // Cross-server analytics
};

// Ticket status constants
export const TICKET_STATUS = {
  OPEN: "open",
  CLOSED: "closed",
  ARCHIVED: "archived",
};

// Ticket priority levels
export const TICKET_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
};

// Export formats
export const EXPORT_FORMATS = {
  HTML: "html",
  PDF: "pdf",
  JSON: "json",
};

// Default ticket category
export const DEFAULT_CATEGORY = {
  id: "default",
  label: "Support",
  emoji: "📧",
  description: "General support ticket",
  color: 0x5865f2, // Discord blurple
};

// Panel button styles
export const BUTTON_STYLES = {
  PRIMARY: 1,
  SECONDARY: 2,
  SUCCESS: 3,
  DANGER: 4,
};

// Auto-close settings
export const AUTO_CLOSE = {
  WARNING_HOURS: 24, // Warn before auto-close
  INACTIVE_DAYS_FREE: 7, // Auto-close after (free tier)
  INACTIVE_DAYS_PRO: 30, // Auto-close after (pro tier)
};

// Staff notification settings
export const STAFF_NOTIFICATIONS = {
  CHANNEL: "staff-pings", // Default staff ping channel
  ROLE_MENTION: true, // Mention staff role
  DM_ON_CLAIM: false, // DM staff when they claim
};

// Transcript settings
export const TRANSCRIPT_SETTINGS = {
  MAX_MESSAGES: 1000, // Max messages per transcript
  INCLUDE_ATTACHMENTS: true, // Include attachment links
  EMBED_AUTHOR: true, // Show author in transcript
};
