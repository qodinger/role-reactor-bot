/**
 * fetch_page Security Guards Tests
 * SSRF protection: address classification, port allowlist, HTML stripping
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { ActionExecutor } from "../../../../src/utils/ai/actionExecutor.js";

describe("fetch_page security guards", () => {
  describe("isPrivateAddress (SSRF blocklist)", () => {
    it("blocks loopback v4/v6", () => {
      expect(ActionExecutor.isPrivateAddress("127.0.0.1")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("127.5.5.5")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("::1")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("::")).toBe(true);
    });

    it("blocks private ranges", () => {
      expect(ActionExecutor.isPrivateAddress("10.1.2.3")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("192.168.0.7")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("172.16.0.1")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("172.31.255.255")).toBe(true);
    });

    it("blocks link-local and cloud metadata addresses", () => {
      expect(ActionExecutor.isPrivateAddress("169.254.169.254")).toBe(true);
    });

    it("blocks unique-local IPv6 and IPv4-mapped", () => {
      expect(ActionExecutor.isPrivateAddress("fc00::1")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("fd12:3456::1")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    });

    it("allows public addresses", () => {
      expect(ActionExecutor.isPrivateAddress("8.8.8.8")).toBe(false);
      expect(ActionExecutor.isPrivateAddress("172.15.0.1")).toBe(false);
      expect(ActionExecutor.isPrivateAddress("1.1.1.1")).toBe(false);
    });

    it("denies unknown formats by default", () => {
      expect(ActionExecutor.isPrivateAddress("not-an-ip")).toBe(true);
      expect(ActionExecutor.isPrivateAddress("")).toBe(true);
    });
  });

  describe("isAllowedPort (no internal-service poking)", () => {
    it("allows default and standard web ports", () => {
      expect(
        ActionExecutor.isAllowedPort(new URL("https://example.com/")),
      ).toBe(true);
      expect(
        ActionExecutor.isAllowedPort(new URL("http://example.com:80/")),
      ).toBe(true);
      expect(
        ActionExecutor.isAllowedPort(new URL("https://example.com:443/")),
      ).toBe(true);
    });

    it("blocks non-standard ports (3030 API, 8080 searxng, etc.)", () => {
      expect(
        ActionExecutor.isAllowedPort(new URL("http://127.0.0.1:3030/")),
      ).toBe(false);
      expect(
        ActionExecutor.isAllowedPort(new URL("http://host:8080/search")),
      ).toBe(false);
      expect(ActionExecutor.isAllowedPort(new URL("http://host:22/"))).toBe(
        false,
      );
    });
  });

  describe("input validation", () => {
    it("rejects missing url", async () => {
      expect(await ActionExecutor.executeFetchPage({ options: {} })).toContain(
        "requires 'url'",
      );
    });

    it("rejects invalid URLs", async () => {
      const r = await ActionExecutor.executeFetchPage({
        options: { url: "not a url" },
      });
      expect(r).toContain("not a valid URL");
    });

    it("rejects non-http protocols", async () => {
      for (const bad of ["file:///etc/passwd", "gopher://x/y", "ftp://h/f"]) {
        const r = await ActionExecutor.executeFetchPage({
          options: { url: bad },
        });
        expect(r).toContain("only http(s)");
      }
    });

    it("blocks localhost before any network call", async () => {
      const r = await ActionExecutor.executeFetchPage({
        options: { url: "http://localhost/admin" },
      });
      expect(r).toMatch(/blocked|not publicly reachable/i);
    });

    it("blocks non-standard ports immediately", async () => {
      const r = await ActionExecutor.executeFetchPage({
        options: { url: "http://localhost:8080/admin" },
      });
      expect(r).toContain("standard web ports");
    });
  });

  describe("htmlToText", () => {
    it("strips scripts, styles, tags and decodes core entities", () => {
      const html = `<!DOCTYPE html><html><head><script>alert("xss")</script>
        <style>.a{}</style><title>Hi</title></head>
        <body><h1>Title</h1><p>It&apos;s a &amp; test &lt;page&gt;</p>
        <!-- comment --></body></html>`;
      const text = ActionExecutor.htmlToText(html);
      expect(text).not.toContain("alert");
      expect(text).not.toContain("xss");
      expect(text).not.toContain("comment");
      expect(text).toContain("Title");
      expect(text).toContain("It's a & test <page>");
    });
  });

  describe("guarded agent regression", () => {
    it("resolves a real public fetch without hanging (callback-style lookup)", async () => {
      // If the agent lookup ever uses dns/promises the connect stalls and
      // this times out instead of returning promptly.
      const start = Date.now();
      const r = await ActionExecutor.executeFetchPage({
        options: { url: "https://example.com/" },
      });
      expect(Date.now() - start).toBeLessThan(15_000);
      expect(r).toMatch(/^Data: Page content|^Web page fetch failed/);
    }, 20_000);
  });
});
