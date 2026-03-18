// Global core status constants
export const CORE_STATUS = {
  REGULAR: {
    id: 0,
    label: "Regular",
    emoji: null,
  },
  PRO: {
    id: 1,
    label: "Pro Engine",
    emoji: "✨",
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
      "10x Monthly Ticket Capacity (500 tickets)",
      "Advanced Ticket Automation & HTML Transcripts",
      "Unlimited Transcript Storage (Free: 7 days)",
      "Detailed Analytics & Staff Performance Stats",
      "Unlimited Level-Up Rewards & 'Replace Role' Mode",
      "High-Capacity Giveaways (Up to 50,000 entries)",
      "20x Scheduled Role Capacity (500 active slots)",
      "10x Bulk Action Capacity (250 users per action)",
      "Advanced Data Exports (JSON, Markdown, HTML)",
    ],
  },
};

export const PERIOD_DAYS = {
  week: 7,
  month: 30,
  year: 365,
};

/**
 * Free tier limits — features available without Pro Engine
 */
export const FREE_TIER = {
  LEVEL_REWARDS_MAX: 5,
  REWARD_MODE: "stack", // Only stack is free; replace requires Pro
  GIVEAWAY_MAX_ENTRIES: 2500,
  SCHEDULE_MAX_ACTIVE: 25,
  BULK_ACTION_MAX_MEMBERS: 25,
};

/**
 * Pro Engine limits — unlocked with subscription
 */
export const PRO_TIER = {
  LEVEL_REWARDS_MAX: -1, // Unlimited
  GIVEAWAY_MAX_ENTRIES: 50000, // Balanced for VPS safety (Reduced from 100k)
  SCHEDULE_MAX_ACTIVE: 500, // 20x free tier
  BULK_ACTION_MAX_MEMBERS: 250, // 10x free tier
};
