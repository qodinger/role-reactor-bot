/**
 * Example Service
 * Template for creating new API services
 *
 * This is a reference implementation showing how to create a new service
 * using the BaseService class.
 */

import { BaseService } from "../BaseService.js";
import { apiRateLimiter } from "../../middleware/rateLimiter.js";
import { requireAuth } from "../../middleware/authentication.js";
import { validateBody, validateParams } from "../../middleware/validation.js";

export class ExampleService extends BaseService {
  constructor() {
    super({
      name: "example",
      version: "v1",
      basePath: "/api/v1/example",
      metadata: {
        description: "Example API service for demonstration",
        version: "1.0.0",
      },
    });

    this.setupRoutes();
  }

  setupRoutes() {
    // Apply rate limiting to all routes
    this.use(apiRateLimiter);

    // GET /api/v1/example - List all items (public)
    this.get("/", this.asyncHandler(this.handleGetAll.bind(this)));

    // GET /api/v1/example/:id - Get item by ID (public)
    this.get(
      "/:id",
      validateParams({
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9-_]+$" },
        },
      }),
      this.asyncHandler(this.handleGetById.bind(this)),
    );

    // POST /api/v1/example - Create item (requires auth)
    this.post(
      "/",
      requireAuth,
      validateBody({
        required: ["name"],
        properties: {
          name: { type: "string", min: 1, max: 100 },
          description: { type: "string", max: 500 },
        },
      }),
      this.asyncHandler(this.handleCreate.bind(this)),
    );

    // PUT /api/v1/example/:id - Update item (requires auth)
    this.put(
      "/:id",
      requireAuth,
      validateParams({
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9-_]+$" },
        },
      }),
      validateBody({
        properties: {
          name: { type: "string", min: 1, max: 100 },
          description: { type: "string", max: 500 },
        },
      }),
      this.asyncHandler(this.handleUpdate.bind(this)),
    );

    // DELETE /api/v1/example/:id - Delete item (requires auth)
    this.delete(
      "/:id",
      requireAuth,
      validateParams({
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9-_]+$" },
        },
      }),
      this.asyncHandler(this.handleDelete.bind(this)),
    );
  }

  async handleGetAll(req, res) {
    // Example: Fetch items from database
    const items = [];
    this.sendSuccess(res, { items, count: items.length });
  }

  async handleGetById(req, res) {
    const { id } = req.params;
    // Example: Fetch item from database
    const item = { id, name: "Example Item" };
    this.sendSuccess(res, { item });
  }

  async handleCreate(req, res) {
    const { name, description } = req.body;
    const userId = req.user.id;

    // Example: Create item in database
    const item = {
      id: `item_${Date.now()}`,
      name,
      description,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    this.sendSuccess(res, { item }, 201);
  }

  async handleUpdate(req, res) {
    const { id } = req.params;
    const { name, description } = req.body;

    // Example: Update item in database
    const item = {
      id,
      name,
      description,
      updatedAt: new Date().toISOString(),
    };

    this.sendSuccess(res, { item });
  }

  async handleDelete(req, res) {
    const { id } = req.params;

    // Example: Delete item from database
    this.sendSuccess(res, { message: `Item ${id} deleted successfully` });
  }
}

// Export service config for auto-loading (optional)
export const serviceConfig = {
  name: "example",
  version: "v1",
  basePath: "/api/v1/example",
  loader: () => {
    const service = new ExampleService();
    return service;
  },
  metadata: {
    description: "Example API service for demonstration",
    version: "1.0.0",
  },
};
