import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription(`Get information about this server`);

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ ephemeral: false });

    const guild = interaction.guild;

    // Get server statistics
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(
      m => m.presence?.status !== "offline",
    ).size;
    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    // Get channel counts
    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categories = guild.channels.cache.filter(c => c.type === 4).size;

    // Get role count
    const roleCount = guild.roles.cache.size;

    // Get server age
    const createdAt = guild.createdAt;
    const ageInDays = Math.floor(
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Get boost level and perks
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount;
    const boostPerks = {
      0: "No boosts",
      1: "Level 1 perks",
      2: "Level 2 perks + 15 extra emoji slots",
      3: "Level 3 perks + 30 extra emoji slots + animated server icon",
    };

    const embed = new EmbedBuilder()
      .setColor(THEME.PRIMARY)
      .setTitle(`${EMOJIS.UI.INFO} Server Information`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: `${EMOJIS.UI.STAR} Server Name`,
          value: guild.name,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.USERS} Members`,
          value: `${onlineMembers}/${totalMembers} online\n${humanCount} humans, ${botCount} bots`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.CHANNELS} Channels`,
          value: `${textChannels} text, ${voiceChannels} voice\n${categories} categories`,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.ROLES} Roles`,
          value: `${roleCount} total roles`,
          inline: true,
        },
        {
          name: `${EMOJIS.TIME.CLOCK} Created`,
          value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R>\n(${ageInDays} days ago)`,
          inline: true,
        },
        {
          name: `${EMOJIS.UI.OWNER} Owner`,
          value: `<@${guild.ownerId}>`,
          inline: true,
        },
        {
          name: `${EMOJIS.STATUS.SUCCESS} Server Boost`,
          value: `Level ${boostLevel} (${boostCount} boosts)\n${boostPerks[boostLevel]}`,
          inline: true,
        },
      )
      .setFooter(
        UI_COMPONENTS.createFooter(
          `Requested by ${interaction.user.username}`,
          interaction.user.displayAvatarURL(),
        ),
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.logCommand("serverinfo", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in serverinfo command", error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(THEME.ERROR)
          .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
          .setDescription(
            "Sorry, I couldn't load the server information right now.",
          ),
      ],
    });
  }
}
