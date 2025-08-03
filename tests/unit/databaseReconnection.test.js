import { jest } from "@jest/globals";
import { getDatabaseManager } from "../../src/utils/storage/databaseManager.js";

// Mock the entire mongodb module
const mockMongoClient = jest.fn();
jest.mock("mongodb", () => ({
  MongoClient: mockMongoClient,
}));

describe("Database Reconnection Tests", () => {
  let mockClient;
  let mockDb;
  let mockCollection;
  let dbManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup mock MongoDB client
    mockCollection = {
      find: jest
        .fn()
        .mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      createIndex: jest.fn().mockResolvedValue({}),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      admin: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue({}),
      }),
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(mockClient),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue(),
    };

    // Set up the mock implementation
    mockMongoClient.mockImplementation(() => mockClient);
  });

  afterEach(async () => {
    // Clean up any remaining timers
    jest.clearAllTimers();

    // Properly close the database manager to clean up intervals
    if (dbManager && dbManager.connectionManager) {
      await dbManager.connectionManager.close();
    }
  });

  describe("Connection Manager Reconnection", () => {
    test("should have reconnection configuration", async () => {
      // Get the database manager and check its configuration
      dbManager = await getDatabaseManager();

      // Mock the _setupConnectionMonitoring to prevent interval creation
      dbManager.connectionManager._setupConnectionMonitoring = jest.fn();

      // Verify that reconnection logic is in place
      expect(dbManager.connectionManager).toBeDefined();
      expect(dbManager.connectionManager.maxReconnectAttempts).toBe(5);
      expect(dbManager.connectionManager.reconnectDelay).toBe(2000);
    }, 15000); // Increase timeout for database operations

    test("should detect connection loss", async () => {
      // Mock successful initial connection
      mockClient.connect.mockResolvedValue(mockClient);

      dbManager = await getDatabaseManager();

      // Mock the _setupConnectionMonitoring to prevent interval creation
      dbManager.connectionManager._setupConnectionMonitoring = jest.fn();

      // Simulate connection loss by making ping fail
      mockDb.admin.mockReturnValue({
        ping: jest.fn().mockRejectedValueOnce(new Error("Connection lost")),
      });

      // Trigger health check
      const healthStatus = await dbManager.healthCheck();

      // Should detect connection loss
      expect(healthStatus).toBe(false);
    }, 10000); // Add timeout

    test("should handle connection state changes", async () => {
      // Mock successful connection
      mockClient.connect.mockResolvedValue(mockClient);

      dbManager = await getDatabaseManager();

      // Mock the _setupConnectionMonitoring to prevent interval creation
      dbManager.connectionManager._setupConnectionMonitoring = jest.fn();

      // Test basic connection state management
      expect(dbManager.connectionManager).toBeDefined();
      expect(dbManager.connectionManager.isConnected).toBeDefined();
      expect(typeof dbManager.connectionManager.isConnected).toBe("boolean");

      // Test that the method exists and returns a boolean
      expect(typeof dbManager.connectionManager.isConnectionHealthy).toBe(
        "function",
      );

      // Test the method returns a boolean (regardless of actual value)
      const result = dbManager.connectionManager.isConnectionHealthy();
      expect(typeof result).toBe("boolean");
    }, 10000); // Add timeout for this test
  });
});
