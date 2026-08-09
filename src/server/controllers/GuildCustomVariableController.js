import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";
import { randomUUID } from "node:crypto";

const logger = getLogger();

const VARIABLE_NAME_REGEX = /^[a-zA-Z0-9_]{1,64}$/;
const VALID_SCOPES = ["guild", "user", "channel"];
const VALID_TYPES = ["text", "number", "collection", "object"];

async function getVariableRepo() {
  const { getDatabaseManager } = await import(
    "../../utils/storage/databaseManager.js"
  );
  const dbManager = await getDatabaseManager();
  if (!dbManager?.customVariables) {
    throw new Error("Custom variables repository not available");
  }
  return dbManager.customVariables;
}

async function checkVariableLimit(guildId) {
  const { getPremiumManager } = await import(
    "../../features/premium/PremiumManager.js"
  );
  const { PRO_TIER, FREE_TIER } = await import(
    "../../features/premium/config.js"
  );

  const isPremium = await getPremiumManager().isFeatureActive(
    guildId,
    "pro_engine",
  );

  const repo = await getVariableRepo();
  const currentCount = await repo.countByGuild(guildId);
  const maxVariables = isPremium
    ? PRO_TIER.CUSTOM_VARIABLES_MAX
    : FREE_TIER.CUSTOM_VARIABLES_MAX;

  return {
    isPremium,
    currentCount,
    maxVariables,
    canCreate: currentCount < maxVariables,
  };
}

/**
 * GET /:guildId/variables
 * List all custom variables for a guild
 */
export async function apiListVariables(req, res) {
  const { guildId } = req.params;
  logRequest(`List custom variables: ${guildId}`, req);

  try {
    const repo = await getVariableRepo();
    const variables = await repo.getByGuild(guildId);
    res.json(createSuccessResponse({ variables }));
  } catch (error) {
    logger.error(`❌ Error listing variables for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve variables",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * POST /:guildId/variables
 * Create a new custom variable
 */
export async function apiCreateVariable(req, res) {
  const { guildId } = req.params;
  logRequest(`Create custom variable for guild ${guildId}`, req);

  try {
    const limit = await checkVariableLimit(guildId);
    if (!limit.canCreate) {
      const { statusCode, response } = createErrorResponse(
        `Variable limit reached (${limit.currentCount}/${limit.maxVariables})`,
        403,
      );
      return res.status(statusCode).json(response);
    }

    const { name, scope, type, defaultValue, createdBy } = req.body;

    if (!name || !scope || !createdBy) {
      const { statusCode, response } = createErrorResponse(
        "name, scope, and createdBy are required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (!VARIABLE_NAME_REGEX.test(name)) {
      const { statusCode, response } = createErrorResponse(
        "Variable name must be 1-64 alphanumeric characters or underscores",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (!VALID_SCOPES.includes(scope)) {
      const { statusCode, response } = createErrorResponse(
        `scope must be one of: ${VALID_SCOPES.join(", ")}`,
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (type && !VALID_TYPES.includes(type)) {
      const { statusCode, response } = createErrorResponse(
        `type must be one of: ${VALID_TYPES.join(", ")}`,
        400,
      );
      return res.status(statusCode).json(response);
    }

    const repo = await getVariableRepo();

    // Check for duplicate name
    const existing = await repo.getByName(guildId, name);
    if (existing) {
      const { statusCode, response } = createErrorResponse(
        `A variable named '${name}' already exists in this server`,
        409,
      );
      return res.status(statusCode).json(response);
    }

    const now = new Date();
    const variableData = {
      guildId,
      variableId: randomUUID(),
      name,
      scope,
      type: type || "text",
      defaultValue: defaultValue ?? null,
      values: {},
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await repo.create(variableData);

    logger.info(`✅ Custom variable '${name}' created for guild ${guildId}`);
    res.status(201).json(
      createSuccessResponse({
        message: `Variable '${name}' created successfully`,
        variable: variableData,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error creating custom variable for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to create variable",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * PATCH /:guildId/variables/:variableId
 * Update a custom variable definition
 */
export async function apiUpdateVariable(req, res) {
  const { guildId, variableId } = req.params;
  logRequest(`Update custom variable ${variableId} for guild ${guildId}`, req);

  try {
    const repo = await getVariableRepo();
    const existing = await repo.getById(guildId, variableId);
    if (!existing) {
      const { statusCode, response } = createErrorResponse(
        "Variable not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    const { scope, type, defaultValue } = req.body;
    const updateData = {};

    if (scope !== undefined) {
      if (!VALID_SCOPES.includes(scope)) {
        const { statusCode, response } = createErrorResponse(
          `scope must be one of: ${VALID_SCOPES.join(", ")}`,
          400,
        );
        return res.status(statusCode).json(response);
      }
      updateData.scope = scope;
    }

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        const { statusCode, response } = createErrorResponse(
          `type must be one of: ${VALID_TYPES.join(", ")}`,
          400,
        );
        return res.status(statusCode).json(response);
      }
      updateData.type = type;
    }

    if (defaultValue !== undefined) {
      updateData.defaultValue = defaultValue;
    }

    await repo.update(guildId, variableId, updateData);

    logger.info(`✅ Custom variable '${existing.name}' updated for guild ${guildId}`);
    res.json(
      createSuccessResponse({
        message: `Variable '${existing.name}' updated successfully`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error updating custom variable ${variableId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to update variable",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * DELETE /:guildId/variables/:variableId
 * Delete a custom variable
 */
export async function apiDeleteVariable(req, res) {
  const { guildId, variableId } = req.params;
  logRequest(`Delete custom variable ${variableId} for guild ${guildId}`, req);

  try {
    const repo = await getVariableRepo();
    const existing = await repo.getById(guildId, variableId);
    if (!existing) {
      const { statusCode, response } = createErrorResponse(
        "Variable not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    await repo.delete(guildId, variableId);

    logger.info(
      `✅ Custom variable '${existing.name}' deleted for guild ${guildId}`,
    );
    res.json(
      createSuccessResponse({
        message: `Variable '${existing.name}' deleted successfully`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error deleting custom variable ${variableId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to delete variable",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
