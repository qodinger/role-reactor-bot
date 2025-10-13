import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

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
    .setImage(`attachment://ai-avatar-${interaction.user.id}-${Date.now()}.png`)
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
  prompt,
) {
  return new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.STATUS.WARNING} Insufficient Cores`)
    .setDescription(
      `You need ${creditsNeeded} Core to generate an AI avatar!\n\n**Your Status:**\n• Cores: ${userData.credits}\n• Core Member: ${userData.isCore ? "Yes ⭐" : "No"}\n• Cost: ${creditsNeeded} Core per AI service`,
    )
    .addFields([
      {
        name: `${EMOJIS.UI.INFO} Your Prompt`,
        value: `"${prompt}"`,
        inline: false,
      },
      {
        name: `${EMOJIS.ACTIONS.REFRESH} Get Cores`,
        value:
          "• Donate on [Ko-fi](https://ko-fi.com/rolereactor)\n• Subscribe for Core membership\n• Contact an administrator\n• Use `/credits balance` to check your status",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Core Packages`,
        value:
          "• $1 donation = 20 Cores\n• $2.50 donation = 50 Cores\n• $5 donation = 100 Cores\n• $10 donation = 200 Cores",
        inline: false,
      },
    ])
    .setFooter(
      UI_COMPONENTS.createFooter(
        "Avatar Generator • Core System",
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
    .setTitle(`${EMOJIS.UI.INFO} Avatar Generator Help`)
    .setDescription(
      "Generate unique anime-style avatars using AI! Generated avatars will be visible to everyone in the channel. Run the command again to generate new variations.",
    )
    .addFields([
      {
        name: `${EMOJIS.UI.INFO} How to Use`,
        value: '`/avatar prompt: "your description here"`',
        inline: false,
      },
      {
        name: `${EMOJIS.ACTIONS.TIPS} Pro Tips`,
        value:
          "• Describe your character: 'cool boy with spiky hair', 'cute girl in red dress'\n• Include details: hair color, clothing, accessories, personality\n• Add colors: 'red', 'blue', 'yellow', etc.\n• Examples: 'cyberpunk hacker', 'kawaii girl with pink hair', 'cool boy with glasses'",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Style Options`,
        value:
          "• **Color Style**: vibrant, pastel, monochrome, neon, warm, cool\n• **Mood**: happy, serious, mysterious, cute, cool, elegant\n• **Art Style**: studio, manga, modern, retro, realistic, chibi",
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} Core System`,
        value:
          "• All users: 1 Core per avatar\n• Use `/credits balance` to check your Cores",
        inline: false,
      },
    ])
    .setFooter({
      text: "Avatar Generator • Powered by AI",
    })
    .setTimestamp();
}
