/**
 * Ticket Staff Handlers — barrel re-export
 *
 * Each handler lives in its own focused module:
 *   - staffClaim.js    → /ticket claim
 *   - staffClose.js    → /ticket close
 *   - staffMembers.js  → /ticket add, /ticket remove
 *   - staffManage.js   → /ticket transfer, /ticket rename, /ticket alert
 */

export { handleClaim } from "./staffClaim.js";
export { handleClose } from "./staffClose.js";
export { handleAdd, handleRemove } from "./staffMembers.js";
export { handleTransfer, handleRename } from "./staffManage.js";
