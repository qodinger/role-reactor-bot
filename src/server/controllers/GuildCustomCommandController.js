import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { getDiscordClient, logRequest } from "../utils/apiShared.js";
import { Routes } from "discord.js";
import { randomUUID } from "node:crypto";

const logger = getLogger();

const NAME_REGEX = /^[a-z0-9-]{1,32}$/;
const ALIAS_REGEX = /^[a-z0-9-]{1,32}$/;
const MAX_CUSTOM_COMMANDS = 50;
const MAX_ALIASES = 5;
const MAX_COOLDOWN_SECONDS = 3600;
const MIN_COOLDOWN_SECONDS = 5;

async function getCustomCommandRepo() {
  const { getDatabaseManager } = await import(
    "../../utils/storage/databaseManager.js"
  );
  const dbManager = await getDatabaseManager();
  if (!dbManager?.customCommands) {
    throw new Error("Custom commands repository not available");
  }
  return dbManager.customCommands;
}

async function checkPremium(guildId) {
  const { getPremiumManager } = await import(
    "../../features/premium/PremiumManager.js"
  );
  return getPremiumManager().isFeatureActive(guildId, "pro_engine");
}

/**
 * GET /:guildId/custom-commands
 * List custom commands for a guild (paginated)
 */
export async function apiGetCustomCommands(req, res) {
  const { guildId } = req.params;
  logRequest(`Get custom commands: ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const isPremium = await checkPremium(guildId);
    if (!isPremium) {
      const { statusCode, response } = createErrorResponse(
        "Pro Engine is required to use custom commands",
        403,
      );
      return res.status(statusCode).json(response);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const repo = await getCustomCommandRepo();
    const result = await repo.getByGuildPaginated(guildId, page, limit);

    res.json(
      createSuccessResponse({
        commands: result.commands,
        pagination: result.pagination,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error getting custom commands for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve custom commands",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * POST /:guildId/custom-commands
 * Create a new custom command
 */
export async function apiCreateCustomCommand(req, res) {
  const { guildId } = req.params;
  logRequest(`Create custom command for guild ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const isPremium = await checkPremium(guildId);
    if (!isPremium) {
      const { statusCode, response } = createErrorResponse(
        "Pro Engine is required to use custom commands",
        403,
      );
      return res.status(statusCode).json(response);
    }

    const {
      name,
      description,
      type,
      response: textResponse,
      responses,
      randomResponse,
      embed,
      role,
      createdBy,
      ephemeral,
      allowedChannels,
      requiredRoles,
      cooldown,
      aliases,
      dmUser,
      dmTarget,
      actions,
      options,
      components,
    } = req.body;

    // Validate required fields
    if (!name || !description || !type || !createdBy) {
      const { statusCode, response } = createErrorResponse(
        "name, description, type, and createdBy are required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (!NAME_REGEX.test(name)) {
      const { statusCode, response } = createErrorResponse(
        "Command name must be 1-32 lowercase letters, numbers, or hyphens",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (!["text", "embed", "role", "dm"].includes(type)) {
      const { statusCode, response } = createErrorResponse(
        "type must be 'text', 'embed', 'role', or 'dm'",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (type === "text" && !textResponse?.trim()) {
      const { statusCode, response } = createErrorResponse(
        "response is required for text commands",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (
      type === "embed" &&
      (!embed?.title?.trim() || !embed?.description?.trim())
    ) {
      const { statusCode, response } = createErrorResponse(
        "embed.title and embed.description are required for embed commands",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (type === "role") {
      if (!role?.roleId || !role?.action) {
        const { statusCode, response } = createErrorResponse(
          "role.roleId and role.action are required for role commands",
          400,
        );
        return res.status(statusCode).json(response);
      }
      if (!["add", "remove", "toggle"].includes(role.action)) {
        const { statusCode, response } = createErrorResponse(
          "role.action must be 'add', 'remove', or 'toggle'",
          400,
        );
        return res.status(statusCode).json(response);
      }
    }

    if (
      type === "dm" &&
      !textResponse?.trim() &&
      (!responses || responses.length === 0)
    ) {
      const { statusCode, response } = createErrorResponse(
        "response or responses is required for dm commands",
        400,
      );
      return res.status(statusCode).json(response);
    }

    // Validate responses array
    if (responses && Array.isArray(responses)) {
      if (responses.length === 0) {
        const { statusCode, response } = createErrorResponse(
          "responses array cannot be empty",
          400,
        );
        return res.status(statusCode).json(response);
      }
      if (responses.length > 10) {
        const { statusCode, response } = createErrorResponse(
          "Maximum 10 responses allowed for random responses",
          400,
        );
        return res.status(statusCode).json(response);
      }
      for (const resp of responses) {
        if (typeof resp !== "string" || !resp.trim()) {
          const { statusCode, response } = createErrorResponse(
            "All responses must be non-empty strings",
            400,
          );
          return res.status(statusCode).json(response);
        }
      }
    }

    // Validate options
    if (options && Array.isArray(options)) {
      if (options.length > 25) {
        const { statusCode, response } = createErrorResponse(
          "Maximum 25 command options allowed",
          400,
        );
        return res.status(statusCode).json(response);
      }
      for (const opt of options) {
        if (!opt.name || !opt.description || !opt.type) {
          const { statusCode, response } = createErrorResponse(
            "Each option must have name, description, and type",
            400,
          );
          return res.status(statusCode).json(response);
        }
        if (
          ![
            "string",
            "integer",
            "number",
            "boolean",
            "user",
            "channel",
            "role",
            "mentionable",
            "attachment",
          ].includes(opt.type)
        ) {
          const { statusCode, response } = createErrorResponse(
            "Invalid option type",
            400,
          );
          return res.status(statusCode).json(response);
        }
      }
    }

    // Validate components
    if (components) {
      if (components.buttons && components.buttons.length > 5) {
        const { statusCode, response } = createErrorResponse(
          "Maximum 5 buttons allowed",
          400,
        );
        return res.status(statusCode).json(response);
      }
      if (
        components.selectMenu &&
        components.selectMenu.options &&
        components.selectMenu.options.length > 25
      ) {
        const { statusCode, response } = createErrorResponse(
          "Maximum 25 select menu options allowed",
          400,
        );
        return res.status(statusCode).json(response);
      }
    }

    // Validate aliases
    if (aliases && Array.isArray(aliases)) {
      if (aliases.length > MAX_ALIASES) {
        const { statusCode, response } = createErrorResponse(
          `Maximum ${MAX_ALIASES} aliases allowed`,
          400,
        );
        return res.status(statusCode).json(response);
      }
      for (const alias of aliases) {
        if (!ALIAS_REGEX.test(alias)) {
          const { statusCode, response } = createErrorResponse(
            "Each alias must be 1-32 lowercase letters, numbers, or hyphens",
            400,
          );
          return res.status(statusCode).json(response);
        }
        if (alias === name) {
          const { statusCode, response } = createErrorResponse(
            "Alias cannot be the same as the command name",
            400,
          );
          return res.status(statusCode).json(response);
        }
      }
    }

    // Validate cooldown
    if (cooldown !== undefined && cooldown !== null) {
      if (
        typeof cooldown !== "number" ||
        cooldown < MIN_COOLDOWN_SECONDS ||
        cooldown > MAX_COOLDOWN_SECONDS
      ) {
        const { statusCode, response } = createErrorResponse(
          `Cooldown must be between ${MIN_COOLDOWN_SECONDS} and ${MAX_COOLDOWN_SECONDS} seconds`,
          400,
        );
        return res.status(statusCode).json(response);
      }
    }

    // Validate allowed channels
    if (allowedChannels && !Array.isArray(allowedChannels)) {
      const { statusCode, response } = createErrorResponse(
        "allowedChannels must be an array of channel IDs",
        400,
      );
      return res.status(statusCode).json(response);
    }

    // Validate required roles
    if (requiredRoles && !Array.isArray(requiredRoles)) {
      const { statusCode, response } = createErrorResponse(
        "requiredRoles must be an array of role IDs",
        400,
      );
      return res.status(statusCode).json(response);
    }

    const repo = await getCustomCommandRepo();

    // Check for duplicate name within this guild
    const existing = await repo.getByName(guildId, name);
    if (existing) {
      const { statusCode, response } = createErrorResponse(
        `A custom command named '/${name}' already exists in this server`,
        409,
      );
      return res.status(statusCode).json(response);
    }

    // Check for duplicate aliases
    if (aliases && aliases.length > 0) {
      for (const alias of aliases) {
        const aliasConflict = await repo.getByName(guildId, alias);
        if (aliasConflict) {
          const { statusCode, response } = createErrorResponse(
            `A command named '/${alias}' already exists (conflicts with alias)`,
            409,
          );
          return res.status(statusCode).json(response);
        }
      }
    }

    // Check command limit
    const count = await repo.countByGuild(guildId);
    if (count >= MAX_CUSTOM_COMMANDS) {
      const { statusCode, response } = createErrorResponse(
        `Server has reached the maximum of ${MAX_CUSTOM_COMMANDS} custom commands`,
        400,
      );
      return res.status(statusCode).json(response);
    }

    // Register Discord guild application command
    const client = getDiscordClient();
    if (!client) {
      const { statusCode, response } = createErrorResponse(
        "Bot is not connected",
        503,
      );
      return res.status(statusCode).json(response);
    }

    // Build Discord command options from custom options
    let discordOptions = [];
    if (options && Array.isArray(options) && options.length > 0) {
      const optionTypeMap = {
        string: 3,
        integer: 4,
        number: 10,
        boolean: 5,
        user: 6,
        channel: 7,
        role: 8,
        mentionable: 9,
        attachment: 11,
      };
      discordOptions = options.map(opt => ({
        name: opt.name.slice(0, 32),
        description: opt.description.slice(0, 100),
        type: optionTypeMap[opt.type] || 3,
        required: opt.required || false,
        autocomplete: opt.autocomplete || false,
        ...(opt.choices && opt.choices.length > 0
          ? {
              choices: opt.choices.slice(0, 25).map(c => ({
                name: c.name.slice(0, 100),
                value: String(c.value).slice(0, 100),
              })),
            }
          : {}),
        ...(opt.channelTypes
          ? { channel_types: opt.channelTypes.slice(0, 10) }
          : {}),
        ...(opt.minValue !== undefined ? { min_value: opt.minValue } : {}),
        ...(opt.maxValue !== undefined ? { max_value: opt.maxValue } : {}),
        ...(opt.minLength !== undefined ? { min_length: opt.minLength } : {}),
        ...(opt.maxLength !== undefined ? { max_length: opt.maxLength } : {}),
      }));
    }

    let discordCommandId;
    try {
      const registeredCommand = await client.rest.post(
        Routes.applicationGuildCommands(client.application.id, guildId),
        {
          body: {
            name,
            description: description.slice(0, 100),
            type: 1,
            ...(discordOptions.length > 0 ? { options: discordOptions } : {}),
          },
        },
      );
      discordCommandId = /** @type {any} */ (registeredCommand).id;
    } catch (discordError) {
      logger.error(
        `❌ Failed to register Discord command '${name}' for guild ${guildId}:`,
        discordError,
      );
      const { statusCode, response } = createErrorResponse(
        "Failed to register command with Discord",
        500,
        discordError.message,
      );
      return res.status(statusCode).json(response);
    }

    const commandId = randomUUID();
    const now = new Date();
    const commandData = {
      guildId,
      commandId,
      discordCommandId,
      name,
      description: description.slice(0, 100),
      type,
      response:
        type === "text" || type === "dm"
          ? randomResponse
            ? null
            : textResponse?.trim()
          : type === "role"
            ? textResponse?.trim() || null
            : null,
      responses:
        type === "text" || type === "dm"
          ? Array.isArray(responses) && responses.length > 0
            ? responses.map(r => r.trim())
            : null
          : null,
      randomResponse: Boolean(randomResponse),
      embed:
        type === "embed"
          ? {
              title: embed.title.trim(),
              description: embed.description.trim(),
              color: embed.color || "#9b8bf0",
              footer: embed.footer?.trim() || null,
            }
          : null,
      role:
        type === "role"
          ? {
              roleId: role.roleId,
              roleName: role.roleName || "",
              roleColor: role.roleColor || 0,
              action: role.action,
            }
          : null,
      enabled: true,
      ephemeral: Boolean(ephemeral),
      allowedChannels: Array.isArray(allowedChannels) ? allowedChannels : null,
      requiredRoles: Array.isArray(requiredRoles) ? requiredRoles : null,
      cooldown: typeof cooldown === "number" ? cooldown : null,
      aliases: Array.isArray(aliases) ? aliases : null,
      dmUser: Boolean(dmUser),
      dmTarget: dmTarget || null,
      actions: Array.isArray(actions) ? actions : null,
      options: Array.isArray(options) ? options : null,
      components: components || null,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await repo.create(commandData);

    logger.info(`✅ Custom command '/${name}' created for guild ${guildId}`);
    res.status(201).json(
      createSuccessResponse({
        message: `Custom command '/${name}' created successfully`,
        command: commandData,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error creating custom command for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to create custom command",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * PATCH /:guildId/custom-commands/:commandId
 * Update an existing custom command
 */
export async function apiUpdateCustomCommand(req, res) {
  const { guildId, commandId } = req.params;
  logRequest(`Update custom command ${commandId} for guild ${guildId}`, req);

  try {
    const isPremium = await checkPremium(guildId);
    if (!isPremium) {
      const { statusCode, response } = createErrorResponse(
        "Pro Engine is required to use custom commands",
        403,
      );
      return res.status(statusCode).json(response);
    }

    const repo = await getCustomCommandRepo();
    const existing = await repo.getById(guildId, commandId);
    if (!existing) {
      const { statusCode, response } = createErrorResponse(
        "Custom command not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    const {
      name,
      description,
      type,
      response: textResponse,
      responses,
      randomResponse,
      embed,
      role,
      enabled,
      ephemeral,
      allowedChannels,
      requiredRoles,
      cooldown,
      aliases,
      dmUser,
      dmTarget,
      actions,
      options,
      components,
    } = req.body;

    // Validate name if changing it
    if (name && name !== existing.name) {
      if (!NAME_REGEX.test(name)) {
        const { statusCode, response } = createErrorResponse(
          "Command name must be 1-32 lowercase letters, numbers, or hyphens",
          400,
        );
        return res.status(statusCode).json(response);
      }

      const nameConflict = await repo.getByName(guildId, name);
      if (nameConflict && nameConflict.commandId !== commandId) {
        const { statusCode, response } = createErrorResponse(
          `A custom command named '/${name}' already exists in this server`,
          409,
        );
        return res.status(statusCode).json(response);
      }
    }

    const finalName = name || existing.name;
    const finalDescription = description || existing.description;
    const finalType = type || existing.type;

    // Update Discord guild command if name or description changed
    if (name !== existing.name || description !== existing.description) {
      const client = getDiscordClient();
      if (!client) {
        const { statusCode, response } = createErrorResponse(
          "Bot is not connected",
          503,
        );
        return res.status(statusCode).json(response);
      }

      try {
        await client.rest.patch(
          Routes.applicationGuildCommand(
            client.application.id,
            guildId,
            existing.discordCommandId,
          ),
          {
            body: {
              name: finalName,
              description: finalDescription.slice(0, 100),
            },
          },
        );
      } catch (discordError) {
        logger.error(
          `❌ Failed to update Discord command for guild ${guildId}:`,
          discordError,
        );
        const { statusCode, response } = createErrorResponse(
          "Failed to update command with Discord",
          500,
          discordError.message,
        );
        return res.status(statusCode).json(response);
      }
    }

    const updateData = {
      name: finalName,
      description: finalDescription.slice(0, 100),
      type: finalType,
      response:
        finalType === "text" || finalType === "dm"
          ? randomResponse !== undefined && randomResponse
            ? null
            : (textResponse?.trim() ?? existing.response)
          : finalType === "role"
            ? (textResponse?.trim() ?? existing.response ?? null)
            : null,
      responses:
        finalType === "text" || finalType === "dm"
          ? responses !== undefined
            ? Array.isArray(responses) && responses.length > 0
              ? responses.map(r => r.trim())
              : null
            : existing.responses
          : null,
      randomResponse:
        randomResponse !== undefined
          ? Boolean(randomResponse)
          : existing.randomResponse,
      embed:
        finalType === "embed"
          ? {
              title: embed?.title?.trim() ?? existing.embed?.title,
              description:
                embed?.description?.trim() ?? existing.embed?.description,
              color: embed?.color ?? existing.embed?.color ?? "#9b8bf0",
              footer: embed?.footer?.trim() ?? existing.embed?.footer ?? null,
            }
          : null,
      role:
        finalType === "role"
          ? {
              roleId: role?.roleId ?? existing.role?.roleId,
              roleName: role?.roleName ?? existing.role?.roleName ?? "",
              roleColor: role?.roleColor ?? existing.role?.roleColor ?? 0,
              action: role?.action ?? existing.role?.action ?? "add",
            }
          : null,
      ...(enabled !== undefined && { enabled }),
      ...(ephemeral !== undefined && { ephemeral: Boolean(ephemeral) }),
      ...(allowedChannels !== undefined && {
        allowedChannels: Array.isArray(allowedChannels)
          ? allowedChannels
          : null,
      }),
      ...(requiredRoles !== undefined && {
        requiredRoles: Array.isArray(requiredRoles) ? requiredRoles : null,
      }),
      ...(cooldown !== undefined && {
        cooldown: typeof cooldown === "number" ? cooldown : null,
      }),
      ...(aliases !== undefined && {
        aliases: Array.isArray(aliases) ? aliases : null,
      }),
      ...(dmUser !== undefined && { dmUser: Boolean(dmUser) }),
      ...(dmTarget !== undefined && { dmTarget: dmTarget || null }),
      ...(actions !== undefined && {
        actions: Array.isArray(actions) ? actions : null,
      }),
      ...(options !== undefined && {
        options: Array.isArray(options) ? options : null,
      }),
      ...(components !== undefined && {
        components: components || null,
      }),
    };

    await repo.update(guildId, commandId, updateData);

    logger.info(
      `✅ Custom command '/${finalName}' updated for guild ${guildId}`,
    );
    res.json(
      createSuccessResponse({
        message: `Custom command '/${finalName}' updated successfully`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error updating custom command ${commandId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to update custom command",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * DELETE /:guildId/custom-commands/:commandId
 * Delete a custom command
 */
export async function apiDeleteCustomCommand(req, res) {
  const { guildId, commandId } = req.params;
  logRequest(`Delete custom command ${commandId} for guild ${guildId}`, req);

  try {
    const isPremium = await checkPremium(guildId);
    if (!isPremium) {
      const { statusCode, response } = createErrorResponse(
        "Pro Engine is required to use custom commands",
        403,
      );
      return res.status(statusCode).json(response);
    }

    const repo = await getCustomCommandRepo();
    const existing = await repo.getById(guildId, commandId);
    if (!existing) {
      const { statusCode, response } = createErrorResponse(
        "Custom command not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    // Deregister from Discord
    const client = getDiscordClient();
    if (client && existing.discordCommandId) {
      try {
        await client.rest.delete(
          Routes.applicationGuildCommand(
            client.application.id,
            guildId,
            existing.discordCommandId,
          ),
        );
      } catch (discordError) {
        // Log but continue — command may already be removed from Discord
        logger.warn(
          `⚠️ Failed to deregister Discord command for guild ${guildId}:`,
          discordError.message,
        );
      }
    }

    await repo.delete(guildId, commandId);

    logger.info(
      `✅ Custom command '/${existing.name}' deleted for guild ${guildId}`,
    );
    res.json(
      createSuccessResponse({
        message: `Custom command '/${existing.name}' deleted successfully`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error deleting custom command ${commandId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to delete custom command",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * POST /:guildId/custom-commands/sync
 * Re-sync all custom commands with Discord (re-register all commands)
 */
export async function apiSyncCustomCommands(req, res) {
  const { guildId } = req.params;
  logRequest(`Sync custom commands for guild ${guildId}`, req);

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const isPremium = await checkPremium(guildId);
    if (!isPremium) {
      const { statusCode, response } = createErrorResponse(
        "Pro Engine is required to use custom commands",
        403,
      );
      return res.status(statusCode).json(response);
    }

    const client = getDiscordClient();
    if (!client) {
      const { statusCode, response } = createErrorResponse(
        "Bot is not connected",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const repo = await getCustomCommandRepo();
    const commands = await repo.getByGuild(guildId);

    if (commands.length === 0) {
      return res.json(
        createSuccessResponse({
          message: "No custom commands to sync",
          synced: 0,
        }),
      );
    }

    const results = { synced: 0, failed: 0, errors: [] };

    const buildDiscordOptions = options => {
      if (!options || !Array.isArray(options) || options.length === 0)
        return [];
      const optionTypeMap = {
        string: 3,
        integer: 4,
        number: 10,
        boolean: 5,
        user: 6,
        channel: 7,
        role: 8,
        mentionable: 9,
        attachment: 11,
      };
      return options.map(opt => ({
        name: String(opt.name).slice(0, 32),
        description: String(opt.description).slice(0, 100),
        type: optionTypeMap[opt.type] || 3,
        required: opt.required || false,
        autocomplete: opt.autocomplete || false,
        ...(opt.choices && opt.choices.length > 0
          ? {
              choices: opt.choices.slice(0, 25).map(c => ({
                name: String(c.name).slice(0, 100),
                value: String(c.value).slice(0, 100),
              })),
            }
          : {}),
      }));
    };

    for (const command of commands) {
      if (!command.enabled) continue;

      try {
        const discordOptions = buildDiscordOptions(command.options);

        if (command.discordCommandId) {
          await client.rest.patch(
            Routes.applicationGuildCommand(
              client.application.id,
              guildId,
              command.discordCommandId,
            ),
            {
              body: {
                name: command.name,
                description: command.description.slice(0, 100),
                ...(discordOptions.length > 0
                  ? { options: discordOptions }
                  : {}),
              },
            },
          );
        } else {
          const registered = await client.rest.post(
            Routes.applicationGuildCommands(client.application.id, guildId),
            {
              body: {
                name: command.name,
                description: command.description.slice(0, 100),
                type: 1,
                ...(discordOptions.length > 0
                  ? { options: discordOptions }
                  : {}),
              },
            },
          );
          await repo.update(guildId, command.commandId, {
            discordCommandId: registered.id,
          });
        }
        results.synced++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          name: command.name,
          error: error.message,
        });
        logger.error(
          `❌ Failed to sync command '/${command.name}' for guild ${guildId}:`,
          error,
        );
      }
    }

    logger.info(
      `🔄 Synced ${results.synced} custom commands for guild ${guildId} (${results.failed} failed)`,
    );

    res.json(
      createSuccessResponse({
        message: `Synced ${results.synced} commands${results.failed > 0 ? `, ${results.failed} failed` : ""}`,
        ...results,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error syncing custom commands for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to sync custom commands",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * POST /:guildId/custom-commands/:commandId/duplicate
 * Duplicate a custom command to another guild
 */
export async function apiDuplicateCustomCommand(req, res) {
  const { guildId, commandId } = req.params;
  const { targetGuildId, createdBy } = req.body;
  logRequest(
    `Duplicate custom command ${commandId} from ${guildId} to ${targetGuildId}`,
    req,
  );

  if (!guildId || !commandId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID and Command ID are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  if (!targetGuildId) {
    const { statusCode, response } = createErrorResponse(
      "Target guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  if (guildId === targetGuildId) {
    const { statusCode, response } = createErrorResponse(
      "Cannot duplicate command to the same server",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const isPremium = await checkPremium(guildId);
    if (!isPremium) {
      const { statusCode, response } = createErrorResponse(
        "Pro Engine is required to use custom commands",
        403,
      );
      return res.status(statusCode).json(response);
    }

    const targetPremium = await checkPremium(targetGuildId);
    if (!targetPremium) {
      const { statusCode, response } = createErrorResponse(
        "Target server does not have Pro Engine active",
        403,
      );
      return res.status(statusCode).json(response);
    }

    const repo = await getCustomCommandRepo();
    const sourceCommand = await repo.getById(guildId, commandId);
    if (!sourceCommand) {
      const { statusCode, response } = createErrorResponse(
        "Custom command not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    const targetCommand = await repo.getByName(
      targetGuildId,
      sourceCommand.name,
    );
    if (targetCommand) {
      const { statusCode, response } = createErrorResponse(
        `A command named '/${sourceCommand.name}' already exists in the target server`,
        409,
      );
      return res.status(statusCode).json(response);
    }

    const client = getDiscordClient();
    if (!client) {
      const { statusCode, response } = createErrorResponse(
        "Bot is not connected",
        503,
      );
      return res.status(statusCode).json(response);
    }

    const buildDiscordOptions = options => {
      if (!options || !Array.isArray(options) || options.length === 0)
        return [];
      const optionTypeMap = {
        string: 3,
        integer: 4,
        number: 10,
        boolean: 5,
        user: 6,
        channel: 7,
        role: 8,
        mentionable: 9,
        attachment: 11,
      };
      return options.map(opt => ({
        name: String(opt.name).slice(0, 32),
        description: String(opt.description).slice(0, 100),
        type: optionTypeMap[opt.type] || 3,
        required: opt.required || false,
        autocomplete: opt.autocomplete || false,
        ...(opt.choices && opt.choices.length > 0
          ? {
              choices: opt.choices.slice(0, 25).map(c => ({
                name: String(c.name).slice(0, 100),
                value: String(c.value).slice(0, 100),
              })),
            }
          : {}),
      }));
    };

    const discordOptions = buildDiscordOptions(sourceCommand.options);

    let discordCommandId;
    try {
      const registeredCommand = await client.rest.post(
        Routes.applicationGuildCommands(client.application.id, targetGuildId),
        {
          body: {
            name: sourceCommand.name,
            description: sourceCommand.description.slice(0, 100),
            type: 1,
            ...(discordOptions.length > 0 ? { options: discordOptions } : {}),
          },
        },
      );
      discordCommandId = /** @type {any} */ (registeredCommand).id;
    } catch (discordError) {
      logger.error(
        `❌ Failed to register Discord command '${sourceCommand.name}' for target guild ${targetGuildId}:`,
        discordError,
      );
      const { statusCode, response } = createErrorResponse(
        "Failed to register command with Discord in target server",
        500,
        discordError.message,
      );
      return res.status(statusCode).json(response);
    }

    const newCommandId = randomUUID();
    const now = new Date();

    const duplicateData = {
      guildId: targetGuildId,
      commandId: newCommandId,
      discordCommandId,
      name: sourceCommand.name,
      description: sourceCommand.description,
      type: sourceCommand.type,
      response: sourceCommand.response,
      responses: sourceCommand.responses,
      randomResponse: sourceCommand.randomResponse ?? false,
      embed: sourceCommand.embed,
      role: sourceCommand.role,
      enabled: true,
      ephemeral: sourceCommand.ephemeral ?? false,
      allowedChannels: sourceCommand.allowedChannels,
      requiredRoles: sourceCommand.requiredRoles,
      cooldown: sourceCommand.cooldown,
      aliases: sourceCommand.aliases,
      dmUser: sourceCommand.dmUser ?? false,
      dmTarget: sourceCommand.dmTarget ?? null,
      actions: sourceCommand.actions,
      options: sourceCommand.options,
      components: sourceCommand.components,
      createdBy: createdBy || sourceCommand.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await repo.create(duplicateData);

    logger.info(
      `✅ Duplicated custom command '/${sourceCommand.name}' from guild ${guildId} to guild ${targetGuildId}`,
    );

    res.status(201).json(
      createSuccessResponse({
        message: `Command '/${sourceCommand.name}' duplicated successfully`,
        command: duplicateData,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error duplicating custom command ${commandId} from ${guildId} to ${targetGuildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to duplicate custom command",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
