import { EMOJIS, THEME } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";

// ============================================================================
// EMBED CREATION FUNCTIONS
// ============================================================================

/**
 * Creates a success embed for donation verification
 * @param {Object} params - Verification parameters
 * @param {Object} params.targetUser - Target user object
 * @param {number} params.amount - Donation amount
 * @param {number} params.creditsToAdd - Credits to add
 * @param {number} params.newBalance - New credit balance
 * @param {string} params.koFiUrl - Ko-fi URL (optional)
 * @param {string} params.notes - Additional notes (optional)
 * @param {string} params.verifiedBy - Username of verifier
 * @param {Object} params.client - Discord client
 * @returns {Object} Discord embed object
 */
export function createDonationSuccessEmbed({
  targetUser,
  amount,
  creditsToAdd,
  newBalance,
  koFiUrl,
  notes,
  verifiedBy,
  client,
}) {
  return {
    color: THEME.SUCCESS,
    title: `${EMOJIS.STATUS.SUCCESS} Donation Verified!`,
    description: `Successfully verified a **$${amount} donation** for ${targetUser.username} and added **${creditsToAdd} Core credits**.`,
    fields: [
      {
        name: `${EMOJIS.UI.USER} User`,
        value: `${targetUser.username} (${targetUser.id})`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Type`,
        value: "Donation",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Amount`,
        value: `$${amount}`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Credits Added`,
        value: `${creditsToAdd} Core`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} New Balance`,
        value: `${newBalance} Core`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Verified By`,
        value: verifiedBy,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Ko-fi URL`,
        value: koFiUrl || "Not provided",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Notes`,
        value: notes || "No additional notes",
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Verification • Manual Donation",
      icon_url: client.user.displayAvatarURL(),
    },
  };
}

/**
 * Creates a success embed for subscription verification
 * @param {Object} params - Verification parameters
 * @param {Object} params.targetUser - Target user object
 * @param {string} params.tier - Core tier name
 * @param {number} params.creditsAdded - Credits added
 * @param {number} params.newBalance - New credit balance
 * @param {string} params.koFiUrl - Ko-fi URL (optional)
 * @param {string} params.notes - Additional notes (optional)
 * @param {string} params.verifiedBy - Username of verifier
 * @param {Object} params.client - Discord client
 * @returns {Object} Discord embed object
 */
export function createSubscriptionSuccessEmbed({
  targetUser,
  tier,
  creditsAdded,
  newBalance,
  koFiUrl,
  notes,
  verifiedBy,
  client,
}) {
  const tierBadge = emojiConfig.getTierBadge(tier);

  return {
    color: THEME.SUCCESS,
    title: `${EMOJIS.STATUS.SUCCESS} Core Status Granted!`,
    description: `Successfully granted **${tierBadge} ${tier}** membership to ${targetUser.username}!`,
    fields: [
      {
        name: `${EMOJIS.UI.USER} User`,
        value: `${targetUser.username} (${targetUser.id})`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Type`,
        value: "Subscription",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Status`,
        value: `${tierBadge} ${tier} Member`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Credits Added`,
        value: `${creditsAdded} Core (monthly)`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} New Balance`,
        value: `${newBalance} Core`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Verified By`,
        value: verifiedBy,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Ko-fi URL`,
        value: koFiUrl || "Not provided",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Notes`,
        value: notes || "No additional notes",
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Verification • Manual Subscription",
      icon_url: client.user.displayAvatarURL(),
    },
  };
}

/**
 * Creates a success embed for manual credit addition
 * @param {Object} params - Verification parameters
 * @param {Object} params.targetUser - Target user object
 * @param {number} params.credits - Credits added
 * @param {number} params.newBalance - New credit balance
 * @param {string} params.notes - Additional notes (optional)
 * @param {string} params.addedBy - Username of person who added credits
 * @param {Object} params.client - Discord client
 * @returns {Object} Discord embed object
 */
export function createManualCreditsSuccessEmbed({
  targetUser,
  credits,
  newBalance,
  notes,
  addedBy,
  client,
}) {
  return {
    color: THEME.SUCCESS,
    title: `${EMOJIS.STATUS.SUCCESS} Credits Added!`,
    description: `Successfully added **${credits} Core credits** to ${targetUser.username}!`,
    fields: [
      {
        name: `${EMOJIS.UI.USER} User`,
        value: `${targetUser.username} (${targetUser.id})`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Type`,
        value: "Manual",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Credits Added`,
        value: `${credits} Core`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} New Balance`,
        value: `${newBalance} Core`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Added By`,
        value: addedBy,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.INFO} Notes`,
        value: notes || "No additional notes",
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Verification • Manual Credits",
      icon_url: client.user.displayAvatarURL(),
    },
  };
}

/**
 * Creates an error embed for verification failures
 * @param {Object} params - Error parameters
 * @param {string} params.title - Error title
 * @param {string} params.description - Error description
 * @param {string} params.footerText - Footer text
 * @param {Object} params.client - Discord client
 * @returns {Object} Discord embed object
 */
export function createErrorEmbed({ title, description, footerText, client }) {
  return {
    color: THEME.ERROR,
    title: `${EMOJIS.STATUS.ERROR} ${title}`,
    description,
    timestamp: new Date().toISOString(),
    footer: {
      text: footerText,
      icon_url: client.user.displayAvatarURL(),
    },
  };
}

/**
 * Creates a permission denied embed
 * @param {Object} client - Discord client
 * @returns {Object} Discord embed object
 */
export function createPermissionDeniedEmbed(client) {
  return {
    color: THEME.ERROR,
    title: `${EMOJIS.STATUS.ERROR} Permission Denied`,
    description: "You need developer permissions to use this command.",
    timestamp: new Date().toISOString(),
    footer: {
      text: "Core Verification • Access Denied",
      icon_url: client.user.displayAvatarURL(),
    },
  };
}
