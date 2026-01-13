// Temporary placeholder - temp-roles command disabled during credit system refactoring
// TODO: Fix syntax errors and restore full functionality

import { errorEmbed } from "../../../utils/discord/responseMessages.js";

export async function handleAssign(interaction, client, deferred = false) {
  const response = errorEmbed({
    title: "Command Temporarily Disabled",
    description:
      "The temp-roles command is temporarily disabled while we update the credit system. Please try again later.",
  });

  if (deferred) {
    return interaction.editReply(response);
  } else {
    return interaction.reply(response);
  }
}

export async function handleRemove(interaction, client, deferred = false) {
  const response = errorEmbed({
    title: "Command Temporarily Disabled",
    description:
      "The temp-roles command is temporarily disabled while we update the credit system. Please try again later.",
  });

  if (deferred) {
    return interaction.editReply(response);
  } else {
    return interaction.reply(response);
  }
}

export async function handleList(interaction, client, deferred = false) {
  const response = errorEmbed({
    title: "Command Temporarily Disabled",
    description:
      "The temp-roles command is temporarily disabled while we update the credit system. Please try again later.",
  });

  if (deferred) {
    return interaction.editReply(response);
  } else {
    return interaction.reply(response);
  }
}
