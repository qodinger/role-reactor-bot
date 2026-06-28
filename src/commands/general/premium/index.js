import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { THEME, UI_COMPONENTS } from "../../../config/theme.js";
import { PREMIUM_FEATURES } from "./premiumData.js";

const PRO_NAME = "Pro Engine";

export const metadata = {
  name: "premium",
  category: "general",
  description: "View Pro Engine premium features and upgrade",
  keywords: ["premium", "pro", "upgrade", "cores", "subscription"],
  emoji: "⚡",
  createdAt: "2026-04-23",
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
    .setTitle(`⚡ ${PRO_NAME} - Premium Features`)
    .setDescription(
      [
        `Upgrade to unlock **unlimited features** and **higher limits**!`,
        "",
        `**How to upgrade:** Visit **[rolereactor.app](https://rolereactor.app)** to purchase Cores and enable ${PRO_NAME}.`,
        "",
        `You can also earn **free Cores** by voting for Role Reactor on Top.gg!`,
      ].join("\n"),
    )
    .setColor(THEME.PRO)
    .setFooter(UI_COMPONENTS.createFooter("Premium"))
    .setTimestamp();

  for (const feature of PREMIUM_FEATURES) {
    embed.addFields({
      name: `${feature.emoji} ${feature.name}`,
      value: [
        `**Free:** ${feature.free}`,
        `**${PRO_NAME}:** ${feature.pro}`,
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
