/**
 * Unit tests for Ticket System - File Structure
 * Verifies ticket system files exist
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";

const TICKET_BASE = join(process.cwd(), "src/commands/admin/ticket");

describe("Ticket System - File Structure", () => {
  describe("Command Files", () => {
    it("should have main index.js", () => {
      expect(existsSync(join(TICKET_BASE, "index.js"))).toBe(true);
    });

    it("should have utils.js", () => {
      expect(existsSync(join(TICKET_BASE, "utils.js"))).toBe(true);
    });
  });

  describe("Handler Files", () => {
    it("should have handlers/admin.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/admin.js"))).toBe(true);
    });

    it("should have handlers/general.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/general.js"))).toBe(true);
    });

    it("should have handlers/staff.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/staff.js"))).toBe(true);
    });

    it("should have handlers/setup.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/setup.js"))).toBe(true);
    });

    it("should have handlers/panel.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/panel.js"))).toBe(true);
    });

    it("should have handlers/info.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/info.js"))).toBe(true);
    });

    it("should have handlers/generalList.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/generalList.js"))).toBe(true);
    });

    it("should have handlers/generalView.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/generalView.js"))).toBe(true);
    });

    it("should have handlers/generalTranscript.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/generalTranscript.js"))).toBe(true);
    });

    it("should have handlers/staffClaim.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/staffClaim.js"))).toBe(true);
    });

    it("should have handlers/staffClose.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/staffClose.js"))).toBe(true);
    });

    it("should have handlers/staffManage.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/staffManage.js"))).toBe(true);
    });

    it("should have handlers/staffMembers.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/staffMembers.js"))).toBe(true);
    });

    it("should have handlers/settings.js", () => {
      expect(existsSync(join(TICKET_BASE, "handlers/settings.js"))).toBe(true);
    });
  });

  describe("Feature Files", () => {
    it("should have TicketManager", () => {
      expect(
        existsSync(join(process.cwd(), "src/features/ticketing/TicketManager.js"))
      ).toBe(true);
    });

    it("should have TicketPanel", () => {
      expect(
        existsSync(join(process.cwd(), "src/features/ticketing/TicketPanel.js"))
      ).toBe(true);
    });

    it("should have TicketTranscript", () => {
      expect(
        existsSync(join(process.cwd(), "src/features/ticketing/TicketTranscript.js"))
      ).toBe(true);
    });

    it("should have config", () => {
      expect(
        existsSync(join(process.cwd(), "src/features/ticketing/config.js"))
      ).toBe(true);
    });

    it("should have embeds", () => {
      expect(
        existsSync(join(process.cwd(), "src/features/ticketing/embeds.js"))
      ).toBe(true);
    });
  });
});
