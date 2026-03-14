/**
 * Ticket General Handlers — barrel re-export
 *
 * Each handler lives in its own focused module:
 *   - generalList.js       → /ticket list
 *   - generalView.js       → /ticket view
 *   - generalTranscript.js → /ticket transcript
 */

export { handleList } from "./generalList.js";
export { handleView } from "./generalView.js";
export { handleTranscript } from "./generalTranscript.js";
