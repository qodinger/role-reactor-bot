import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import {
  createInfoEmbed,
} from "../../../../features/ticketing/embeds.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket info
// ─────────────────────────────────────────────────────────────────────────────

export async function handleInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const action = interaction.options.getString("action") || "view";
  const guildId = interaction.guildId;

  const ticketPanel = getTicketPanel();
  const ticketManager = getTicketManager();
  const ticketTranscript = getTicketTranscript();

  await ticketPanel.initialize();
  await ticketManager.initialize();
  await ticketTranscript.initialize();

  if (action === "view") {
    return await handleInfoView(
      interaction,
      guildId,
      ticketPanel,
      ticketManager,
    );
  } else if (action === "stats") {
    return await handleInfoStats(interaction, guildId, ticketManager);
  } else if (action === "storage") {
    return await handleInfoStorage(interaction, guildId, ticketTranscript);
  }
}

async function handleInfoView(
  interaction,
  guildId,
  ticketPanel,
  ticketManager,
) {
  const panels = await ticketPanel.getGuildPanels(guildId);
  const panelLimit = await ticketPanel.checkPanelLimit(guildId);
  const ticketLimit = await ticketManager.checkTicketLimit(guildId);

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

  const allowUserTranscripts =
    settings?.ticketSettings?.allowUserTranscripts !== false;
  const userTranscriptsDisplay = allowUserTranscripts ? "Enabled" : "Disabled";

  const embed = createInfoEmbed(
    "Ticket System Information",
    "Current ticket system limits and settings.",
    interaction.client,
  ).addFields(
    { name: "Staff Role", value: staffRoleDisplay, inline: true },
    { name: "Log Channel", value: logChannelDisplay, inline: true },
    {
      name: "Member Export",
      value: userTranscriptsDisplay,
      inline: true,
    },
    {
      name: "Panels",
      value: `${panels.length} / ${panelLimit.max}`,
      inline: true,
    },
    {
      name: "Monthly Tickets",
      value: `${ticketLimit.current} / ${ticketLimit.max}`,
      inline: true,
    },
    {
      name: "Tier",
      value: ticketLimit.isPro ? "Pro Engine" : "Free Tier",
      inline: true,
    },
    {
      name: "Categories",
      value: ticketLimit.isPro ? "20 (Pro)" : "3 (Free)",
      inline: true,
    },
    {
      name: "Retention",
      value: ticketLimit.isPro ? "Unlimited" : "7 days",
      inline: true,
    },
    {
      name: "Exports",
      value: ticketLimit.isPro ? "HTML, JSON, MD" : "MD (Markdown)",
      inline: true,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}

async function handleInfoStats(interaction, guildId, ticketManager) {
  const stats = await ticketManager.getGuildStats(guildId);

  const embed = createInfoEmbed(
    "Ticket Statistics",
    "Ticket usage statistics for this server.",
    interaction.client,
  ).addFields(
    { name: "Total (Month)", value: stats.current.toString(), inline: true },
    { name: "Open", value: stats.open.toString(), inline: true },
    { name: "Closed", value: stats.closed.toString(), inline: true },
    { name: "Archived", value: stats.archived.toString(), inline: true },
    {
      name: "Tier",
      value: stats.isPro ? "Pro Engine" : "Free Tier",
      inline: true,
    },
    {
      name: "Usage",
      value: `${stats.current} / ${stats.limit} (${Math.round((stats.current / stats.limit) * 100)}%)`,
      inline: true,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}

async function handleInfoStorage(interaction, guildId, ticketTranscript) {
  const usage = await ticketTranscript.getStorageUsage(guildId);

  const embed = createInfoEmbed(
    "Transcript Storage",
    "Transcript storage usage for this server.",
    interaction.client,
  ).addFields(
    {
      name: "Transcripts",
      value: usage.totalTranscripts.toString(),
      inline: true,
    },
    { name: "Storage", value: `${usage.totalSizeMB} MB`, inline: true },
    {
      name: "Avg Size",
      value:
        usage.totalTranscripts > 0
          ? `${((parseFloat(usage.totalSizeMB) / usage.totalTranscripts) * 1024).toFixed(2)} KB`
          : "0 KB",
      inline: true,
    },
  );

  return interaction.editReply({ embeds: [embed] });
}
