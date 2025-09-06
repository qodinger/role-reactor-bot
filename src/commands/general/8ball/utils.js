/**
 * Utility functions for the 8ball command
 */

/**
 * Get a random response from the specified category
 * @param {Array} responses - Array of response objects
 * @returns {Object} Random response object with text and emoji
 */
export function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Get a random category from available categories
 * @param {Array} categories - Array of category names
 * @returns {string} Random category name
 */
export function getRandomCategory(categories) {
  return categories[Math.floor(Math.random() * categories.length)];
}
