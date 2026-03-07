import { getTicketManager } from "../../features/ticketing/TicketManager.js";
import {
  createSuccessEmbed,
  createErrorEmbed,
} from "../../features/ticketing/embeds.js";

/**
 * Handle ticket modal submissions
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export async function handleTicketModals(interaction) {
  const customId = interaction.customId;

  // Add user modal: ticket_add_user_modal
  if (customId === "ticket_add_user_modal") {
    return await handleAddUserModal(interaction);
  }

  // Transfer modal: ticket_transfer_modal
  if (customId === "ticket_transfer_modal") {
    return await handleTransferModal(interaction);
  }
}

/**
 * Handle add user modal submission
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleAddUserModal(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userIdInput = interaction.fields.getTextInputValue("user_id");
    const channelId = interaction.channelId;
    const guild = interaction.guild;

    // Initialize manager
    const ticketManager = getTicketManager();
    await ticketManager.initialize();

    // Get ticket from channel
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

    // Parse user ID from input (could be mention or raw ID)
    const userId = parseUserId(userIdInput);
    if (!userId) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Please enter a valid Discord user ID or @mention.",
            "Invalid user ID or mention",
            interaction.client,
          ),
        ],
      });
    }

    // Check if user exists in guild
    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch (_error) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Please make sure the user is a member of this server.",
            "User not found in this server",
            interaction.client,
          ),
        ],
      });
    }

    // Check if user is already in ticket
    if (ticket.participants?.includes(userId)) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `${member} is already a participant in this ticket.`,
            "User Already Participant",
            interaction.client,
          ),
        ],
      });
    }

    // Add user to ticket in database
    const success = await ticketManager.addUserToTicket(
      ticket.ticketId,
      userId,
    );
    if (!success) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to add user to the ticket.",
            "Error",
            interaction.client,
          ),
        ],
      });
    }

    // Add user to channel permissions
    try {
      await interaction.channel.permissionOverwrites.edit(member, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    } catch (error) {
      console.error("Failed to add user to channel permissions:", error);
    }

    // Success!
    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `${member} has been added to this ticket.\n\n` +
            `They can now view and participate in the conversation.`,
          "User Added",
          interaction.client,
        ),
      ],
    });
  } catch (_error) {
    console.error("Add user modal error:", _error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to add user: ${_error.message}`,
          "Request Failed",
          interaction.client,
        ),
      ],
    });
  }
}

/**
 * Handle transfer modal submission
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleTransferModal(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const staffIdInput = interaction.fields.getTextInputValue("staff_id");
    const channelId = interaction.channelId;
    const guild = interaction.guild;

    // Initialize manager
    const ticketManager = getTicketManager();
    await ticketManager.initialize();

    // Get ticket from channel
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

    // Parse user ID from input
    const staffId = parseUserId(staffIdInput);
    if (!staffId) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Please enter a valid Discord user ID or @mention.",
            "Invalid staff user ID or mention",
            interaction.client,
          ),
        ],
      });
    }

    // Check if target user is staff
    let targetMember;
    try {
      targetMember = await guild.members.fetch(staffId);
    } catch (_error) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Staff member not found in this server.",
            "Error",
            interaction.client,
          ),
        ],
      });
    }

    const isTargetStaff = await checkStaffRoleForMember(targetMember, guild.id);
    if (!isTargetStaff) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Please select a user with a staff role.",
            `${targetMember.user.tag} is not a staff member`,
            interaction.client,
          ),
        ],
      });
    }

    // Transfer the ticket
    const success = await ticketManager.transferTicket(
      ticket.ticketId,
      staffId,
    );
    if (!success) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to transfer the ticket.",
            "Error",
            interaction.client,
          ),
        ],
      });
    }

    // Success!
    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          `This ticket has been transferred to ${targetMember}.\n\n` +
            `They are now responsible for handling this ticket.`,
          "Ticket Transferred",
          interaction.client,
        ),
      ],
    });
  } catch (_error) {
    console.error("Transfer modal error:", _error);
    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          `Failed to transfer ticket: ${_error.message}`,
          "Request Failed",
          interaction.client,
        ),
      ],
    });
  }
}

/**
 * Parse user ID from input (mention or raw ID)
 * @param {string} input - User input
 * @returns {string|null} User ID or null
 */
function parseUserId(input) {
  if (!input) return null;

  // Trim whitespace
  input = input.trim();

  // Check for mention format: <@123456789> or <@!123456789>
  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  // Check for raw ID (17-20 digits)
  if (/^\d{17,20}$/.test(input)) {
    return input;
  }

  return null;
}

/**
 * Check if member has staff role
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<boolean>}
 */
async function checkStaffRoleForMember(member, guildId) {
  const hasManagePerms =
    member.permissions.has("ManageMessages") ||
    member.permissions.has("ManageGuild");

  if (hasManagePerms) return true;

  try {
    const ticketManager = getTicketManager();
    await ticketManager.initialize();
    const settings =
      await ticketManager.storage.dbManager.guildSettings.getByGuild(guildId);
    const staffRoleId = settings?.ticketSettings?.staffRoleId;
    if (staffRoleId && member.roles.cache.has(staffRoleId)) {
      return true;
    }
  } catch {}

  return false;
}
