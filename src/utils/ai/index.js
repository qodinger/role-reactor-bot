// Export all AI services and utilities
export {
  AIService,
  aiService,
  generateImage,
  generateText,
  generate,
} from "./aiService.js";
export {
  AvatarService,
  avatarService,
  generateAvatar,
} from "./avatarService.js";
export {
  TextService,
  textService,
  generateCreativeWriting,
  generateCodeExplanation,
  generateSummary,
} from "./textService.js";

// Re-export commonly used functions
export { generateAvatar as generateAIAvatar } from "./avatarService.js";
