import { AttachmentBuilder } from "discord.js";
import { getTicketManager } from "../../features/ticketing/TicketManager.js";
import { getTicketPanel } from "../../features/ticketing/TicketPanel.js";
import { getTicketTranscript } from "../../features/ticketing/TicketTranscript.js";
import { getLogger } from "../../utils/logger.js";
import {
  createTicketWelcomeEmbed,
  createTicketClaimedEmbed,
  createTicketClosedEmbed,
  createTicketActionButtons,
  createErrorEmbed,
  createSuccessEmbed,
  createTranscriptLogEmbed,
} from "../../features/ticketing/embeds.js";
import { DEFAULT_CATEGORY } from "../../features/ticketing/config.js";

const logger = getLogger();

/**
 * Handle ticket button interactions
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleTicketButtons(interaction) {
  const customId = interaction.customId;

  // Ticket creation buttons: ticket_create_*
  if (customId.startsWith("ticket_create_")) {
    return await handleTicketCreate(interaction, customId);
  }

  // Claim button: ticket_claim
  if (customId === "ticket_claim") {
    return await handleTicketClaim(interaction);
  }

  // Close button: ticket_close
  if (customId === "ticket_close") {
    return await handleTicketClose(interaction);
  }

  // Add user button: ticket_add_user
  if (customId === "ticket_add_user") {
    return await handleTicketAddUser(interaction);
  }

  // Transfer button: ticket_transfer
  if (customId === "ticket_transfer") {
    return await handleTicketTransfer(interaction);
  }
}

/**
 * Handle ticket creation from panel button
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} customId
 */
async function handleTicketCreate(interaction, customId) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const categoryId = customId.replace("ticket_create_", "");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const guild = interaction.guild;

    // Initialize managers
    const ticketManager = getTicketManager();
    const ticketPanel = getTicketPanel();
    await ticketManager.initialize();
    await ticketPanel.initialize();

    // Check ticket limit
    const limitCheck = await ticketManager.checkTicketLimit(guildId);
    if (limitCheck.hasReachedLimit) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `Please wait before creating another ticket or close existing ones.`,
            "Ticket Limit Reached",
            interaction.client,
          ),
        ],
      });
    }

    // Check if user already has an open ticket
    const openTickets = await ticketManager.getUserTickets(
      userId,
      guildId,
      "open",
    );
    if (openTickets.length > 0) {
      const existingTicket = openTickets[0];
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `You already have an open ticket!\n\n` +
              `Ticket: \`#${existingTicket.ticketId.split("-").pop()}\`\n` +
              `Channel: <#${existingTicket.channelId}>\n\n` +
              `Please close your existing ticket before creating a new one.`,
            "Ticket Limit Reached",
            interaction.client,
          ),
        ],
      });
    }

    // Get panel info
    const panel = await ticketPanel.getPanelByMessage(interaction.message.id);
    if (!panel) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "This ticket panel is no longer valid. Please contact an administrator.",
            "Panel Not Found",
            interaction.client,
          ),
        ],
      });
    }

    // Get next ticket number from atomic counter (peek only, actual increment happens in TicketManager.createTicket)
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    const ticketNumber = (settings?.counters?.ticket || 0) + 1;
    const channelName = `ticket-${ticketNumber.toString().padStart(4, "0")}`;

    // Check bot permissions before creating channel
    // We check both the guild-level and category-level permissions.
    const botMember = await guild.members.fetchMe();

    // 1. Initial global check
    if (!botMember.permissions.has("ManageChannels")) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "I don't have the **Manage Channels** permission globally.\n\n" +
              "Please enable this permission for the **Role Reactor Dev** role in **Server Settings**.",
            "Missing Global Permissions",
            interaction.client,
          ),
        ],
      });
    }

    // 2. Identify the target category
    // Default to the category the panel is in if nothing else is specified.
    const targetCategoryId =
      panel.settings?.ticketCategoryId || interaction.channel.parentId;
    const targetCategory = targetCategoryId
      ? guild.channels.cache.get(targetCategoryId)
      : null;

    // 3. Category-specific check (If a category exists, the bot must be allowed to Manage Channels *within* it)
    if (targetCategory) {
      const categoryPermissions = targetCategory.permissionsFor(botMember);
      if (
        !categoryPermissions?.has("ManageChannels") ||
        !categoryPermissions?.has("ViewChannel")
      ) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              `I'm blocked from managing channels in the **${targetCategory.name}** category.\n\n` +
                `Please right-click the category -> **Edit Category** -> **Permissions** -> and make sure **Role Reactor Dev** has "View Channel" and "Manage Channels" checked.`,
              "Missing Category Permissions",
              interaction.client,
            ),
          ],
        });
      }
    }

    let channel;
    let ticket;

    try {
      const staffRoles = await getStaffRoles(guild);
      const staffOverwrites = staffRoles.map(role => ({
        id: role.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      }));

      // Use configured category, or falls back to the category where the panel is.
      const parentId =
        panel.settings?.ticketCategoryId || interaction.channel.parentId;

      channel = await guild.channels.create({
        name: channelName,
        parent: parentId,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: ["ViewChannel"],
          },
          {
            id: userId,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
          },
          {
            id: interaction.client.user.id,
            allow: ["ViewChannel", "SendMessages", "ManageChannels"],
          },
          ...staffOverwrites,
        ],
      });

      // Create ticket in database
      ticket = await ticketManager.createTicket({
        guildId,
        channelId: channel.id,
        userId,
        userDisplayName: interaction.user.displayName,
        categoryId: categoryId === "default" ? "default" : categoryId,
      });

      if (!ticket) {
        await channel.delete("Failed to create ticket in database");
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Failed to create ticket. Please try again.",
              "Ticket Creation Failed",
              interaction.client,
            ),
          ],
        });
      }
    } catch (error) {
      logger.error("Ticket create error:", error);

      let errorMessage = "Please try again or contact an administrator.";
      let errorTitle = "Failed to Create Ticket";

      if (error.code === 50013) {
        errorMessage =
          "I don't have enough permissions to create the ticket channel.\n\n" +
          "Please verify that I have the **Manage Channels** permission and that it's not denied in the category I'm trying to create the ticket in.";
        errorTitle = "Missing Permissions";
      }

      return interaction.editReply({
        embeds: [
          createErrorEmbed(errorMessage, errorTitle, interaction.client),
        ],
      });
    }

    // Send welcome message (outside try-catch, ticket and channel are defined)
    const welcomeEmbed = createTicketWelcomeEmbed({
      ticketId: ticket.ticketId,
      ticketNumber: ticketNumber.toString().padStart(4, "0"),
      userName: `<@${userId}>`,
      category: DEFAULT_CATEGORY,
      client: interaction.client,
    });

    const actionButtons = createTicketActionButtons({
      canClaim: true,
      canClose: true,
      canAddUser: true,
      isClaimed: false,
    });

    await channel.send({
      embeds: [welcomeEmbed],
      components: actionButtons,
    });

    // Notify user
    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `Your ticket has been created: ${channel}\n\n` +
            `Please describe your issue and our team will help you shortly.`,
          "Ticket Created",
          interaction.client,
        ),
      ],
    });

    // Optional: Send notification to staff channel
    const staffChannel = await getStaffNotificationChannel(guild);
    if (staffChannel) {
      await staffChannel.send({
        embeds: [
          createSuccessEmbed(
            `🎫 **New Ticket Created**\n\n` +
              `User: <@${userId}>\n` +
              `Channel: ${channel}\n` +
              `Ticket: \`#${ticketNumber.toString().padStart(4, "0")}\``,
            "New Ticket",
            interaction.client,
          ),
        ],
      });
    }
  } catch (error) {
    console.error("Ticket create error:", error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to create ticket: ${error.message}`,
          "Request Failed",
          interaction.client,
        ),
      ],
    });
  }
}

/**
 * Handle ticket claim button
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTicketClaim(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const staffId = interaction.user.id;
    const channelId = interaction.channelId;

    // Check staff role
    const isStaff = await checkStaffRole(interaction);
    if (!isStaff) {
      const staffRoleId = await getStaffRoleId(interaction.guildId);
      const roleText = staffRoleId
        ? `the <@&${staffRoleId}> role`
        : "a staff role";
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `You need ${roleText} to claim tickets.`,
            "Permission Denied",
            interaction.client,
          ),
        ],
      });
    }

    // Initialize manager
    const ticketManager = getTicketManager();
    await ticketManager.initialize();

    // Get ticket
    const ticket = await ticketManager.getTicketByChannel(channelId);
    if (!ticket) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "This is not a ticket channel.",
            "Invalid Action",
            interaction.client,
          ),
        ],
      });
    }

    // Check if already claimed
    if (ticket.claimedBy) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `This ticket is already claimed by <@${ticket.claimedBy}>.`,
            "Ticket Already Claimed",
            interaction.client,
          ),
        ],
      });
    }

    // Claim ticket
    const success = await ticketManager.claimTicket(ticket.ticketId, staffId);
    if (!success) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to claim ticket.",
            "Claim Failed",
            interaction.client,
          ),
        ],
      });
    }

    // Update welcome message with claimed status
    const claimedEmbed = createTicketClaimedEmbed(
      `<@${interaction.user.id}>`,
      interaction.client,
    );
    await interaction.channel.send({ embeds: [claimedEmbed] });

    // Update button state
    const message = await interaction.channel.messages.fetch(
      interaction.message.id,
    );
    const newButtons = createTicketActionButtons({
      canClaim: false,
      canClose: true,
      canAddUser: true,
      isClaimed: true,
    });
    await message.edit({ components: newButtons });

    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `You are now handling this ticket.\n` +
            `Ticket: \`#${ticket.ticketId.split("-").pop()}\``,
          "Ticket Claimed",
          interaction.client,
        ),
      ],
    });
  } catch (error) {
    console.error("Ticket claim error:", error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to claim ticket: ${error.message}`,
          "Claim Failed",
          interaction.client,
        ),
      ],
    });
  }
}

/**
 * Handle ticket close button
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTicketClose(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    // Initialize managers
    const ticketManager = getTicketManager();
    const ticketTranscript = getTicketTranscript();
    await ticketManager.initialize();
    await ticketTranscript.initialize();

    // Get ticket
    const ticket = await ticketManager.getTicketByChannel(channelId);
    if (!ticket) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "This is not a ticket channel.",
            "Invalid Action",
            interaction.client,
          ),
        ],
      });
    }

    // Check authorization
    const isOwner = ticket.userId === userId;
    const isStaff = await checkStaffRole(interaction);

    if (!isOwner && !isStaff) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "You can only close your own tickets.",
            "Permission Denied",
            interaction.client,
          ),
        ],
      });
    }

    // Generate transcript
    const transcriptResult = await ticketTranscript.generateFromChannel({
      ticketId: ticket.ticketId,
      guildId: ticket.guildId,
      channel: interaction.channel,
      ticket,
      format: "html",
    });

    // Close ticket
    const success = await ticketManager.closeTicket(
      ticket.ticketId,
      userId,
      "Closed via button",
    );
    if (!success) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to close ticket.",
            "Close Failed",
            interaction.client,
          ),
        ],
      });
    }

    // Calculate duration
    const duration = formatDuration(new Date(ticket.openedAt), new Date());

    // Send close message
    const closeEmbed = createTicketClosedEmbed({
      ticketNumber: ticket.ticketId.split("-").pop(),
      closedBy: `<@${interaction.user.id}>`,
      reason: "Closed via button",
      duration,
      client: interaction.client,
    });

    // Send close notification publicly so everyone sees it
    await interaction.channel.send({ embeds: [closeEmbed] });
    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          "This ticket has been closed. Channel will be deleted shortly.",
          "Ticket Closed",
          interaction.client,
        ),
      ],
    });

    // Handle log channel
    if (transcriptResult.success) {
      try {
        const settings =
          await ticketManager.storage.dbManager.guildSettings.getByGuild(
            interaction.guildId,
          );
        const logChannelId = settings?.ticketSettings?.transcriptChannelId;

        if (logChannelId) {
          const logChannel = await interaction.guild.channels
            .fetch(logChannelId)
            .catch(() => null);
          if (logChannel) {
            const attachment = new AttachmentBuilder(
              Buffer.from(transcriptResult.content),
              {
                name: `transcript-${ticket.ticketId.split("-").pop()}.html`,
              },
            );

            const logEmbed = createTranscriptLogEmbed({
              ticketId: ticket.ticketId,
              userName: ticket.userDisplayName || "Unknown",
              userId: ticket.userId,
              closedBy: interaction.user.tag,
              reason: "Closed via button",
              duration: duration,
              messages: transcriptResult.transcript.messages,
              client: interaction.client,
            });

            await logChannel.send({ embeds: [logEmbed], files: [attachment] });
          }
        }
      } catch (err) {
        logger.debug(
          `Failed to send transcript to log channel: ${err.message}`,
        );
      }
    }

    // Delete channel after delay
    setTimeout(async () => {
      try {
        await interaction.channel.delete("Ticket closed");
      } catch (error) {
        console.error("Failed to delete ticket channel:", error);
      }
    }, 5000);
  } catch (error) {
    console.error("Ticket close error:", error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to close ticket: ${error.message}`,
          "Close Failed",
          interaction.client,
        ),
      ],
    });
  }
}

/**
 * Handle ticket add user button (shows modal)
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTicketAddUser(interaction) {
  try {
    // Check staff role
    const isStaff = await checkStaffRole(interaction);
    if (!isStaff) {
      const staffRoleId = await getStaffRoleId(interaction.guildId);
      const roleText = staffRoleId
        ? `the <@&${staffRoleId}> role`
        : "a staff role";
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            `You need ${roleText} to add users.`,
            "Permission Denied",
            interaction.client,
          ),
        ],
        ephemeral: true,
      });
    }

    // Show modal (to be implemented in modalSubmit handler)
    return interaction.showModal({
      customId: "ticket_add_user_modal",
      title: "Add User to Ticket",
      components: [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 4, // TextInput
              custom_id: "user_id",
              label: "User ID or Mention",
              style: 1, // Short
              placeholder: "Enter user ID or @mention",
              required: true,
              min_length: 17, // Discord ID length
              max_length: 100,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Ticket add user error:", error);
    return interaction.reply({
      embeds: [
        createErrorEmbed(
          `Failed to add user: ${error.message}`,
          "Add User Failed",
          interaction.client,
        ),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Handle ticket transfer button (shows modal)
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTicketTransfer(interaction) {
  try {
    // Check staff role
    const isStaff = await checkStaffRole(interaction);
    if (!isStaff) {
      const staffRoleId = await getStaffRoleId(interaction.guildId);
      const roleText = staffRoleId
        ? `the <@&${staffRoleId}> role`
        : "a staff role";
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            `You need ${roleText} to transfer tickets.`,
            "Permission Denied",
            interaction.client,
          ),
        ],
        ephemeral: true,
      });
    }

    // Show modal (to be implemented in modalSubmit handler)
    return interaction.showModal({
      customId: "ticket_transfer_modal",
      title: "Transfer Ticket",
      components: [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 4, // TextInput
              custom_id: "staff_id",
              label: "Staff User ID or Mention",
              style: 1, // Short
              placeholder: "Enter staff user ID or @mention",
              required: true,
              min_length: 17,
              max_length: 100,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Ticket transfer error:", error);
    return interaction.reply({
      embeds: [
        createErrorEmbed(
          `Failed to transfer ticket: ${error.message}`,
          "Transfer Failed",
          interaction.client,
        ),
      ],
      ephemeral: true,
    });
  }
}

/**
 * Check if user has staff role
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {Promise<boolean>}
 */
async function checkStaffRole(interaction) {
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const hasManagePerms =
      member.permissions.has("ManageMessages") ||
      member.permissions.has("ManageGuild");
    if (hasManagePerms) return true;

    try {
      const ticketManager = getTicketManager();
      await ticketManager.initialize();
      const settings =
        await ticketManager.storage.dbManager.guildSettings.getByGuild(
          interaction.guild.id,
        );
      const staffRoleId = settings?.ticketSettings?.staffRoleId;
      if (staffRoleId && member.roles.cache.has(staffRoleId)) {
        return true;
      }
    } catch {}
  } catch {}

  return false;
}

/**
 * Get the configured staff role ID for a guild
 * @param {string} guildId
 * @returns {Promise<string|null>}
 */
async function getStaffRoleId(guildId) {
  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    return settings?.ticketSettings?.staffRoleId || null;
  } catch {
    return null;
  }
}

/**
 * Get or create the default ticket category
 * @param {import('discord.js').Guild} guild
 * @param {Array} staffRoles
 * @returns {Promise<string|null>} Category ID
 */
async function getOrCreateTicketCategory(guild, staffRoles) {
  const CATEGORY_NAME = "🎫 TICKETS";

  try {
    // 1. Try to find existing category by name
    const existing = guild.channels.cache.find(
      c =>
        c.type === 4 && // CategoryChannel
        c.name.toLowerCase() === CATEGORY_NAME.toLowerCase(),
    );

    if (existing) return existing.id;

    // 2. Create if not found
    const overwrites = [
      {
        id: guild.roles.everyone,
        deny: ["ViewChannel"],
      },
    ];

    // Add staff roles permissions
    for (const role of staffRoles) {
      overwrites.push({
        id: role.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      });
    }

    const category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: 4, // Category
      permissionOverwrites: overwrites,
    });

    return category.id;
  } catch (error) {
    logger.error("Failed to get/create ticket category:", error);
    return null;
  }
}

/**
 * Get staff roles for channel overwrites
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<Array>} List of staff roles
 */
async function getStaffRoles(guild) {
  const roles = [];

  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guild.id);
    const staffRoleId = settings?.ticketSettings?.staffRoleId;
    if (staffRoleId && guild.roles.cache.has(staffRoleId)) {
      const customRole = guild.roles.cache.get(staffRoleId);
      roles.push(customRole);
    }
  } catch {}

  return roles;
}

/**
 * Get staff notification channel
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
async function getStaffNotificationChannel(guild) {
  try {
    // Try to find staff-pings channel
    const channel = guild.channels.cache.find(
      c => c.name === "staff-pings" && c.isTextBased(),
    );
    return channel || null;
  } catch {
    return null;
  }
}

/**
 * Format duration between two dates
 * @param {Date} start
 * @param {Date} end
 * @returns {string}
 */
function formatDuration(start, end) {
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMins % 60}m`;
  } else {
    return `${diffMins}m`;
  }
}
