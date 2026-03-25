import { MessageFlags } from "discord.js";
import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import { createInfoEmbed } from "../../../../features/ticketing/embeds.js";

import {
  FREE_TIER,
  PRO_ENGINE,
} from "../../../../features/ticketing/config.js";
import { CORE_STATUS } from "../../../../features/premium/config.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket info
// ─────────────────────────────────────────────────────────────────────────────

export async function handleInfo(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
    {
      name: "⚙️ System Configuration",
      value: [
        `**Staff Role:** ${staffRoleDisplay}`,
        `**Staff Alerts:** ${notifyChannelDisplay}`,
        `**Log Channel:** ${logChannelDisplay}`,
        `**User Self-Exports:** ${userTranscriptsDisplay}`,
      ].join("\n"),
      inline: false,
    },
    {
      name: "📊 Limits & Usage",
      value: [
        `**Tier Plan:** ${ticketLimit.isPro ? `${CORE_STATUS.PRO.emoji} ${CORE_STATUS.PRO.label}` : CORE_STATUS.REGULAR.label}`,
        `**Monthly Tickets:** ${ticketLimit.current} / ${limits.MAX_TICKETS_PER_MONTH}`,
        `**Active Panels:** ${panels.length} / ${limits.MAX_PANELS}`,
        `**Max Categories:** ${limits.MAX_CATEGORIES} per Panel`,
      ].join("\n"),
      inline: false,
    },
    {
      name: "💾 Storage & Data",
      value: [
        `**Usage:** ${storageUsage.totalTranscripts} files (${storageUsage.totalSizeMB} MB)`,
        `**Retention:** ${limits.TRANSCRIPT_RETENTION_DAYS === -1 ? "Unlimited" : `${limits.TRANSCRIPT_RETENTION_DAYS} Days`}`,
        `**Exports:** ${limits.EXPORT_FORMATS.map(f => f.toUpperCase()).join(", ")}`,
      ].join("\n"),
      inline: false,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}
