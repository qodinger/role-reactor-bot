import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription(`Get a user's avatar with interactive features`)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user whose avatar you want to see (defaults to you)")
      .setRequired(false),
  );

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const targetUser = interaction.options.getUser("user") || interaction.user;

    // Get server member for server-specific avatar
    const member = interaction.guild?.members.cache.get(targetUser.id);
    const serverAvatar = member?.displayAvatarURL({
      size: 1024,
      dynamic: true,
    });
    const globalAvatar = targetUser.displayAvatarURL({
      size: 1024,
      dynamic: true,
    });
    const hasServerAvatar = serverAvatar !== globalAvatar;

    // Create direct download URL buttons with correct Discord API format
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setURL(targetUser.displayAvatarURL({ size: 1024, extension: "png" }))
        .setLabel("📥 PNG")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setURL(targetUser.displayAvatarURL({ size: 1024, extension: "jpg" }))
        .setLabel("📥 JPG")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setURL(targetUser.displayAvatarURL({ size: 1024, extension: "webp" }))
        .setLabel("📥 WebP")
        .setStyle(ButtonStyle.Link),
    );

    // Create standard embed
    const embed = createStandardEmbed(
      targetUser,
      globalAvatar,
      serverAvatar,
      hasServerAvatar,
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
    logger.logCommand("avatar", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in avatar command", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(THEME.ERROR)
          .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
          .setDescription("Sorry, I couldn't load the avatar right now."),
      ],
    });
  }
}

function createStandardEmbed(
  user,
  globalAvatar,
  serverAvatar,
  hasServerAvatar,
) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.IMAGE} ${user.username}'s Avatar`)
    .setDescription(
      `**${user.tag}** • ${user.avatar ? "Custom Avatar" : "Default Avatar"}`,
    )
    .setImage(globalAvatar)
    .setThumbnail(user.displayAvatarURL({ size: 128, dynamic: true }))
    .addFields({
      name: `${EMOJIS.UI.INFO} Avatar Details`,
      value: [
        `**Format**: ${globalAvatar.includes(".gif") ? "🎬 Animated GIF" : "🖼️ Static Image"}`,
        `**Quality**: High Definition`,
        `**Type**: ${user.avatar ? "Custom Avatar" : "Default Discord Avatar"}`,
      ].join("\n"),
      inline: false,
    });

  if (hasServerAvatar) {
    embed.addFields({
      name: `${EMOJIS.UI.STAR} Server Avatar Available`,
      value: `🎭 This user has a **custom server avatar**! Use the buttons below to switch between global and server avatars.`,
      inline: false,
    });
  }

  embed
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Requested by ${user.username} • Use buttons to switch views`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();

  return embed;
}
