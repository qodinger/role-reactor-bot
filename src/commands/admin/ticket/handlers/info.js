import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import { createInfoEmbed } from "../../../../features/ticketing/embeds.js";

import {
  FREE_TIER,
  PRO_ENGINE,
} from "../../../../features/ticketing/config.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket info
// ─────────────────────────────────────────────────────────────────────────────

export async function handleInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;

  const ticketPanel = getTicketPanel();
  const ticketManager = getTicketManager();
  const ticketTranscript = getTicketTranscript();

  await ticketPanel.initialize();
  await ticketManager.initialize();
  await ticketTranscript.initialize();

  return await handleInfoView(
    interaction,
    guildId,
    ticketPanel,
    ticketManager,
    ticketTranscript,
  );
}

async function handleInfoView(
  interaction,
  guildId,
  ticketPanel,
  ticketManager,
  ticketTranscript,
) {
  const panels = await ticketPanel.getGuildPanels(guildId);
  const ticketLimit = await ticketManager.checkTicketLimit(guildId);
  const storageUsage = await ticketTranscript.getStorageUsage(guildId);

  const settings =
    await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
  const staffRoleId = settings?.ticketSettings?.staffRoleId;
  const staffRoleDisplay = staffRoleId
    ? `<@&${staffRoleId}>`
    : "Not configured";

  const logChannelId = settings?.ticketSettings?.transcriptChannelId;
  const logChannelDisplay = logChannelId
    ? `<#${logChannelId}>`
    : "Not configured";

  const notifyChannelId = settings?.ticketSettings?.notificationChannelId;
  const notifyChannelDisplay = notifyChannelId
    ? `<#${notifyChannelId}>`
    : "Default (Logs/Staff Pings)";

  const allowUserTranscripts =
    settings?.ticketSettings?.allowUserTranscripts !== false;
  const userTranscriptsDisplay = allowUserTranscripts ? "Enabled" : "Disabled";

  const limits = ticketLimit.isPro ? PRO_ENGINE : FREE_TIER;

  const embed = createInfoEmbed(
    "Ticket System Information",
    "Current ticket system limits and settings.",
    interaction.client,
  ).addFields(
    { name: "Staff Role", value: staffRoleDisplay, inline: true },
    { name: "Staff Alerts", value: notifyChannelDisplay, inline: true },
    { name: "Log Channel", value: logChannelDisplay, inline: true },
    {
      name: "Member Export",
      value: userTranscriptsDisplay,
      inline: true,
    },
    {
      name: "Panels",
      value: `${panels.length} / ${limits.MAX_PANELS}`,
      inline: true,
    },
    {
      name: "Monthly Tickets",
      value: `${ticketLimit.current} / ${limits.MAX_TICKETS_PER_MONTH}`,
      inline: true,
    },
    {
      name: "Tier",
      value: ticketLimit.isPro ? "Pro Engine" : "Free Tier",
      inline: true,
    },
    {
      name: "Storage Usage",
      value: `${storageUsage.totalTranscripts} files • ${storageUsage.totalSizeMB} MB`,
      inline: true,
    },
    {
      name: "Categories",
      value: `${limits.MAX_CATEGORIES} ${ticketLimit.isPro ? "(Pro)" : "(Free)"}`,
      inline: true,
    },
    {
      name: "Retention",
      value:
        limits.TRANSCRIPT_RETENTION_DAYS === -1
          ? "Unlimited"
          : `${limits.TRANSCRIPT_RETENTION_DAYS} days`,
      inline: true,
    },
    {
      name: "Exports",
      value: limits.EXPORT_FORMATS.map(f => f.toUpperCase()).join(", "),
      inline: true,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}
