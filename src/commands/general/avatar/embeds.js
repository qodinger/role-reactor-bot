import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";

const CORE_EMOJI = emojiConfig.customEmojis.core;

function truncatePrompt(prompt) {
  if (!prompt) return "No prompt provided.";
  return prompt.length > 200 ? `${prompt.slice(0, 197)}...` : prompt;
}

/**
 * Format date as "Today at HH:MM" or "Yesterday at HH:MM" or date format
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatFooterTimestamp(date = new Date()) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateToFormat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.floor((today - dateToFormat) / (1000 * 60 * 60 * 24));

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;

  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  } else {
    const month = date.toLocaleString("en-US", { month: "short" });
    const day = date.getDate();
    return `${month} ${day} at ${timeStr}`;
  }
}

/**
 * Create error embed for avatar generation failures
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createErrorEmbed(interaction, title, description) {
  const prompt = interaction.options?.getString("prompt") || "N/A";
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} ${title}`)
    .setDescription(
      `**Prompt**\n${truncatePrompt(prompt)}\n\n**Details**\n${description}`,
    )
    .setFooter({
      text: "Try refining your prompt or retry later.",
    })
    .setTimestamp();
}

/**
 * Create warning embed for avatar generation warnings
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} title - Warning title
 * @param {string} description - Warning description
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createWarningEmbed(interaction, title, description) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.STATUS.WARNING} ${title}`)
    .setDescription(description)
    .setFooter({
      text: "Avatar Generator",
    })
    .setTimestamp();
}

/**
 * Format art style name for display
 * @param {string} artStyle - Art style value
 * @returns {string} Formatted art style name
 */
function formatArtStyleName(artStyle) {
  const styleNames = {
    manga: "Manga",
    modern: "Modern",
    retro: "Retro",
    realistic: "Realistic",
    chibi: "Chibi",
    lofi: "Lo-fi",
  };
  return styleNames[artStyle] || artStyle;
}

/**
 * Create loading embed for avatar generation
 * @param {import('discord.js').CommandInteraction} interaction - The interaction
 * @param {string} prompt - User's prompt
 * @param {string} [artStyle] - Selected art style (optional)
 * @param {string} [status] - Current status message (optional)
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLoadingEmbed(
  interaction,
  prompt,
  artStyle = null,
  status = null,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME.INFO)
    .setTitle(`${EMOJIS.UI.LOADING} Generating your avatar`)
    .setDescription(`**Prompt**\n${truncatePrompt(prompt)}`);

  // Add art style field if one was selected
  if (artStyle) {
    embed.addFields([
      {
        name: "Art Style",
        value: formatArtStyleName(artStyle),
        inline: true,
      },
    ]);
  }

  // Add status field if provided
  if (status) {
    embed.addFields([
      {
        name: "Status",
        value: status,
        inline: false,
      },
    ]);
  } else {
    embed.setDescription(
      `${embed.data.description}\n\nPlease hang tight while the model renders your avatar.`,
    );
  }

  // Always use consistent footer format
  const timestamp = formatFooterTimestamp();
  embed.setFooter({
    text: `Generated for ${interaction.user.username} • Avatar Generator • ${timestamp}`,
  });

  return embed;
}

/**
 * Create success embed for avatar generation
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} prompt - User's prompt
 * @param {string} [artStyle] - Selected art style (optional)
 * @returns {import('discord.js').EmbedBuilder}
 */
/**
 * Create success embed for avatar generation
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} prompt - User's prompt
 * @param {string|null} artStyle - Selected art style
 * @param {Object|null} deductionBreakdown - Credit deduction breakdown
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createSuccessEmbed(
  interaction,
  prompt,
  artStyle = null,
  _deductionBreakdown = null,
  _isNSFW = false,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.UI.IMAGE} Avatar ready`)
    .setDescription(`**Prompt**\n${truncatePrompt(prompt)}`);

  // Add art style field if one was selected
  if (artStyle) {
    embed.addFields([
      {
        name: "Art Style",
        value: formatArtStyleName(artStyle),
        inline: true,
      },
    ]);
  }

  const timestamp = formatFooterTimestamp();
  embed.setFooter({
    text: `Generated for ${interaction.user.username} • Avatar Generator • ${timestamp}`,
  });

  return embed;
}

/**
 * Create Core insufficient embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} userData - User Core data
 * @param {number} creditsNeeded - Cores needed for generation
 * @param {string} prompt - User's prompt
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createCoreEmbed(interaction, userData, creditsNeeded, prompt) {
  // Enhanced Core breakdown for better user understanding
  const subscriptionCredits = userData.subscriptionCredits || 0;
  const bonusCredits = userData.bonusCredits || 0;
  const isSubscriptionUser = userData.koFiSubscription?.isActive;

  let coreBreakdown = `**Your Balance**: ${userData.credits} ${CORE_EMOJI}`;

  if (isSubscriptionUser) {
    coreBreakdown += `\n• **Subscription**: ${subscriptionCredits} ${CORE_EMOJI} (monthly allowance)`;
    coreBreakdown += `\n• **Bonus**: ${bonusCredits} ${CORE_EMOJI} (from donations, never expires)`;
  }

  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.STATUS.WARNING} Insufficient Cores`)
    .setDescription(
      `**Prompt**\n${truncatePrompt(prompt)}\n\nYou need **${creditsNeeded} ${CORE_EMOJI}** to generate an AI avatar!\n\n${coreBreakdown}\n\n**Cost**: ${creditsNeeded} ${CORE_EMOJI} per generation`,
    )
    .addFields([
      {
        name: "Get Cores",
        value: `Donate on [Ko-fi](https://ko-fi.com/rolereactor) • Use \`/core pricing\``,
        inline: false,
      },
    ])
    .setFooter({
      text: "Avatar Generator • Core Energy",
    })
    .setTimestamp();
}

/**
 * Create help embed
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createHelpEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setDescription(
      `Generate unique anime-style avatar profile pictures using AI! Use \`/avatar prompt: "your character description"\` to get started.`,
    )
    .addFields([
      {
        name: "Pro Tips",
        value: `Describe your avatar however you want! Include character details, backgrounds, environments, or any creative elements.\n**Examples**: "cool boy with spiky hair", "cute girl in red dress", "anime girl in a forest", "cyberpunk hacker in neon city", "mysterious character with glasses", "beautiful sunset portrait"\n**Note**: Single character focus works best for profile pictures`,
        inline: false,
      },
      {
        name: "Art Style",
        value: `Optional: Choose an artistic style (manga, modern, retro, realistic, chibi, lofi)`,
        inline: false,
      },
    ])
    .setFooter({
      text: "Avatar Generator • Powered by AI",
    })
    .setTimestamp();
}
