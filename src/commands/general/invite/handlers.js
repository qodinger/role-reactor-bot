import { getDefaultInviteLink } from "../../../utils/discord/invite.js";
import { createInviteEmbed } from "./embeds.js";
import { createInviteButtons } from "./components.js";

export async function execute(interaction, client) {
  try {
    // Generate invite link dynamically
    let inviteLink = client.inviteLink;
    if (!inviteLink) {
      inviteLink = await getDefaultInviteLink(client);
    }
    if (!inviteLink) {
      throw new Error("Unable to generate invite link.");
    }

    const botName = client.user?.username || "Role Reactor";
    const botAvatar = client.user?.displayAvatarURL() || null;
    const userName = interaction.user.displayName || interaction.user.username;

    const embed = createInviteEmbed(botName, botAvatar, userName, inviteLink);
    const buttons = createInviteButtons(inviteLink);

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      flags: 64,
    });
  } catch (_error) {
    await interaction.reply({
      content: `❌ Unable to generate invite link. Please try again later or contact support.`,
      flags: 64,
    });
  }
}
