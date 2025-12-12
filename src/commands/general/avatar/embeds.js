import { EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";
import { emojiConfig } from "../../../config/emojis.js";

const CORE_EMOJI = emojiConfig.customEmojis.core;

/**
 * Create error embed for avatar generation failures
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createErrorEmbed(interaction, title, description) {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(title)
    .setDescription(description)
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Avatar Generator",
        interaction.client.user.displayAvatarURL(),
      ),
    )
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
    .setTitle(title)
    .setDescription(description)
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Avatar Generator",
        interaction.client.user.displayAvatarURL(),
      ),
    )
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
 * @param {string} prompt - User's prompt
 * @param {string} [artStyle] - Selected art style (optional)
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLoadingEmbed(prompt, artStyle = null) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle("Generating Avatar...")
    .setDescription(`**"${prompt}"**`);

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

  embed
    .setFooter({
      text: "Avatar Generator • This may take 10-60 seconds",
    })
    .setTimestamp();

  return embed;
}

/**
 * Create success embed for avatar generation
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} prompt - User's prompt
 * @param {string} [artStyle] - Selected art style (optional)
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createSuccessEmbed(interaction, prompt, artStyle = null) {
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle("Avatar Complete!")
    .setDescription(`**"${prompt}"**`);

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

  embed
    .setFooter({
      text: `Generated for ${interaction.user.username} • Avatar Generator`,
    })
    .setTimestamp();

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
export function createCoreEmbed(interaction, userData, creditsNeeded, _prompt) {
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
    .setDescription(
      `You need **${creditsNeeded} ${CORE_EMOJI}** to generate an AI avatar!\n\n${coreBreakdown}\n\n**Cost**: ${creditsNeeded} ${CORE_EMOJI} per generation`,
    )
    .addFields([
      {
        name: "Get Cores",
        value: `Donate on [Ko-fi](https://ko-fi.com/rolereactor) • Use \`/core pricing\``,
        inline: false,
      },
    ])
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Avatar Generator • Core Energy",
        interaction.client.user.displayAvatarURL(),
      ),
    )
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
