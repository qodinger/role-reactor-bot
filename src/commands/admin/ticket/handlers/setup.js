import {
  PermissionFlagsBits,
} from "discord.js";
import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import { DEFAULT_CATEGORY } from "../../../../features/ticketing/config.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket setup
// ─────────────────────────────────────────────────────────────────────────────

export async function handleSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel("channel");
  const title = interaction.options.getString("title") || "Support Tickets";
  const description =
    interaction.options.getString("description") ||
    "Click a button below to create a ticket and get support from our team.";
  const colorInput = interaction.options.getString("color");

  let color = 0x5865f2;
  if (colorInput) {
    const hex = colorInput.startsWith("#") ? colorInput.slice(1) : colorInput;
    color = parseInt(hex, 16) || 0x5865f2;
  }

  if (!channel.isTextBased()) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Please select a text channel.",
          "Invalid Channel",
          interaction.client,
        ),
      ],
    });
  }

  // Require a staff role before creating a panel
  const ticketManager = getTicketManager();
  await ticketManager.initialize();
  const settings =
    await ticketManager.storage.dbManager.guildSettings.getByGuild(
      interaction.guildId,
    );
  const staffRoleId = settings?.ticketSettings?.staffRoleId;

  if (!staffRoleId) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "You need to configure a Staff Role before creating a ticket panel. This ensures the bot knows who has permission to view and manage user tickets.\n\n" +
            `Please run </ticket settings:${interaction.commandId}> to set it up.`,
          "No Staff Role Configured",
          interaction.client,
        ),
      ],
    });
  }

  // Check bot permissions
  const botMember = await interaction.guild.members.me;
  const requiredPerms = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageThreads,
    PermissionFlagsBits.CreatePrivateThreads,
  ];
  if (!botMember.permissions.has(requiredPerms)) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "I don't have the required permissions in this server.\n\n" +
            "I need **Manage Channels**, **Manage Threads**, and **Create Private Threads** permissions to set up the ticketing system. Please enable them in my role settings.",
          "Missing Permissions",
          interaction.client,
        ),
      ],
    });
  }

  const ticketPanel = getTicketPanel();
  await ticketPanel.initialize();

  const result = await ticketPanel.createPanel({
    guildId: interaction.guildId,
    channelId: channel.id,
    title,
    description,
    categories: [DEFAULT_CATEGORY],
    settings: {},
    styling: { color },
  });

  if (!result.success) {
    return interaction.editReply({ embeds: [result.error] });
  }

  const sendResult = await ticketPanel.sendPanelMessage({
    channel,
    panel: result.panel,
  });

  if (!sendResult.success) {
    return interaction.editReply({ embeds: [sendResult.error] });
  }

  return interaction.editReply({
    embeds: [
      createSuccessEmbed(
        `**Panel:** \`#${result.panel.panelId.split("-").pop()}\`\n` +
          `**Channel:** ${channel}`,
        "Panel Created",
        interaction.client,
      ),
    ],
  });
}
