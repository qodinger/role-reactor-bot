/**
 * Pagination Utilities
 * Provides helper functions for paginating data
 */

/**
 * Paginate an array of items
 * @param {Array} items - Array of items to paginate
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Number of items per page
 * @returns {Object} Paginated result with items and pagination info
 */
export function paginate(items, page = 1, limit = 20) {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);

  // Validate page number
  if (page < 1) {
    page = 1;
  }
  if (page > totalPages && totalPages > 0) {
    page = totalPages;
  }

  // Calculate offset after page validation
  const offset = (page - 1) * limit;
  const paginatedItems = items.slice(offset, offset + limit);

  return {
    items: paginatedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      offset,
    },
  };
}

/**
 * Create pagination metadata for offset-based pagination
 * @param {number} offset - Current offset
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
export function createPaginationMetadata(offset, limit, total) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return {
    offset,
    limit,
    total,
    totalPages,
    currentPage,
    hasNext: offset + limit < total,
    hasPrev: offset > 0,
  };
}

/**
 * Validate and normalize pagination parameters
 * @param {Object} params - Pagination parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {number} params.offset - Offset
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {Object} Normalized pagination parameters
 */
export function normalizePagination(params, maxLimit = 100) {
  const { page, limit, offset } = params;

  // If page is provided, use page-based pagination
  if (page !== undefined) {
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const normalizedLimit = Math.min(
      maxLimit,
      Math.max(1, Math.floor(limit) || 20),
    );
    return {
      type: "page",
      page: normalizedPage,
      limit: normalizedLimit,
      offset: (normalizedPage - 1) * normalizedLimit,
    };
  }

  // Otherwise, use offset-based pagination
  const normalizedOffset = Math.max(0, Math.floor(offset) || 0);
  const normalizedLimit = Math.min(
    maxLimit,
    Math.max(1, Math.floor(limit) || 20),
  );

  return {
    type: "offset",
    offset: normalizedOffset,
    limit: normalizedLimit,
    page: Math.floor(normalizedOffset / normalizedLimit) + 1,
  };
}
