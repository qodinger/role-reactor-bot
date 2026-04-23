import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";
import { CORE_STATUS } from "../../../features/premium/config.js";
import { PREMIUM_FEATURES } from "./premiumData.js";

export const metadata = {
  name: "premium",
  category: "general",
  description: "View Pro Engine premium features and upgrade",
  keywords: ["premium", "pro", "upgrade", "cores", "subscription"],
  emoji: "⚡",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/premium```",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: "A list of all premium features available with Pro Engine",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description);

export async function execute(interaction, _client) {
  const embed = new EmbedBuilder()
    .setTitle(`⚡ ${CORE_STATUS.PRO.name} - Premium Features`)
    .setDescription(
      [
        `Upgrade to unlock **unlimited features** and **higher limits**!`,
        "",
        `**How to upgrade:** Visit **[rolereactor.app](https://rolereactor.app)** to purchase Cores and enable Pro Engine.`,
        "",
        `You can also earn **free Cores** by voting for Role Reactor on Top.gg!`,
      ].join("\n"),
    )
    .setColor(THEME.PRO)
    .setTimestamp();

  for (const feature of PREMIUM_FEATURES) {
    embed.addFields({
      name: `${feature.emoji} ${feature.name}`,
      value: [
        `**Free:** ${feature.free}`,
        `**${CORE_STATUS.PRO.name}:** ${feature.pro}`,
      ].join("\n"),
      inline: false,
    });
  }

  embed.addFields({
    name: "💡 Quick Tip",
    value:
      "Most commands work with free limits - upgrade only when you need more!",
    inline: false,
  });

  return interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
