import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";
import { config } from "../../../config/config.js";

const CORE_EMOJI = config.coreEmoji;

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
    .setTitle(`${EMOJIS.STATUS.ERROR} ${title}`)
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
    .setTitle(`${EMOJIS.STATUS.WARNING} ${title}`)
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
 * Create loading embed for avatar generation
 * @param {string} prompt - User's prompt
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLoadingEmbed(prompt) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.PROGRESS} Generating Avatar...`)
    .setDescription(`**"${prompt}"**`)
    .setImage(`attachment://loading-${Date.now()}.png`)
    .setFooter({
      text: "Avatar Generator • This may take 10-30 seconds",
    })
    .setTimestamp();
}

/**
 * Create success embed for avatar generation
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {string} prompt - User's prompt
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createSuccessEmbed(interaction, prompt) {
  return new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Avatar Complete!`)
    .setDescription(
      `**"${prompt}"**\n\n✨ *Your unique anime avatar has been generated*`,
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Generated for ${interaction.user.username} • AI Avatar Generator`,
        interaction.user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

/**
 * Create credit insufficient embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} userData - User credit data
 * @param {number} creditsNeeded - Credits needed for generation
 * @param {string} prompt - User's prompt
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createCreditEmbed(
  interaction,
  userData,
  creditsNeeded,
  _prompt,
) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setDescription(
      `You need **${creditsNeeded} ${CORE_EMOJI}** to generate an AI avatar!\n**Your Balance**: ${userData.credits} ${CORE_EMOJI} • **Cost**: ${creditsNeeded} ${CORE_EMOJI} per generation`,
    )
    .addFields([
      {
        name: `${EMOJIS.ACTIONS.REFRESH} Get Cores`,
        value: `Donate on [Ko-fi](https://ko-fi.com/rolereactor) • Use \`/core pricing\``,
        inline: false,
      },
      {
        name: `${CORE_EMOJI} Core Energy`,
        value: `1 ${CORE_EMOJI} = 1 AI Avatar • High-quality anime art • 10-30 second generation`,
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
      `Generate unique anime-style avatars using AI! Use \`/avatar prompt: "your description"\` to get started.`,
    )
    .addFields([
      {
        name: `${EMOJIS.ACTIONS.TIPS} Pro Tips`,
        value: `Describe your character with details: hair color, clothing, accessories\n**Examples**: "cool boy with spiky hair", "cute girl in red dress", "cyberpunk hacker"`,
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Style Options`,
        value: `**Color**: vibrant, pastel, monochrome • **Mood**: happy, serious, cute • **Art**: studio, manga, modern`,
        inline: false,
      },
    ])
    .setFooter({
      text: "Avatar Generator • Powered by AI",
    })
    .setTimestamp();
}
