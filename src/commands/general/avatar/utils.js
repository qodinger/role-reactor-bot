/**
 * Utility functions for the avatar command
 */

/**
 * Check if a user has a custom server avatar
 * @param {string} serverAvatar - Server avatar URL
 * @param {string} globalAvatar - Global avatar URL
 * @returns {boolean} True if server avatar differs from global
 */
export function hasServerAvatar(serverAvatar, globalAvatar) {
  return serverAvatar !== globalAvatar;
}

/**
 * Get avatar URL with specified size and format
 * @param {Object} user - Discord user object
 * @param {number} size - Avatar size (default: 1024)
 * @param {string} extension - File extension (png, jpg, webp)
 * @returns {string} Avatar URL
 */
export function getAvatarURL(user, size = 1024, extension = "png") {
  return user.displayAvatarURL({ size, extension });
}

/**
 * Check if avatar is animated (GIF)
 * @param {string} avatarURL - Avatar URL
 * @returns {boolean} True if avatar is animated
 */
export function isAnimatedAvatar(avatarURL) {
  return avatarURL.includes(".gif");
}
