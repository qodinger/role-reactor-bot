import { EMOJIS, THEME } from "../../../../config/theme.js";

/**
 * Create error embed for avatar generation failures
 */
export function createErrorEmbed(interaction, title, description) {
  return {
    color: THEME.ERROR,
    title: `${EMOJIS.STATUS.ERROR} ${title}`,
    description,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Avatar Generator",
      icon_url: interaction.client.user.displayAvatarURL(),
    },
  };
}

/**
 * Create warning embed for avatar generation warnings
 */
export function createWarningEmbed(interaction, title, description) {
  return {
    color: THEME.WARNING,
    title: `${EMOJIS.STATUS.WARNING} ${title}`,
    description,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Avatar Generator",
      icon_url: interaction.client.user.displayAvatarURL(),
    },
  };
}

/**
 * Create loading embed for avatar generation
 */
export function createLoadingEmbed(prompt) {
  return {
    color: THEME.PRIMARY,
    title: `${EMOJIS.UI.PROGRESS} Generating Avatar...`,
    description: `**"${prompt}"**`,
    image: {
      url: `attachment://loading-${Date.now()}.png`,
    },
    timestamp: new Date().toISOString(),
    footer: {
      text: "Avatar Generator • This may take 10-30 seconds",
    },
  };
}

/**
 * Create success embed for avatar generation (Midjourney style)
 */
export function createSuccessEmbed(interaction, prompt) {
  return {
    color: THEME.SUCCESS,
    title: `${EMOJIS.STATUS.SUCCESS} Avatar Complete!`,
    description: `**"${prompt}"**\n\n✨ *Your unique anime avatar has been generated*`,
    image: {
      url: `attachment://ai-avatar-${interaction.user.id}-${Date.now()}.png`,
    },
    timestamp: new Date().toISOString(),
    footer: {
      text: `Generated for ${interaction.user.username} • AI Avatar Generator`,
      icon_url: interaction.user.displayAvatarURL(),
    },
  };
}

/**
 * Create credit insufficient embed
 */
export function createCreditEmbed(
  interaction,
  userData,
  creditsNeeded,
  prompt,
) {
  return {
    color: THEME.WARNING,
    title: `${EMOJIS.STATUS.WARNING} Insufficient Cores`,
    description: `You need ${creditsNeeded} Core to generate an AI avatar!\n\n**Your Status:**\n• Cores: ${userData.credits}\n• Core Member: ${userData.isCore ? "Yes ⭐" : "No"}\n• Cost: ${creditsNeeded} Core per AI service`,
    fields: [
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
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Avatar Generator • Core System",
      icon_url: interaction.client.user.displayAvatarURL(),
    },
  };
}

/**
 * Create help embed
 */
export function createHelpEmbed() {
  return {
    color: THEME.PRIMARY,
    title: `${EMOJIS.UI.INFO} Avatar Generator Help`,
    description:
      "Generate unique anime-style avatars using AI! Generated avatars will be visible to everyone in the channel. Run the command again to generate new variations.",
    fields: [
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
        name: `${EMOJIS.UI.INFO} Core System`,
        value:
          "• All users: 1 Core per avatar\n• Use `/credits balance` to check your Cores",
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "Avatar Generator • Powered by AI",
    },
  };
}
