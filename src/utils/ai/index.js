// Export all AI services and utilities
export {
  MultiProviderAIService,
  multiProviderAIService,
} from "./multiProviderAIService.js";
export {
  AvatarService,
  avatarService,
  generateAvatar,
} from "./avatarService.js";

// Re-export commonly used functions
export { generateAvatar as generateAIAvatar } from "./avatarService.js";
