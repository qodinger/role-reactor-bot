import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { WEBSITE_URL } from "../../../config/domains.js";

const logger = getLogger();

export const metadata = {
  name: "dashboard",
  category: "admin",
  description: "Open the server dashboard",
  keywords: ["dashboard", "panel", "config", "settings"],
  emoji: "⚙️",
  premium: false,
  helpFields: [
    {
      name: "How to Use",
      value: "`/dashboard` — Opens the server dashboard in your browser",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName("dashboard")
  .setDescription("Open the server dashboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const guildId = interaction.guildId;

  try {
    const dashboardUrl = `${WEBSITE_URL}/dashboard/${guildId}`;

    const embed = {
      title: "⚙️ Server Dashboard",
      description: "Click the button below to open the dashboard.",
      color: 0x5865f2,
      fields: [
        {
          name: "Server",
          value: interaction.guild?.name || "Unknown",
          inline: true,
        },
      ],
    };

    const row = {
      type: 1,
      components: [
        {
          type: 2,
          label: "Open Dashboard",
          style: 5,
          url: dashboardUrl,
        },
      ],
    };

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });

    logger.info(`Dashboard link sent for guild ${guildId}`);
  } catch (error) {
    logger.error("Dashboard command error", error);
    await interaction.reply({
      content: "❌ An error occurred",
      ephemeral: true,
    });
  }
}
