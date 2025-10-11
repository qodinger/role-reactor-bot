import { Events, EmbedBuilder } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getExperienceManager } from "../features/experience/ExperienceManager.js";
import { EMOJIS } from "../config/theme.js";

export const name = Events.MessageCreate;

export async function execute(message, client) {
  const logger = getLogger();

  if (!message) throw new Error("Missing message");
  if (!client) throw new Error("Missing client");

  try {
    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    // Ignore DMs
    if (!message.guild) {
      return;
    }

    // Award XP for message activity
    const experienceManager = await getExperienceManager();
    const xpData = await experienceManager.awardMessageXP(
      message.guild.id,
      message.author.id,
    );

    if (xpData && xpData.leveledUp) {
      // Enhanced level up message with beautiful UI
      const userData = await experienceManager.getUserData(
        message.guild.id,
        message.author.id,
      );
      const progress = experienceManager.calculateProgress(userData.totalXP);

      // Determine rank and emoji based on new level
      let rank = "Newcomer";
      let rankEmoji = EMOJIS.FEATURES.EXPERIENCE;
      let rankColor = 0x00ff00;

      if (xpData.newLevel >= 50) {
        rank = "Legend";
        rankEmoji = EMOJIS.UI.OWNER;
        rankColor = 0xffd700;
      } else if (xpData.newLevel >= 30) {
        rank = "Veteran";
        rankEmoji = EMOJIS.UI.STAR;
        rankColor = 0xff6b35;
      } else if (xpData.newLevel >= 20) {
        rank = "Experienced";
        rankEmoji = EMOJIS.ACTIONS.TARGET;
        rankColor = 0x9b59b6;
      } else if (xpData.newLevel >= 10) {
        rank = "Regular";
        rankEmoji = EMOJIS.ACTIONS.WELCOME;
        rankColor = 0x3498db;
      } else if (xpData.newLevel >= 5) {
        rank = "Active";
        rankEmoji = EMOJIS.ACTIONS.QUICK;
        rankColor = 0xe74c3c;
      }

      const embed = new EmbedBuilder()
        .setColor(rankColor)
        .setTitle(`${rankEmoji} Level Up Achievement!`)
        .setDescription(
          `🎉 **Congratulations <@${message.author.id}>!**\n\n` +
            `You've reached **Level ${xpData.newLevel}** and earned the **${rank}** rank!\n\n` +
            `**${rankEmoji} New Rank:** ${rank}\n` +
            `**📊 Total XP:** ${userData.totalXP.toLocaleString()}\n` +
            `**🎯 Progress:** ${progress.xpInCurrentLevel}/${progress.xpNeededForNextLevel} XP to next level`,
        )
        .setThumbnail(
          message.author.displayAvatarURL({ dynamic: true, size: 256 }),
        )
        .addFields({
          name: "🎮 How to Earn More XP",
          value: [
            "💬 **Send messages** - 15-25 XP (60s cooldown)",
            "⚡ **Use commands** - 3-15 XP (30s cooldown)",
            "🎭 **Get roles** - 50 XP per role",
          ].join("\n"),
          inline: false,
        })
        .setFooter({
          text: `Keep being active to reach the next level! • ${message.guild.name}`,
          iconURL: message.guild.iconURL({ dynamic: true }),
        })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });

      logger.info(
        `🎉 User ${message.author.tag} leveled up to level ${xpData.newLevel} in guild ${message.guild.name}`,
      );
    }
  } catch (error) {
    logger.error("Error processing message for XP", error);
  }
}
