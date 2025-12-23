import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import {
  createRPSEmbed,
  createChallengeEmbed,
  createMultiplayerResultEmbed,
  createExpiredChallengeEmbed,
  createErrorEmbed,
} from "./embeds.js";
import { getBotChoice, generateChallengeId, determineWinner } from "./utils.js";
import { createChallengeButtons } from "./components.js";

const logger = getLogger();

// Challenge expiration time: 10 minutes (reasonable time for users to respond)
const CHALLENGE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

// In-memory challenge storage (challengeId -> challenge data)
// Challenges expire after 10 minutes and are cleaned up lazily (when accessed)
const challenges = new Map();

/**
 * Clean up expired challenges (lazy cleanup - only removes from memory)
 * Called when creating new challenges or when button is clicked
 */
function cleanupExpiredChallenges() {
  const now = Date.now();

  for (const [challengeId, challenge] of challenges.entries()) {
    if (now - challenge.createdAt > CHALLENGE_EXPIRATION_MS) {
      challenges.delete(challengeId);
      logger.debug(`Cleaned up expired challenge: ${challengeId}`);
    }
  }
}

export async function execute(interaction, _client) {
  try {
    await interaction.deferReply({ ephemeral: false });

    const challengedUser = interaction.options.getUser("user");
    const challengerChoice = interaction.options.getString("choice");

    // Validate required options
    if (!challengedUser) {
      const errorMsg =
        "Missing required option: `user`. The `/rps` command requires a `user` option to specify who you want to challenge. Example: `/rps user:@username choice:rock`";
      await interaction.editReply({
        embeds: [createErrorEmbed().setDescription(`❌ ${errorMsg}`)],
      });
      throw new Error(errorMsg);
    }

    if (!challengerChoice) {
      const errorMsg =
        "Missing required option: `choice`. The `/rps` command requires a `choice` option (rock, paper, or scissors). Example: `/rps user:@username choice:rock`";
      await interaction.editReply({
        embeds: [createErrorEmbed().setDescription(`❌ ${errorMsg}`)],
      });
      throw new Error(errorMsg);
    }

    // Validation
    if (challengedUser.id === interaction.user.id) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed().setDescription("You cannot challenge yourself!"),
        ],
      });
      return;
    }

    // Handle bot challenges - immediately show result (no buttons needed)
    if (challengedUser.bot) {
      const botChoice = getBotChoice();
      const embed = createRPSEmbed(
        challengerChoice,
        botChoice,
        interaction.user,
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Challenge another user (human)
    // Get members for display names (server nicknames)
    const challengerMember =
      interaction.guild?.members.cache.get(interaction.user.id) || null;
    const challengedMember =
      interaction.guild?.members.cache.get(challengedUser.id) || null;

    const challengerName =
      challengerMember?.displayName || interaction.user.username;
    const challengedName =
      challengedMember?.displayName || challengedUser.username;

    // Clean up expired challenges (lazy cleanup)
    cleanupExpiredChallenges();

    // Create challenge
    const challengeId = generateChallengeId();

    // Create user objects with toString() method for mentions
    // Store original user objects to avoid infinite recursion
    const originalChallenger = interaction.user;
    const originalChallenged = challengedUser;

    const challengerObj = {
      ...interaction.user,
      displayName: challengerName,
      toString: () => originalChallenger.toString(),
    };
    const challengedObj = {
      ...challengedUser,
      displayName: challengedName,
      toString: () => originalChallenged.toString(),
    };

    const createdAt = Date.now();
    const embed = createChallengeEmbed(
      challengerObj,
      challengedObj,
      challengeId,
      createdAt,
    );
    const buttons = createChallengeButtons(challengeId);

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    // Store challenge with message ID for expiration handling
    challenges.set(challengeId, {
      challengerId: interaction.user.id,
      challengerName,
      challengerChoice,
      challengedId: challengedUser.id,
      challengedName,
      createdAt,
      messageId: reply.id,
      channelId: interaction.channel.id,
    });

    logger.info(
      `RPS challenge created: ${challengerName} vs ${challengedName} (${challengeId})`,
    );
  } catch (error) {
    logger.error("Error in rps command:", error);
    await interaction.editReply({ embeds: [createErrorEmbed()] });
  }
}

/**
 * Handle RPS challenge button interaction
 * @param {import('discord.js').ButtonInteraction} interaction - Button interaction
 */
export async function handleRPSButton(interaction) {
  try {
    const { customId } = interaction;
    // customId format: rps_choice-{challengeId}-{choice}
    // challengeId can contain dashes, so we need to split carefully
    const prefix = "rps_choice-";
    if (!customId.startsWith(prefix)) {
      await interaction.reply({
        embeds: [
          createErrorEmbed().setDescription("Invalid challenge button."),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Remove prefix and split from the end (choice is always last)
    const withoutPrefix = customId.substring(prefix.length);
    const lastDashIndex = withoutPrefix.lastIndexOf("-");

    if (lastDashIndex === -1) {
      await interaction.reply({
        embeds: [
          createErrorEmbed().setDescription("Invalid challenge format."),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const challengeId = withoutPrefix.substring(0, lastDashIndex);
    const challengedChoice = withoutPrefix.substring(lastDashIndex + 1);

    // Get challenge
    const challenge = challenges.get(challengeId);
    if (!challenge) {
      await interaction.reply({
        embeds: [
          createErrorEmbed().setDescription(
            "This challenge has expired or doesn't exist.",
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if challenge has expired
    const now = Date.now();
    if (now - challenge.createdAt > CHALLENGE_EXPIRATION_MS) {
      // Update the original message to show expiration
      if (challenge.messageId && challenge.channelId) {
        try {
          const channel = await interaction.guild.channels.fetch(
            challenge.channelId,
          );
          const message = await channel.messages.fetch(challenge.messageId);

          const expiredEmbed = createExpiredChallengeEmbed(challenge);
          await message.edit({
            embeds: [expiredEmbed],
            components: [], // Remove buttons
          });
        } catch (error) {
          logger.debug(
            `Could not update expired challenge message ${challengeId}:`,
            error.message,
          );
        }
      }

      // Remove expired challenge
      challenges.delete(challengeId);
      await interaction.reply({
        embeds: [
          createErrorEmbed().setDescription(
            "This challenge has expired. Please create a new challenge.",
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      logger.debug(`Expired challenge clicked: ${challengeId}`);
      return;
    }

    // Check if this is the challenged user - only they can click the buttons
    if (interaction.user.id !== challenge.challengedId) {
      await interaction.reply({
        embeds: [
          createErrorEmbed()
            .setTitle("Access Denied")
            .setDescription(
              `This challenge is for **${challenge.challengedName}** only. Only they can respond to this challenge.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      logger.debug(
        `Unauthorized RPS button click: ${interaction.user.tag} tried to respond to challenge ${challengeId} (intended for ${challenge.challengedName})`,
      );
      return;
    }

    // Both choices are now available, determine winner
    const winner = determineWinner(
      challenge.challengerChoice,
      challengedChoice,
      true,
    );

    // Try to fetch challenger user and member for display names
    let challengerUser = interaction.client.users.cache.get(
      challenge.challengerId,
    );
    let challengerDisplayName = challenge.challengerName;

    // Store original user object to avoid infinite recursion
    let originalChallengerUser = challengerUser;

    if (!challengerUser) {
      // Try to fetch user if not in cache
      try {
        challengerUser = await interaction.client.users.fetch(
          challenge.challengerId,
        );
      } catch (error) {
        logger.debug(
          `Failed to fetch challenger user ${challenge.challengerId}:`,
          error.message,
        );
        // Create a minimal user object if fetch fails
        challengerUser = {
          id: challenge.challengerId,
          username: challenge.challengerName,
          tag: challenge.challengerName,
          displayName: challenge.challengerName,
          toString: () => `<@${challenge.challengerId}>`,
        };
      }
    }

    // Get member for display name (server nickname) - try cache first, then fetch
    let challengerMember =
      interaction.guild?.members.cache.get(challenge.challengerId) || null;
    if (!challengerMember && interaction.guild && challengerUser) {
      try {
        challengerMember = await interaction.guild.members.fetch(
          challenge.challengerId,
        );
      } catch (error) {
        logger.debug(
          `Failed to fetch challenger member ${challenge.challengerId}:`,
          error.message,
        );
      }
    }
    challengerDisplayName =
      challengerMember?.displayName || challengerUser.username;

    // Store original before modifying
    originalChallengerUser = challengerUser;
    challengerUser = {
      ...challengerUser,
      displayName: challengerDisplayName,
      toString: () => originalChallengerUser.toString(),
    };

    // Get challenged user's member for display name - try cache first, then fetch
    let challengedMember =
      interaction.guild?.members.cache.get(interaction.user.id) || null;
    if (!challengedMember && interaction.guild) {
      try {
        challengedMember = await interaction.guild.members.fetch(
          interaction.user.id,
        );
      } catch (error) {
        logger.debug(
          `Failed to fetch challenged member ${interaction.user.id}:`,
          error.message,
        );
      }
    }
    const challengedDisplayName =
      challengedMember?.displayName || interaction.user.username;

    // Store original user object to avoid infinite recursion
    const originalChallengedUser = interaction.user;
    const challengedUserWithDisplay = {
      ...interaction.user,
      displayName: challengedDisplayName,
      toString: () => originalChallengedUser.toString(),
    };

    // Create result embed
    const resultEmbed = createMultiplayerResultEmbed(
      challenge.challengerChoice,
      challengedChoice,
      challengerUser,
      challengedUserWithDisplay,
    );

    // Update the original message - remove buttons after challenge is accepted
    try {
      await interaction.update({
        embeds: [resultEmbed],
        components: [], // Remove buttons
      });
    } catch (error) {
      // Fallback: defer first, then edit the message directly if update fails
      logger.debug("Failed to update interaction, trying fallback:", error);
      try {
        // Defer the interaction first (must be done within 3 seconds)
        // This acknowledges the interaction to Discord
        await interaction.deferUpdate();
      } catch (deferError) {
        // If defer fails (e.g., interaction expired), log but continue
        logger.debug(
          "Failed to defer interaction (may be expired):",
          deferError,
        );
      }
      try {
        // Then edit the message (this works even if defer failed, as long as we have the message)
        await interaction.message.edit({
          embeds: [resultEmbed],
          components: [], // Remove buttons
        });
      } catch (editError) {
        logger.error("Failed to edit message after button click:", editError);
      }
    }

    // Clean up challenge
    challenges.delete(challengeId);

    logger.info(
      `RPS challenge completed: ${challenge.challengerName} vs ${interaction.user.tag} - Winner: ${winner}`,
    );
  } catch (error) {
    logger.error("Error handling RPS button:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        embeds: [createErrorEmbed()],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed()],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
