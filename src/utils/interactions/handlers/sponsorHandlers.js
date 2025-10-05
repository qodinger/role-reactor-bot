import { MessageFlags } from "discord.js";
import { getLogger } from "../../logger.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Sponsor button interaction handlers
 * Handles all sponsor-related button interactions
 */

/**
 * Handle sponsor perks button
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleSponsorPerks = async interaction => {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    const { EmbedBuilder } = await import("discord.js");

    const perksEmbed = new EmbedBuilder()
      .setColor(THEME.INFO)
      .setTitle(`${EMOJIS.FEATURES.SUPPORT} Support the Bot`)
      .setDescription(
        "Here's how your support helps keep the bot free and running:",
      )
      .addFields(
        {
          name: "🤝 Why Support?",
          value: [
            "• 🚀 **Development** - Support new features and improvements",
            "• 🛠️ **Maintenance** - Keep servers running and updated",
            "• 🐛 **Bug Fixes** - Ensure the bot stays reliable",
            "• 🆓 **Keep It Free** - Help maintain the bot's free services",
            "• 💡 **Innovation** - Enable new ideas and capabilities",
          ].join("\n"),
          inline: false,
        },
        {
          name: "💝 How to Support",
          value: [
            "• 💳 **Any Amount** - Give what you can afford",
            "• 🔄 **One-Time or Regular** - Donate once or set up recurring",
            "• 🌟 **No Pressure** - Support only if you want to",
            "• 🎯 **Every Bit Helps** - Even small donations make a difference",
            "• ⏰ **No Commitment** - Cancel anytime",
          ].join("\n"),
          inline: false,
        },
      )
      .setFooter({
        text: "Support the bot development at your own pace! ❤️",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.editReply({ embeds: [perksEmbed] });

    logger.info(
      `Sponsor perks viewed by ${interaction.user.tag} in ${interaction.guild?.name || "DM"}`,
    );
  } catch (error) {
    logger.error("Error handling sponsor perks", error);
    await handleSponsorError(interaction, "loading sponsor perks");
  }
};

/**
 * Handle sponsor system errors
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 * @param {string} action - The action that failed
 */
const handleSponsorError = async (interaction, action) => {
  const logger = getLogger();

  // Only respond if the interaction hasn't been responded to yet
  if (!interaction.replied && !interaction.deferred) {
    try {
      await interaction.reply({
        content: `❌ An error occurred while ${action}.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (replyError) {
      logger.error("Error sending error reply", replyError);
    }
  } else if (interaction.deferred) {
    try {
      await interaction.editReply({
        content: `❌ An error occurred while ${action}.`,
      });
    } catch (editError) {
      logger.error("Error sending error edit reply", editError);
    }
  }
};
