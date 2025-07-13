// Theme configuration for consistent branding across the bot
export const THEME = {
  // Primary brand color
  PRIMARY: 0x7f7bf5, // Main brand color

  // Status colors
  SUCCESS: 0x00ff00, // Green for success messages
  ERROR: 0xff0000, // Red for error messages
  WARNING: 0xffff00, // Yellow for warnings
  INFO: 0x0099ff, // Blue for info messages (same as primary)

  // Additional colors
  BLUE: 0x0099ff, // Blue for secondary actions
  ORANGE: 0xff9900, // Orange for notifications
  PURPLE: 0x9932cc, // Purple for special features
  PINK: 0xff69b4, // Pink for fun features
};

// Default theme color (alias for PRIMARY)
export const THEME_COLOR = THEME.PRIMARY;
