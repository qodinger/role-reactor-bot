import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";

export const name = Events.MessagePollVoteAdd;

export async function execute(pollVote, _client) {
  const logger = getLogger();

  try {
    // Log poll vote
    logger.info(
      `✅ Poll vote added: ${pollVote.user.tag} voted on poll in ${pollVote.guild?.name || "DM"}`,
      {
        userId: pollVote.user.id,
        guildId: pollVote.guild?.id,
        channelId: pollVote.channel?.id,
        messageId: pollVote.message?.id,
        answerIds: pollVote.answerIds,
      },
    );

    // You can add additional analytics or tracking here if needed
    // For example, storing vote data in a database for analytics
  } catch (error) {
    logger.error("Error handling poll vote add", error);
  }
}
