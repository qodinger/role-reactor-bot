import { getLogger } from "../../../utils/logger.js";
import {
  errorEmbed,
  successEmbed,
} from "../../../utils/discord/responseMessages.js";

const logger = getLogger();

export async function handleCreate(interaction) {
  const channel = interaction.options.getChannel("channel");
  const role = interaction.options.getRole("role");
  const maxAgeHours = interaction.options.getInteger("max-age") || 24;
  const maxUses = interaction.options.getInteger("max-uses");

  const hasPermission = channel
    .permissionsFor(interaction.guild.members.me)
    .has("CreateInstantInvite");

  if (!hasPermission) {
    return interaction.reply(
      errorEmbed({
        title: "Permission Error",
        description:
          "I don't have permission to create invites in this channel.",
      }),
    );
  }

  const inviteOptions = {
    maxAge: maxAgeHours * 3600,
    reason: `Invite with auto-role: ${role.name}`,
  };

  if (maxUses) {
    inviteOptions.maxUses = maxUses;
  }

  try {
    const invite = await channel.createInvite(inviteOptions);
    const inviteUrl = `https://discord.gg/${invite.code}`;

    return interaction.reply(
      successEmbed({
        title: "Invite Created",
        description:
          `Created invite with auto-role!\n\n` +
          `**Invite:** ${inviteUrl}\n` +
          `**Channel:** ${channel.name}\n` +
          `**Role:** ${role.name}\n` +
          `**Max Age:** ${maxAgeHours} hours${
            maxUses ? `\n**Max Uses:** ${maxUses}` : ""
          }`,
      }),
    );
  } catch (error) {
    logger.error("Error creating invite:", error);
    return interaction.reply(
      errorEmbed({
        title: "Failed to Create Invite",
        description: "Could not create invite. Please check my permissions.",
      }),
    );
  }
}

export async function handleList(interaction) {
  const guild = interaction.guild;

  const invites = await guild.invits.fetch();

  const invitesWithInfo = invites.map(invite => ({
    code: invite.code,
    channel: invite.channel?.name || "Unknown",
    uses: invite.uses || 0,
    maxUses: invite.maxUses || "∞",
    maxAge: invite.maxAge ? `${Math.floor(invite.maxAge / 3600)}h` : "∞",
    inviter: invite.inviter?.username || "Unknown",
  }));

  if (invitesWithInfo.length === 0) {
    return interaction.reply({
      content: "No invites found in this server.",
      ephemeral: true,
    });
  }

  const list = invitesWithInfo
    .slice(0, 10)
    .map(
      i => `• ${i.code} | ${i.channel} | ${i.uses}/${i.maxUses} | ${i.maxAge}`,
    )
    .join("\n");

  return interaction.reply({
    content: `**Server Invites (showing first 10):**\n${list}`,
    ephemeral: true,
  });
}

export async function handleInviteRolesCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "create":
      return handleCreate(interaction);
    case "list":
      return handleList(interaction);
    default:
      return interaction.reply(
        errorEmbed({
          title: "Unknown Subcommand",
          description: `The subcommand "${subcommand}" is not recognized.`,
          solution: "Please use a valid subcommand.",
        }),
      );
  }
}
