/**
 * Interaction management utilities
 *
 * This module provides a centralized system for handling Discord interactions
 * with proper error handling, routing, and modular organization.
 *
 * @fileoverview Main entry point for interaction management system
 */

export { InteractionManager } from "./InteractionManager.js";
export {
  handleInteractionError,
  handleButtonError,
  handleCommandError,
  handleAutocompleteError,
  validateInteraction,
  canRespondToInteraction,
  getResponseMethod,
} from "./errorHandler.js";

// Export handlers for direct use if needed
export * from "./handlers/welcomeHandlers.js";
export * from "./handlers/xpHandlers.js";
export * from "./handlers/leaderboardHandlers.js";
export * from "./handlers/sponsorHandlers.js";
export * from "./handlers/helpHandlers.js";

// Export routers
export { routeButtonInteraction } from "./routers/buttonRouter.js";
