import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { config } from "../../../config/config.js";
import { createPaymentEmbed, createErrorEmbed } from "./paymentEmbeds.js";

const logger = getLogger();

/**
 * Create Coinbase Commerce payment link
 * @param {string} userId - Discord user ID
 * @param {string} tier - Subscription tier name
 * @param {number} price - Price in USD
 * @param {string} paymentType - 'donation' or 'subscription'
 * @returns {Promise<string|null>} Payment URL or null if error
 */
async function createCryptoPaymentLink(userId, tier, price, paymentType) {
  try {
    // Check if crypto payments are enabled
    if (
      !process.env.COINBASE_ENABLED ||
      process.env.COINBASE_ENABLED !== "true"
    ) {
      logger.warn("Crypto payments not enabled");
      return null;
    }

    // For now, we'll use Coinbase Commerce API
    // You'll need to install @coinbase/commerce-sdk or use fetch
    const apiKey = process.env.COINBASE_API_KEY;
    if (!apiKey) {
      logger.error("COINBASE_API_KEY not configured");
      return null;
    }

    // Create charge using Coinbase Commerce API
    const chargeData = {
      name: tier ? `${tier} Core Membership` : "Core Credits",
      description:
        paymentType === "subscription"
          ? `Monthly subscription for ${tier}`
          : "One-time Core credits purchase",
      pricing_type: "fixed_price",
      local_price: {
        amount: price.toString(),
        currency: "USD",
      },
      metadata: {
        discord_user_id: userId,
        tier: tier || null,
        type: paymentType,
      },
    };

    // Make API request to Coinbase Commerce
    const response = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey,
        "X-CC-Version": "2018-03-22",
      },
      body: JSON.stringify(chargeData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        `Coinbase Commerce API error: ${response.status} - ${errorText}`,
      );
      return null;
    }

    const charge = await response.json();
    return charge.data?.hosted_url || null;
  } catch (error) {
    logger.error("Error creating crypto payment link:", error);
    return null;
  }
}

/**
 * Execute payment command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object
 * @param {import('discord.js').Client} _client - The Discord client (unused)
 */
export async function execute(interaction, _client) {
  try {
    // Defer the interaction immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "donation") {
      await handleDonationPayment(interaction);
    } else if (subcommand === "subscribe") {
      await handleSubscriptionPayment(interaction);
    } else {
      const errorEmbed = createErrorEmbed(
        "Unknown Subcommand",
        "Please use a valid subcommand.",
        interaction.client.user.displayAvatarURL(),
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  } catch (error) {
    logger.error("Error in payment command:", error);
    const errorResponse = errorEmbed({
      title: "Payment Error",
      description:
        "An unexpected error occurred while processing your payment request. Please try again later.",
    });
    await interaction.editReply({ embeds: [errorResponse] });
  }
}

/**
 * Handle donation payment
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object
 */
async function handleDonationPayment(interaction) {
  const amount = interaction.options.getNumber("amount");

  if (!amount || amount < 1) {
    const errorEmbed = createErrorEmbed(
      "Invalid Amount",
      "Please specify an amount of at least $1.",
      interaction.client.user.displayAvatarURL(),
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Calculate credits (10 Cores per $1)
  const cores = Math.floor(amount * config.corePricing.donation.rate);

  // Create payment link
  const paymentUrl = await createCryptoPaymentLink(
    interaction.user.id,
    null,
    amount,
    "donation",
  );

  if (!paymentUrl) {
    const errorEmbed = createErrorEmbed(
      "Payment Error",
      "Unable to create payment link. Please try again later or contact support.",
      interaction.client.user.displayAvatarURL(),
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Create payment embed
  const embed = createPaymentEmbed(
    interaction.user,
    {
      type: "donation",
      amount,
      cores,
      paymentUrl,
      currency: "USD",
    },
    interaction.client.user.displayAvatarURL(),
  );

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle subscription payment
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - The interaction object
 */
async function handleSubscriptionPayment(interaction) {
  const tier = interaction.options.getString("tier");

  if (!tier) {
    const errorEmbed = createErrorEmbed(
      "Invalid Tier",
      "Please specify a subscription tier.",
      interaction.client.user.displayAvatarURL(),
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Get tier info
  const tierInfo = config.corePricing.subscriptions[tier];
  if (!tierInfo) {
    const errorEmbed = createErrorEmbed(
      "Invalid Tier",
      `The tier "${tier}" is not available. Use /core pricing to see available tiers.`,
      interaction.client.user.displayAvatarURL(),
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Create payment link
  const paymentUrl = await createCryptoPaymentLink(
    interaction.user.id,
    tier,
    tierInfo.price,
    "subscription",
  );

  if (!paymentUrl) {
    const errorEmbed = createErrorEmbed(
      "Payment Error",
      "Unable to create payment link. Please try again later or contact support.",
      interaction.client.user.displayAvatarURL(),
    );
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // Create payment embed
  const embed = createPaymentEmbed(
    interaction.user,
    {
      type: "subscription",
      tier,
      amount: tierInfo.price,
      cores: tierInfo.cores,
      paymentUrl,
      currency: "USD",
    },
    interaction.client.user.displayAvatarURL(),
  );

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Payment command definition
 */
export const data = new SlashCommandBuilder()
  .setName("core-pay")
  .setDescription("Pay for Core credits using cryptocurrency")
  .addSubcommand(subcommand =>
    subcommand
      .setName("donation")
      .setDescription("Make a one-time donation to get Core credits")
      .addNumberOption(option =>
        option
          .setName("amount")
          .setDescription("Donation amount in USD (minimum $1)")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("subscribe")
      .setDescription("Subscribe to a Core membership tier")
      .addStringOption(option =>
        option
          .setName("tier")
          .setDescription("Subscription tier")
          .setRequired(true)
          .addChoices(
            { name: "Core Basic - $10/month", value: "Core Basic" },
            { name: "Core Premium - $25/month", value: "Core Premium" },
            { name: "Core Elite - $50/month", value: "Core Elite" },
          ),
      ),
  )
  .setDefaultMemberPermissions(0n); // Visible to all users
