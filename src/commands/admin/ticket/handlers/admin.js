/**
 * Ticket Admin Handlers — barrel re-export
 *
 * Each handler lives in its own focused module:
 *   - setup.js     → /ticket setup
 *   - info.js      → /ticket info (view / stats / storage)
 *   - panel.js     → /ticket panel (list, delete, add/remove/list categories)
 *   - settings.js  → /ticket settings (interactive dashboard)
 */

export { handleSetup } from "./setup.js";
export { handleInfo } from "./info.js";
export { handlePanel } from "./panel.js";
export { handleSettings } from "./settings.js";
