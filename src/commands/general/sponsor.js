import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { THEME, EMOJIS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("sponsor")
  .setDescription(
    `${EMOJIS.ACTIONS.HEART} Support the bot development at your own pace`,
  );

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Create a simple sponsor embed
    const embed = new EmbedBuilder()
      .setColor(THEME.PRIMARY)
      .setTitle(`${EMOJIS.ACTIONS.HEART} Support Role Reactor Bot`)
      .setDescription(
        "**Thank you for considering supporting the bot!** 🎉\n\n" +
          "Your support helps keep the bot running, adds new features, and ensures it stays free for everyone.\n\n" +
          "**💝 No pressure to donate - the bot will always be free!**",
      )
      .setFooter({
        text: "Every contribution makes a difference! ❤️",
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Create simple donation button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("☕ Buy Me a Coffee")
        .setStyle(ButtonStyle.Link)
        .setURL("https://buymeacoffee.com/tyecode"),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64, // Ephemeral response
    });

    logger.info(
      `Sponsor command used by ${interaction.user.tag} in ${interaction.guild?.name || "DM"}`,
    );
  } catch (error) {
    logger.error("Error in sponsor command", error);

    const errorEmbed = new EmbedBuilder()
      .setColor(THEME.ERROR)
      .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
      .setDescription(
        "Sorry, I couldn't load the sponsor information right now. Please try again later.",
      );

    await interaction.reply({
      embeds: [errorEmbed],
      flags: 64,
    });
  }
}
