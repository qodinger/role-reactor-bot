/**
 * Integration Tests for Role Bundles API
 *
 * Tests the real Express app (route wiring + middleware chain) via supertest:
 * - Endpoints are mounted at /api/v1/guilds/:guildId/role-bundles
 * - internalAuth rejects missing/invalid keys (and wrong header names)
 * - requireGuildPermission rejects unauthenticated / non-member users
 * - No unauthenticated request ever reaches the database layer (never 5xx)
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

describe("Role Bundles API Integration", () => {
  let app;
  const API_BASE = "/api/v1";
  const testGuildId = "123456789012345678";
  const testBundleName = "Test Bundle";

  beforeAll(async () => {
    const { initAppForTests } = await import(
      "../../src/server/webhookServer.js"
    );
    app = await initAppForTests();
  });

  describe("Route Wiring", () => {
    it("GET /guilds/:guildId/role-bundles should be mounted (not 404)", async () => {
      const response = await request(app).get(
        `${API_BASE}/guilds/${testGuildId}/role-bundles`,
      );

      expect(response.status).not.toBe(404);
      expect(response.status).toBeLessThan(500);
    });

    it("POST /guilds/:guildId/role-bundles should be mounted (not 404)", async () => {
      const response = await request(app)
        .post(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .send({ name: testBundleName, roles: [] });

      expect(response.status).not.toBe(404);
      expect(response.status).toBeLessThan(500);
    });

    it("DELETE /guilds/:guildId/role-bundles/:name should be mounted (not 404)", async () => {
      const response = await request(app).delete(
        `${API_BASE}/guilds/${testGuildId}/role-bundles/${encodeURIComponent(testBundleName)}`,
      );

      expect(response.status).not.toBe(404);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Internal Authentication (internalAuth middleware)", () => {
    it("should reject request with no API key", async () => {
      const response = await request(app).get(
        `${API_BASE}/guilds/${testGuildId}/role-bundles`,
      );

      expect(response.status).toBe(401);
    });

    it("should reject request with invalid API key", async () => {
      const response = await request(app)
        .get(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .set("Authorization", "Bearer invalid-key-12345");

      expect(response.status).toBe(401);
    });

    it("should reject key sent via wrong header name (x-internal-api-key)", async () => {
      // Regression test: only `Authorization` or `x-api-key` headers are accepted.
      const internalKey = process.env.INTERNAL_API_KEY || "test-key";
      const response = await request(app)
        .get(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .set("x-internal-api-key", internalKey);

      expect(response.status).toBe(401);
    });

    it("should accept Bearer token format via Authorization header", async () => {
      // Valid internal key passes internalAuth but fails later auth (user session)
      const internalKey = process.env.INTERNAL_API_KEY || "test-key";
      const response = await request(app)
        .get(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .set("Authorization", `Bearer ${internalKey}`);

      // 401 here comes from user auth (no session) — NOT from internalAuth.
      // The key distinction: internalAuth accepted the request.
      expect(response.status).toBe(401);
      expect(response.body.message).not.toContain("Internal access only");
    });

    it("should accept x-api-key header", async () => {
      const internalKey = process.env.INTERNAL_API_KEY || "test-key";
      const response = await request(app)
        .get(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .set("x-api-key", internalKey);

      expect(response.status).toBe(401);
      expect(response.body.message).not.toContain("Internal access only");
    });
  });

  describe("Guild Permission (requireGuildPermission middleware)", () => {
    const internalKey = () => process.env.INTERNAL_API_KEY || "test-key";

    it("should reject valid internal key without any user identity (POST)", async () => {
      const response = await request(app)
        .post(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .set("Authorization", `Bearer ${internalKey()}`)
        .send({
          name: testBundleName,
          roles: [{ roleId: "111111111111111111", roleName: "Test" }],
        });

      expect(response.status).toBe(401);
    });

    it("should reject internal access for user not in guild (GET)", async () => {
      const fakeUserId = "111111111111111111";
      const response = await request(app)
        .get(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .set("Authorization", `Bearer ${internalKey()}`)
        .set("x-user-id", fakeUserId);

      expect(response.status).toBe(403);
    });

    it("should reject internal access for user not in guild (DELETE)", async () => {
      const fakeUserId = "111111111111111111";
      const response = await request(app)
        .delete(
          `${API_BASE}/guilds/${testGuildId}/role-bundles/${encodeURIComponent(testBundleName)}`,
        )
        .set("Authorization", `Bearer ${internalKey()}`)
        .set("x-user-id", fakeUserId);

      expect(response.status).toBe(403);
    });
  });

  describe("Error Safety", () => {
    it("should return 400 (not 500) on malformed request bodies", async () => {
      const internalKey = process.env.INTERNAL_API_KEY || "test-key";
      const response = await request(app)
        .post(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .set("Authorization", `Bearer ${internalKey}`)
        .set("Content-Type", "application/json")
        .send("{ invalid json !!!");

      expect(response.status).toBe(400);
    });

    it("should never reach database layer without valid session (never 5xx on any method)", async () => {
      const get = await request(app).get(
        `${API_BASE}/guilds/${testGuildId}/role-bundles`,
      );
      const post = await request(app)
        .post(`${API_BASE}/guilds/${testGuildId}/role-bundles`)
        .send({});
      const del = await request(app).delete(
        `${API_BASE}/guilds/${testGuildId}/role-bundles/nonexistent`,
      );

      for (const res of [get, post, del]) {
        expect(res.status).toBeLessThan(500);
      }
    });
  });
});
