/**
 * Simple delay utility function
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after the delay
 */
export function delay(ms) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
}
