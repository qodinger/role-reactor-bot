import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import {
  errorEmbed,
  successEmbed,
} from "../../../utils/discord/responseMessages.js";

export const metadata = {
  name: "invite-roles",
  category: "admin",
  description: "Create invites that grant roles when joined",
  keywords: ["invite", "roles", "auto-role", "onboarding", "welcome"],
  emoji: "🎟️",
  helpFields: [
    {
      name: `How to Use`,
      value:
        "```/invite-roles create channel:#general role:@Member max-age:24```",
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**create** - Create an invite with auto-role",
        "**list** - List all invites with auto-role",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Channel** and **Create Invite** permissions required",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(
    PermissionFlagsBits.ManageChannels |
      PermissionFlagsBits.CreateInstantInvite,
  )
  .addSubcommand(sub =>
    sub
      .setName("create")
      .setDescription("Create an invite that grants roles when joined")
      .addChannelOption(opt =>
        opt
          .setName("channel")
          .setDescription("Channel to create invite in")
          .setRequired(true),
      )
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("Role to grant when invite is used")
          .setRequired(true),
      )
      .addIntegerOption(opt =>
        opt
          .setName("max-age")
          .setDescription("Max age in hours (default: 24)")
          .setMinValue(1)
          .setMaxValue(168)
          .setRequired(false),
      )
      .addIntegerOption(opt =>
        opt
          .setName("max-uses")
          .setDescription("Max uses (default: unlimited)")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub.setName("list").setDescription("List all invites with auto-role"),
  );

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need admin permissions to manage invites with roles.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      return handleCreate(interaction);
    }

    if (subcommand === "list") {
      return handleList(interaction);
    }
  } catch (error) {
    logger.error("Error in invite-roles command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process invite-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

async function handleCreate(interaction) {
  const channel = interaction.options.getChannel("channel");
  const role = interaction.options.getRole("role");
  const maxAgeHours = interaction.options.getInteger("max-age") || 24;
  const maxUses = interaction.options.getInteger("max-uses");

  if (
    !channel
      .permissionsFor(interaction.guild.members.me)
      .has("CreateInstantInvite")
  ) {
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
        description: `Created invite with auto-role!\n\n**Invite:** ${inviteUrl}\n**Channel:** ${channel.name}\n**Role:** ${role.name}\n**Max Age:** ${maxAgeHours} hours${maxUses ? `\n**Max Uses:** ${maxUses}` : ""}`,
      }),
    );
  } catch (_error) {
    return interaction.reply(
      errorEmbed({
        title: "Failed to Create Invite",
        description: "Could not create invite. Please check my permissions.",
      }),
    );
  }
}

async function handleList(interaction) {
  const guild = interaction.guild;

  const invites = await guild.invites.fetch();

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
