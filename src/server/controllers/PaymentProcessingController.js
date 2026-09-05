import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";
import { plisioPay } from "../../utils/payments/plisio.js";
import { config } from "../../config/config.js";

const logger = getLogger();

/**
 * Create payment invoice endpoint - Creates a Plisio crypto payment
 */
export async function apiCreatePayment(req, res) {
  logRequest("Create payment", req);

  try {
    const sessionUser = req.session?.discordUser;
    const { discordId, email, username, packageId, amount, currency } =
      req.body;
    let userInfo = null;

    if (sessionUser) {
      userInfo = {
        id: sessionUser.id,
        email: sessionUser.email,
        username: sessionUser.username,
      };
    } else if (discordId) {
      userInfo = {
        id: discordId,
        email: email || null,
        username: username || null,
      };
    }

    if (!userInfo) {
      const { statusCode, response } = createErrorResponse(
        "Authentication required",
        401,
        "Please login with Discord first",
      );
      return res.status(statusCode).json(response);
    }

    const MAX_PAYMENT_AMOUNT = 10000;

    if (!amount || typeof amount !== "number" || amount < 1) {
      const { statusCode, response } = createErrorResponse(
        "Invalid amount",
        400,
        "Amount must be a positive number (minimum $1)",
      );
      return res.status(statusCode).json(response);
    }

    if (amount > MAX_PAYMENT_AMOUNT) {
      const { statusCode, response } = createErrorResponse(
        "Amount too high",
        400,
        `Amount cannot exceed $${MAX_PAYMENT_AMOUNT}`,
      );
      return res.status(statusCode).json(response);
    }

    const minimumAmount = config.corePricing?.coreSystem?.minimumPayment || 1;

    if (amount < minimumAmount) {
      const { statusCode, response } = createErrorResponse(
        "Amount too low",
        400,
        `Minimum payment amount is $${minimumAmount}`,
      );
      return res.status(statusCode).json(response);
    }

    const orderNumber = `${userInfo.id}_${Date.now()}`;
    const fiatCurrency = "USD";
    const selectedCrypto = currency;
    const callbackUrl = `${config.botInfo.apiUrl}/webhook/crypto?json=true`;

    let orderName = "Core Credits";
    if (packageId && config.corePricing?.packages?.[packageId]) {
      orderName = config.corePricing.packages[packageId].name || "Core Credits";
    }

    const invoiceUrl = await plisioPay.createInvoice({
      amount,
      currency: fiatCurrency,
      cryptoCurrency: selectedCrypto,
      orderNumber,
      orderName,
      email: userInfo.email || null,
      callbackUrl,
    });

    logger.info(
      `CREATE_PAYMENT: User ${userInfo.id} (${userInfo.username || "unknown"}) created $${amount} payment via ${sessionUser ? "session" : "website"}`,
    );

    res.json(
      createSuccessResponse({
        invoiceUrl,
        orderId: orderNumber,
        amount,
        currency,
        packageId: packageId || null,
        user: {
          discordId: userInfo.id,
          username: userInfo.username,
          emailPrefilled: !!userInfo.email,
        },
        message:
          "Payment invoice created successfully. Redirect user to invoiceUrl.",
      }),
    );
  } catch (error) {
    logger.error("❌ Error creating payment:", error);
    const errorMessage = error.message?.includes("PLISIO_SECRET_KEY")
      ? "Payment system is not configured"
      : "Failed to create payment invoice";
    const { statusCode, response } = createErrorResponse(
      errorMessage,
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

const STABLECOIN_CONFIGS = {
  1: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, symbol: "USDC" }, // Mainnet
  137: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, symbol: "USDC" }, // Polygon
  8453: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, symbol: "USDC" }, // Base
  42161: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, symbol: "USDC" }, // Arbitrum
  10: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6, symbol: "USDC" }, // Optimism
  56: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, symbol: "USDT" }, // BSC
  11155111: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6, symbol: "USDC" }, // Sepolia
};

const getRpcUrl = (chainId) => {
  switch(Number(chainId)) {
    case 1: return "https://eth.llamarpc.com";
    case 137: return "https://polygon.llamarpc.com";
    case 8453: return "https://base.llamarpc.com";
    case 42161: return "https://arbitrum.llamarpc.com";
    case 10: return "https://optimism.llamarpc.com";
    case 56: return "https://binance.llamarpc.com";
    case 11155111: return "https://ethereum-sepolia-rpc.publicnode.com";
    default: return null;
  }
};

/**
 * Verify Direct Web3 Stablecoin Payment
 */
export async function apiVerifyWeb3Payment(req, res) {
  logRequest("Verify Web3 payment", req);

  try {
    const { txHash, packageId, chainId, discordId, email, username } = req.body;

    if (!txHash || !packageId || !chainId || !discordId) {
      const { statusCode, response } = createErrorResponse("Missing required fields", 400);
      return res.status(statusCode).json(response);
    }

    const packageConfig = config.corePricing?.packages?.[packageId];
    if (!packageConfig || !packageConfig.price) {
      const { statusCode, response } = createErrorResponse("Invalid package", 400);
      return res.status(statusCode).json(response);
    }

    const stablecoin = STABLECOIN_CONFIGS[Number(chainId)];
    const rpcUrl = getRpcUrl(chainId);

    if (!stablecoin || !rpcUrl) {
      const { statusCode, response } = createErrorResponse("Unsupported network", 400);
      return res.status(statusCode).json(response);
    }

    // Block testnet (Sepolia) in production unless explicitly allowed via ALLOW_TESTNET=true
    if (Number(chainId) === 11155111 && process.env.NODE_ENV === "production" && process.env.ALLOW_TESTNET !== "true") {
      logger.warn(`⚠️ Blocked Sepolia testnet payment attempt in production for Discord ID: ${discordId}`);
      const { statusCode, response } = createErrorResponse("Testnet payments are disabled in production", 400);
      return res.status(statusCode).json(response);
    }

    const expectedUsdAmount = packageConfig.price;
    const expectedTokenAmount = expectedUsdAmount * Math.pow(10, stablecoin.decimals);
    const receiverAddress = config.web3ReceiverAddress.toLowerCase();

    // Check if txHash was already processed in DB
    const dbModule = await import("../../utils/storage/databaseManager.js").catch(() => null);
    const storageManager = await dbModule?.getStorageManager?.();
    if (storageManager?.payments) {
       const existing = await storageManager.payments.findByPaymentId(txHash);
       if (existing) {
         const { statusCode, response } = createErrorResponse("Transaction already processed", 400);
         return res.status(statusCode).json(response);
       }
    }

    // Initialize viem
    const { createPublicClient, http, decodeEventLog, parseAbiItem } = await import("viem");
    
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      timeout: 30000 // Wait up to 30 seconds to account for RPC sync delays
    }).catch((err) => {
      logger.warn(`Transaction receipt not found or timed out: ${err.message}`);
      return null;
    });

    if (!receipt) {
      const { statusCode, response } = createErrorResponse("Transaction not found", 404);
      return res.status(statusCode).json(response);
    }

    if (receipt.status !== "success") {
      const { statusCode, response } = createErrorResponse("Transaction failed on chain", 400);
      return res.status(statusCode).json(response);
    }

    let isValidTransfer = false;
    const transferAbiItem = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === stablecoin.address.toLowerCase()) {
        try {
          /** @type {any} */
          const decoded = decodeEventLog({
            abi: [transferAbiItem],
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === 'Transfer') {
            const to = decoded.args.to.toLowerCase();
            const value = Number(decoded.args.value);
            
            if (to === receiverAddress && value >= expectedTokenAmount) {
              isValidTransfer = true;
              break;
            }
          }
        } catch (e) {
          // Ignore logs that don't match our ABI
        }
      }
    }

    if (!isValidTransfer) {
      const { statusCode, response } = createErrorResponse("Invalid transaction amount or receiver", 400);
      return res.status(statusCode).json(response);
    }

    // Process payment and grant Cores
    const { processCryptoPayment } = await import("../../webhooks/crypto.js");
    const result = await processCryptoPayment(
      discordId,
      txHash,
      expectedUsdAmount.toString(),
      expectedUsdAmount.toString(),
      stablecoin.symbol,
      "USD",
      email,
      { discordId, username }
    );

    return res.json(createSuccessResponse(result));

  } catch (error) {
    logger.error("❌ Error verifying Web3 payment:", error);
    const { statusCode, response } = createErrorResponse("Internal server error verifying transaction", 500, error.message);
    return res.status(statusCode).json(response);
  }
}
