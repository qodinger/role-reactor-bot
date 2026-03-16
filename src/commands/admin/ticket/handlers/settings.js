import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";
import { getTicketPanel } from "../../../../features/ticketing/TicketPanel.js";
import { getTicketManager } from "../../../../features/ticketing/TicketManager.js";
import { getTicketTranscript } from "../../../../features/ticketing/TicketTranscript.js";
import {
  createInfoEmbed,
} from "../../../../features/ticketing/embeds.js";
import { EMOJIS } from "../../../../config/theme.js";

// ─────────────────────────────────────────────────────────────────────────────
// /ticket settings — Interactive Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function handleSettings(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const ticketManager = getTicketManager();
  const ticketPanel = getTicketPanel();
  const ticketTranscript = getTicketTranscript();

  await ticketManager.initialize();
  await ticketPanel.initialize();
  await ticketTranscript.initialize();

  const renderDashboard = async inter => {
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    const panels = await ticketPanel.getGuildPanels(guildId);
    const panelLimit = await ticketPanel.checkPanelLimit(guildId);
    const ticketLimit = await ticketManager.checkTicketLimit(guildId);

    const staffRoleId = settings?.ticketSettings?.staffRoleId;
    const staffRoleDisplay = staffRoleId
      ? `${EMOJIS.FEATURES.ROLES} <@&${staffRoleId}>`
      : `${EMOJIS.STATUS.WARNING} Not Set`;

    const logChannelId = settings?.ticketSettings?.transcriptChannelId;
    const logChannelDisplay = logChannelId
      ? `${EMOJIS.UI.CHANNELS} <#${logChannelId}>`
      : `${EMOJIS.STATUS.WARNING} Not Set`;

    const notifyChannelId = settings?.ticketSettings?.notificationChannelId;
    const notifyChannelDisplay = notifyChannelId
      ? `${EMOJIS.UI.CHANNELS} <#${notifyChannelId}>`
      : `${EMOJIS.STATUS.WARNING} Not Set`;

    const allowUserTranscripts =
      settings?.ticketSettings?.allowUserTranscripts !== false;
    const accessDisplay = allowUserTranscripts
      ? `${EMOJIS.STATUS.SUCCESS} Enabled`
      : `⚫ Disabled`;

    const tierDisplay = ticketLimit.isPro
      ? `${EMOJIS.FEATURES.PREMIUM} Pro Engine`
      : `${EMOJIS.ACTIONS.FREE} Free Tier`;

    const embed = new EmbedBuilder()
      .setTitle("Ticketing System")
      .setDescription("Configure support tickets for your server")
      .setColor(0x5865f2)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Ticketing System",
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .addFields([
        {
          name: "Staff Role",
          value: staffRoleDisplay,
          inline: true,
        },
        {
          name: "Log Channel",
          value: logChannelDisplay,
          inline: true,
        },
        {
          name: "Notify Channel",
          value: notifyChannelDisplay,
          inline: true,
        },
        {
          name: "Member Export",
          value: accessDisplay,
          inline: true,
        },
        {
          name: "Active Panels",
          value: `${panels.length} / ${panelLimit.max}`,
          inline: true,
        },
        {
          name: "Tickets Used",
          value: `${ticketLimit.current} / ${ticketLimit.max}`,
          inline: true,
        },
        {
          name: "Tier",
          value: tierDisplay,
          inline: true,
        },
      ]);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("t_set_staff")
        .setLabel("Set Staff Role")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("t_set_logs")
        .setLabel("Set Log Channel")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("t_set_notifs")
        .setLabel("Set Notify Channel")
        .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("t_set_access")
        .setLabel(
          allowUserTranscripts
            ? "Disable Member Export"
            : "Enable Member Export",
        )
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("t_list_panels")
        .setLabel("View Panels")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("t_reset_tickets")
        .setLabel("Reset Tickets")
        .setStyle(ButtonStyle.Danger),
    );

    const response = {
      embeds: [embed],
      components: [row1, row2],
    };

    if (inter.replied || inter.deferred) {
      return await inter.editReply(response);
    } else {
      return await inter.update(response);
    }
  };

  const message = await renderDashboard(interaction);

  // Interaction Collector
  const collector = message.createMessageComponentCollector({
    time: 600000, // 10 minutes
  });

  collector.on("collect", async i => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        content: "This menu is not for you.",
        ephemeral: true,
      });
    }

    // Acknowledge immediately to prevent Discord's 3-second timeout
    await i.deferUpdate();

    if (i.customId === "t_back") {
      return await renderDashboard(i);
    }

    if (i.customId === "t_set_staff") {
      const roleRow = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("t_role_select")
          .setPlaceholder("Select the Staff Role")
          .setMaxValues(1),
      );
      return await i.editReply({
        content: "Please select the role that should handle tickets:",
        components: [roleRow],
      });
    }

    if (i.customId === "t_set_logs") {
      const chanRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("t_chan_select")
          .setPlaceholder("Select the Transcript Log Channel")
          .addChannelTypes(0), // Text channels
      );
      return await i.editReply({
        content: "Please select the channel where transcripts should be sent:",
        components: [chanRow],
      });
    }

    if (i.customId === "t_set_notifs") {
      const chanRow = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("t_notify_select")
          .setPlaceholder("Select the Staff Notification Channel")
          .addChannelTypes(0), // Text channels
      );
      return await i.editReply({
        content:
          "Please select the channel where new ticket alerts should be sent:",
        components: [chanRow],
      });
    }

    if (i.customId === "t_set_access") {
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
      settings.ticketSettings = settings.ticketSettings || {};
      const current = settings.ticketSettings.allowUserTranscripts !== false;
      settings.ticketSettings.allowUserTranscripts = !current;
      await ticketManager.storage.dbManager.guildSettings.set(
        guildId,
        settings,
      );
      return await renderDashboard(i);
    }

    if (i.customId === "t_list_panels") {
      const panels = await ticketPanel.getGuildPanels(guildId);
      const panelLimitResult = await ticketPanel.checkPanelLimit(guildId);

      if (panels.length === 0) {
        await i.followUp({
          embeds: [
            createInfoEmbed(
              "Ticket Panels",
              "No ticket panels have been set up yet.\nUse `/ticket setup` to create one.",
              i.client,
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const panelList = panels
        .map(p => {
          const status = p.settings?.enabled ? "🟢" : "🔴";
          const link =
            p.messageId && p.channelId
              ? `([Jump to Panel](https://discord.com/channels/${guildId}/${p.channelId}/${p.messageId}))`
              : "";
          return `${status} **${p.title}** (\`#${p.panelId.split("-").pop()}\`) <#${p.channelId}> ${link}`;
        })
        .join("\n");

      await i.followUp({
        embeds: [
          createInfoEmbed(
            `Ticket Panels (${panels.length} / ${panelLimitResult.max})`,
            "Here are all the ticket panels configured for this server:\n\n" +
              panelList,
            i.client,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Handle Select Menus
    if (i.customId === "t_role_select") {
      const roleId = i.values[0];
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
      settings.ticketSettings = settings.ticketSettings || {};
      settings.ticketSettings.staffRoleId = roleId;
      await ticketManager.storage.dbManager.guildSettings.set(
        guildId,
        settings,
      );
      return await renderDashboard(i);
    }

    if (i.customId === "t_chan_select") {
      const channelId = i.values[0];
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
      settings.ticketSettings = settings.ticketSettings || {};
      settings.ticketSettings.transcriptChannelId = channelId;
      await ticketManager.storage.dbManager.guildSettings.set(
        guildId,
        settings,
      );
      return await renderDashboard(i);
    }

    if (i.customId === "t_notify_select") {
      const channelId = i.values[0];
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
      settings.ticketSettings = settings.ticketSettings || {};
      settings.ticketSettings.notificationChannelId = channelId;
      await ticketManager.storage.dbManager.guildSettings.set(
        guildId,
        settings,
      );
      return await renderDashboard(i);
    }

    if (i.customId === "t_reset_tickets") {
      // Check for open tickets first
      const openCount = await ticketManager.storage.countOpenTickets(guildId);

      if (openCount > 0) {
        const backRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("t_back")
            .setLabel("Back to Settings")
            .setStyle(ButtonStyle.Secondary),
        );

        return await i.editReply({
          content:
            `### ⚠️ Cannot Reset Tickets\n` +
            `There are still **${openCount}** open ticket(s).\n\n` +
            `Please close all tickets before resetting to avoid orphaned threads with broken buttons.`,
          embeds: [],
          components: [backRow],
        });
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("t_confirm_reset")
          .setLabel("Confirm Reset")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("t_back")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      );

      return await i.editReply({
        content: `### ⚠️ Reset Tickets\nThis will permanently delete:\n- All closed tickets\n- All saved transcripts\n- Reset the counter to \`#0001\`\n\nYour **panels** and **settings** will not be affected.\n\n**This action cannot be undone.**`,
        embeds: [],
        components: [confirmRow],
      });
    }

    if (i.customId === "t_confirm_reset") {
      await ticketManager.purgeGuildData(guildId);
      return await renderDashboard(i);
    }
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {}
  });
}
