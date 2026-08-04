// Global core status constants
const isProduction = process.env.NODE_ENV === "production";

export const CORE_STATUS = {
  REGULAR: {
    id: 0,
    label: "Regular",
    emoji: null,
  },
  PRO: {
    id: 1,
    label: "Pro Engine",
    emoji: isProduction
      ? "<:pro_engine:1485227111558938704>"
      : "<:pro_engine:1484831093818527804>",
  },
};

export const PremiumFeatures = {
  PRO: {
    id: "pro_engine",
    name: "Pro Engine",
    description:
      "Unlock all premium features, automated tools, and advanced customization",
    cost: 20, // Cores (weekly cycle)
    period: "week",
    periodDays: 7,
    includes: [
      "10x Ticket Capacity (500/month, 10 panels)",
      "Advanced Ticket Automation & HTML Transcripts",
      "Unlimited Transcript Storage (Free: 30 days)",
      "Unlimited Level-Up Rewards & 'Replace Role' Mode",
      "High-Capacity Giveaways (Up to 50,000 entries & 20 winners)",
      "20x Scheduled Role Capacity (500 active slots)",
      "10x Bulk Action Capacity (250 users per action)",
      "Advanced Auto-Mod (domain allowlist, caps lock, wildcard/regex, per-channel, analytics, export)",
      "Role Reactions (20 emojis, 15 menus)",
      "Role Bundles (20 roles per bundle)",
      "Custom Commands (25 commands)",
    ],
  },
};

// Free trial configuration for Pro Engine
export const ProTrialConfig = {
  enabled: true,
  durationDays: 7, // Trial lasts 7 days
  autoActivate: false, // User-triggered via dashboard, not automatic
  oneTimeOnly: true, // Each guild gets only one trial
};

/**
 * Free tier limits — features available without Pro Engine
 */
export const FREE_TIER = {
  LEVEL_REWARDS_MAX: 5,
  REWARD_MODE: "stack", // Only stack is free; replace requires Pro
  GIVEAWAY_MAX_ACTIVE: 3,
  GIVEAWAY_MAX_ENTRIES: 2500,
  GIVEAWAY_MAX_WINNERS: 5,
  SCHEDULE_MAX_ACTIVE: 25,
  BULK_ACTION_MAX_MEMBERS: 25,
  ROLE_BUNDLE_MAX_ROLES: 5,
  ROLE_REACTION_MAX_EMOJIS: 10,
  ROLE_REACTION_MAX_MESSAGES: 5,
  // Ticketing
  TICKET_MAX_PANELS: 3,
  TICKET_MAX_TICKETS_PER_MONTH: 50,
  TICKET_TRANSCRIPT_DAYS: 30,
};

export const PRO_TIER = {
  LEVEL_REWARDS_MAX: -1, // Unlimited
  GIVEAWAY_MAX_ACTIVE: 20, // 6x free tier
  GIVEAWAY_MAX_ENTRIES: 50000, // Balanced for VPS safety (Reduced from 100k)
  GIVEAWAY_MAX_WINNERS: 20, // 4x free tier
  SCHEDULE_MAX_ACTIVE: 500, // 20x free tier
  BULK_ACTION_MAX_MEMBERS: 250, // 10x free tier
  ROLE_BUNDLE_MAX_ROLES: 20, // 4x free tier
  ROLE_REACTION_MAX_EMOJIS: 20, // Discord's hard limit
  ROLE_REACTION_MAX_MESSAGES: 15, // 3x free tier
  CUSTOM_COMMANDS_MAX: 25, // Pro-only
  // Ticketing
  TICKET_MAX_PANELS: 10,
  TICKET_MAX_TICKETS_PER_MONTH: 500,
  TICKET_TRANSCRIPT_DAYS: -1, // Unlimited
};
