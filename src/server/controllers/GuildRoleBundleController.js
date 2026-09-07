import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";

const logger = getLogger();

/**
 * Get guild role bundles
 */
export async function apiGetGuildRoleBundles(req, res) {
  const { guildId } = req.params;
  logRequest(`Get guild role bundles: ${guildId}`, req, {
    userId: req.user?.id,
    username: req.user?.username,
  });

  if (!guildId) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID is required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { default: roleBundleManager } = await import(
      "../../features/rolebundles/RoleBundleManager.js"
    );

    await roleBundleManager.init();
    const bundles = await roleBundleManager.getAllForGuild(guildId);

    res.json({
      success: true,
      bundles: bundles || [],
      total: bundles?.length || 0,
    });
  } catch (error) {
    logger.error("❌ Error fetching role bundles:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to fetch role bundles",
      500,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Create a role bundle
 */
export async function apiCreateRoleBundle(req, res) {
  const { guildId } = req.params;
  const { name, roles } = req.body;

  logRequest(`Create role bundle: ${guildId}`, req, {
    userId: req.user?.id,
    username: req.user?.username,
  });

  if (!guildId || !name || !roles) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID, name, and roles are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { default: roleBundleManager } = await import(
      "../../features/rolebundles/RoleBundleManager.js"
    );

    await roleBundleManager.init();

    // Check if bundle already exists
    const exists = await roleBundleManager.exists(guildId, name);
    if (exists) {
      const { statusCode, response } = createErrorResponse(
        "A bundle with this name already exists",
        409,
      );
      return res.status(statusCode).json(response);
    }

    // Check bundle limit
    const { FREE_TIER, PRO_TIER } = await import(
      "../../features/premium/config.js"
    );
    const { getPremiumManager } = await import(
      "../../features/premium/PremiumManager.js"
    );
    const premiumManager = getPremiumManager();
    const isPro = await premiumManager.isFeatureActive(guildId, "pro_engine");

    const currentBundles = await roleBundleManager.count(guildId);
    const maxBundles = isPro
      ? PRO_TIER.ROLE_BUNDLE_MAX_ACTIVE
      : FREE_TIER.ROLE_BUNDLE_MAX_ACTIVE;

    if (currentBundles >= maxBundles) {
      const { statusCode, response } = createErrorResponse(
        `Maximum bundle limit reached (${maxBundles}). ${isPro ? "" : "Upgrade to Pro for more bundles."}`,
        403,
      );
      return res.status(statusCode).json(response);
    }

    // Check roles per bundle limit
    const maxRoles = isPro
      ? PRO_TIER.ROLE_BUNDLE_MAX_ROLES
      : FREE_TIER.ROLE_BUNDLE_MAX_ROLES;

    if (roles.length > maxRoles) {
      const { statusCode, response } = createErrorResponse(
        `Maximum roles per bundle exceeded (${maxRoles}). ${isPro ? "" : "Upgrade to Pro for more roles."}`,
        403,
      );
      return res.status(statusCode).json(response);
    }

    const bundle = await roleBundleManager.create({
      guildId,
      name: name.trim(),
      roles,
    });

    logger.info(`📦 Role bundle created via API: ${name} in guild ${guildId}`);

    res.json({
      success: true,
      bundle,
      message: "Bundle created successfully",
    });
  } catch (error) {
    logger.error("❌ Error creating role bundle:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to create role bundle",
      500,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Delete a role bundle
 */
export async function apiDeleteRoleBundle(req, res) {
  const { guildId, bundleName } = req.params;

  logRequest(`Delete role bundle: ${guildId}/${bundleName}`, req, {
    userId: req.user?.id,
    username: req.user?.username,
  });

  if (!guildId || !bundleName) {
    const { statusCode, response } = createErrorResponse(
      "Guild ID and bundle name are required",
      400,
    );
    return res.status(statusCode).json(response);
  }

  try {
    const { default: roleBundleManager } = await import(
      "../../features/rolebundles/RoleBundleManager.js"
    );

    await roleBundleManager.init();

    const exists = await roleBundleManager.exists(guildId, bundleName);
    if (!exists) {
      const { statusCode, response } = createErrorResponse(
        "Bundle not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    await roleBundleManager.deleteByName(guildId, bundleName);

    logger.info(
      `📦 Role bundle deleted via API: ${bundleName} from guild ${guildId}`,
    );

    res.json({
      success: true,
      message: "Bundle deleted successfully",
    });
  } catch (error) {
    logger.error("❌ Error deleting role bundle:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to delete role bundle",
      500,
    );
    res.status(statusCode).json(response);
  }
}
