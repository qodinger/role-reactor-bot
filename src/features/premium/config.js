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
      "10x Ticketing System Capacity & 10 Panels",
      "Ticket Automation & Unlimited Transcripts",
      "Unlimited Level Up Rewards (Free: 5)",
      "Replace Role Level Reward Mode",
      "Server Command Toggling (Web Dashboard)",
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
};
