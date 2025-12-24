// Export all AI services and utilities
export {
  MultiProviderAIService,
  multiProviderAIService,
} from "./multiProviderAIService.js";
export {
  AvatarService,
  avatarService,
  generateAvatar,
  generateAvatar as generateAIAvatar, // Alias for convenience
} from "./avatarService.js";
export { ChatService, chatService } from "./chatService.js";
export { performanceMonitor } from "./performanceMonitor.js";
export { commandSuggester } from "./commandSuggester.js";
