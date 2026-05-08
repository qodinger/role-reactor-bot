import { PermissionFlagsBits, MessageFlags } from "discord.js";
import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
} from "../../../../features/ticketing/embeds.js";
import { DEFAULT_CATEGORY } from "../../../../features/ticketing/config.js";
import { InputSanitizer } from "../../../../utils/validation/inputValidation.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket setup
// ─────────────────────────────────────────────────────────────────────────────

export async function handleSetup(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const channel = interaction.options.getChannel("channel");
  const title = InputSanitizer.sanitize(
    interaction.options.getString("title") || "Support Tickets",
  );
  const description = InputSanitizer.sanitize(
    interaction.options.getString("description") ||
      "Click a button below to create a ticket and get support from our team.",
  );
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

  // Require all settings before creating a panel
  const ticketManager = getTicketManager();
  await ticketManager.initialize();
  const settings =
    await ticketManager.storage.dbManager.guildSettings.getByGuild(
      interaction.guildId,
    );

  const staffRoleId = settings?.ticketSettings?.staffRoleId;
  const logChannelId = settings?.ticketSettings?.transcriptChannelId;
  const notifyChannelId = settings?.ticketSettings?.notificationChannelId;

  const missing = [];
  if (!staffRoleId)
    missing.push("• **Staff Role** — who can view and manage tickets");
  if (!logChannelId)
    missing.push(
      "• **Log Channel** — where transcripts are sent after closing",
    );
  if (!notifyChannelId)
    missing.push(
      "• **Notify Channel** — where staff receive new ticket alerts",
    );

  if (missing.length > 0) {
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "The following settings must be configured before creating a ticket panel:\n\n" +
            missing.join("\n") +
            `\n\nPlease run </ticket settings:${interaction.commandId}> to set them up.`,
          "Setup Incomplete",
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
