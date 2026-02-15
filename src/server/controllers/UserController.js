import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
  logRequest,
} from "../utils/responseHelpers.js";
import { getDiscordClient } from "../utils/apiShared.js";

const logger = getLogger();

/**
 * List all users with pagination
 */
export async function apiListUsers(req, res) {
  logRequest(logger, "List users", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const role = req.query.role;
    const search = req.query.search;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { discordId: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { globalName: { $regex: search, $options: "i" } },
      ];
    }

    const users = await storage.dbManager.users.listUsers(filter, limit, skip);
    const total = await storage.dbManager.users.count(filter);

    // Enrich with Core Credits
    const userIds = users.map(u => u.discordId);
    let creditsMap = {};

    if (userIds.length > 0 && storage.dbManager.coreCredits) {
      try {
        const credits = await storage.dbManager.coreCredits.collection
          .find({ userId: { $in: userIds } })
          .toArray();

        credits.forEach(c => {
          creditsMap[c.userId] = c.credits;
        });
      } catch (err) {
        logger.warn("Failed to fetch credits for user list", err);
      }
    }

    return res.json(
      createSuccessResponse({
        users: users.map(u => ({
          id: u.discordId,
          username: u.username,
          globalName: u.globalName,
          avatar: u.avatar,
          role: u.role || "user",
          credits: creditsMap[u.discordId] || 0,
          lastLogin: u.lastLogin,
          createdAt: u.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        message: "Users retrieved successfully",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to list users", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * Get detailed user info
 */
export async function apiUserInfo(req, res) {
  logRequest(logger, "User info", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const { userId } = req.params;
    const user = await storage.dbManager.users.findByDiscordId(userId);

    if (!user) {
      const { statusCode, response } = createErrorResponse(
        "User not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    return res.json(
      createSuccessResponse({
        id: user.discordId,
        username: user.username,
        globalName: user.globalName,
        avatar: user.avatar,
        email: user.email,
        role: user.role || "user",
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        message: "User info retrieved",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to get user info", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * Update user role
 */
export async function apiSetUserRole(req, res) {
  logRequest(logger, "Set user role", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      const { statusCode, response } = createErrorResponse(
        "Role is required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    const success = await storage.dbManager.users.setRole(userId, role);

    if (!success) {
      const { statusCode, response } = createErrorResponse(
        "Failed to update role or user not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    logger.info(`✅ User role updated: ${userId} -> ${role}`);
    return res.json(
      createSuccessResponse({
        userId,
        role,
        message: "Role updated successfully",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to set user role", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * Sync user data from Discord OAuth (called by website)
 */
export async function apiSyncUser(req, res) {
  logRequest(logger, "Sync user", req);

  try {
    const { getStorageManager } = await import(
      "../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();

    const {
      id,
      username,
      discriminator,
      globalName,
      avatar,
      email,
      accessToken,
      refreshToken,
    } = req.body;

    if (!id) {
      const { statusCode, response } = createErrorResponse(
        "Discord ID is required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    const user = await storage.dbManager.users.upsertFromDiscordOAuth({
      discordId: id,
      username,
      discriminator,
      globalName,
      avatar,
      email,
      accessToken,
      refreshToken,
    });

    return res.json(
      createSuccessResponse({
        id: user.discordId,
        role: user.role || "user",
        message: "User synced successfully",
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to sync user", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
    );
    return res.status(statusCode).json(response);
  }
}

/**
 * Manage user core credits (Admin only)
 * Can add, remove, or set cores for a user.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function apiManageUserCores(req, res) {
  const { userId } = req.params;
  const { action, amount, reason } = req.body;

  logRequest(logger, `Manage cores for ${userId}: ${action} ${amount}`, req);

  if (!userId || !action || amount === undefined) {
    const { statusCode, response } = createErrorResponse(
      "Missing required fields: userId, action, amount",
      400,
    );
    return res.status(statusCode).json(response);
  }

  if (amount < 0) {
    const { statusCode, response } = createErrorResponse(
      "Amount must be non-negative",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { getDatabaseManager } = await import(
      "../../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();

    // Get current balance
    const credits = await dbManager.coreCredits.getByUserId(userId);
    let currentBalance = credits?.credits || 0;
    let newBalance = currentBalance;

    switch (action) {
      case "add":
        newBalance += amount;
        break;
      case "remove":
        newBalance = Math.max(0, newBalance - amount);
        break;
      case "set":
        newBalance = amount;
        break;
      default:
        const { statusCode, response } = createErrorResponse(
          "Invalid action. Use 'add', 'remove', or 'set'.",
          400,
        );
        return res.status(statusCode).json(response);
    }

    // Set new balance
    await dbManager.coreCredits.updateCredits(
      userId,
      newBalance - currentBalance,
    );

    // Log transaction
    const change = newBalance - currentBalance;
    if (change !== 0 && dbManager.payments) {
      await dbManager.payments.create({
        paymentId: `admin_adjust_${userId}_${Date.now()}`,
        discordId: userId,
        provider: "admin_adjustment",
        type: "adjustment",
        status: "completed",
        amount: 0,
        currency: "USD",
        coresGranted: change,
        tier: "admin_action",
        metadata: {
          reason: reason || "Admin manual adjustment",
          action,
          originalAmount: amount,
          previousBalance: currentBalance,
          newBalance: newBalance,
          adminUser: req.session?.discordUser?.id || "unknown_admin",
        },
      });

      logger.info(
        `🔧 Admin adjusted cores for ${userId}: ${currentBalance} -> ${newBalance} (${reason || "No reason"})`,
      );

      // Send DM Notification
      try {
        const client = getDiscordClient();
        if (client) {
          const user = await client.users.fetch(userId);
          if (user) {
            const embed = {
              title: "Core Balance Updated",
              color: change > 0 ? 0x00ff00 : 0xff0000,
              description: `An administrator has updated your Core balance.`,
              fields: [
                {
                  name: "Type",
                  value: change > 0 ? "Bonus Received" : "Debited",
                  inline: true,
                },
                {
                  name: "Amount",
                  value: `${change > 0 ? "+" : ""}${change} Cores`,
                  inline: true,
                },
                {
                  name: "New Balance",
                  value: `${newBalance} Cores`,
                  inline: true,
                },
              ],
              timestamp: new Date().toISOString(),
              footer: {
                text: "Role Reactor System",
              },
            };

            if (reason) {
              embed.fields.push({
                name: "Reason",
                value: reason,
                inline: false,
              });
            }

            await user.send({ embeds: [embed] });
          }
        }
      } catch (dmError) {
        logger.warn(
          `Failed to send DM to ${userId} regarding core update: ${dmError.message}`,
        );
      }
    }

    return res.json(
      createSuccessResponse({
        userId,
        previousBalance: currentBalance,
        newBalance,
        change,
        message: `Successfully ${action}ed ${amount} cores.`,
      }),
    );
  } catch (error) {
    logger.error("❌ Failed to manage user cores", error);
    const { statusCode, response } = createErrorResponse(
      "Internal Server Error",
      500,
      error.message,
    );
    return res.status(statusCode).json(response);
  }
}
