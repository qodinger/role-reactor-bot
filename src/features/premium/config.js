export const PremiumFeatures = {
  PRO: {
    id: "pro_engine",
    name: "Pro Engine",
    description:
      "Unlock all premium features, automated tools, and advanced customization",
    cost: 50, // Cores (~$3.30/mo)
    period: "month",
    periodDays: 30,
    includes: [
      "Unlimited Level Rewards (free tier: 5)",
      "Replace reward mode (highest role only)",
      "Command toggling",
      "Advanced analytics",
      "Priority support",
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
