import { describe, it, expect } from "vitest";
import {
  InputSanitizer,
  InputValidator,
  createModalValidator,
  formValidationErrors,
  INPUT_LIMITS,
} from "../../src/utils/validation/inputValidation.js";

describe("InputSanitizer", () => {
  describe("stripHtml", () => {
    it("should remove HTML tags", () => {
      const input = "<b>Hello</b> World";
      expect(InputSanitizer.stripHtml(input)).toBe("Hello World");
    });

    it("should handle nested tags", () => {
      const input = "<div><p>Hello <b>World</b></p></div>";
      expect(InputSanitizer.stripHtml(input)).toBe("Hello World");
    });

    it("should decode HTML entities", () => {
      const input = "&lt;script&gt;";
      expect(InputSanitizer.stripHtml(input)).toBe("<script>");
    });

    it("should return empty string for non-string input", () => {
      expect(InputSanitizer.stripHtml(null)).toBe("");
      expect(InputSanitizer.stripHtml(undefined)).toBe("");
      expect(InputSanitizer.stripHtml(123)).toBe("");
    });
  });

  describe("removeScripts", () => {
    it("should remove script tags", () => {
      const input = "<script>alert('xss')</script>Hello";
      expect(InputSanitizer.removeScripts(input)).toBe("Hello");
    });

    it("should remove event handlers", () => {
      const input = '<img src="x" onerror="alert(1)">';
      const result = InputSanitizer.removeScripts(input);
      expect(result).not.toContain("onerror");
      expect(result).toContain('<img src="x"');
    });

    it("should remove javascript: protocol", () => {
      const input = 'javascript:alert("xss")';
      expect(InputSanitizer.removeScripts(input)).toBe('alert("xss")');
    });

    it("should remove data URLs", () => {
      const input =
        "data:text/html;base64,PHN2Y3JpcHQ+YWxlcnQoMSk8L3N2Y3JpcHQ+";
      const result = InputSanitizer.removeScripts(input);
      expect(result).not.toContain("data:");
      expect(InputValidator.containsMaliciousContent(result)).toBe(false);
    });
  });

  describe("sanitize", () => {
    it("should perform comprehensive sanitization", () => {
      const input = "<script>alert('xss')</script>Hello<script>";
      const result = InputSanitizer.sanitize(input);
      expect(result).toBe("Hello");
      expect(InputValidator.containsMaliciousContent(result)).toBe(false);
    });

    it("should trim whitespace", () => {
      const input = "  Hello World  ";
      expect(InputSanitizer.sanitize(input)).toBe("Hello World");
    });
  });

  describe("escapeForDb", () => {
    it("should escape MongoDB special characters", () => {
      const input = "user$name.test[1]";
      const result = InputSanitizer.escapeForDb(input);
      expect(result).toBe("user\\$name\\.test\\[1\\]");
    });

    it("should escape backslashes", () => {
      const input = "path\\to\\file";
      const result = InputSanitizer.escapeForDb(input);
      expect(result).toBe("path\\\\to\\\\file");
    });
  });
});

describe("InputValidator", () => {
  describe("validateRequired", () => {
    it("should return error for empty values", () => {
      expect(InputValidator.validateRequired("", "Name")).toBeTruthy();
      expect(InputValidator.validateRequired(null, "Name")).toBeTruthy();
      expect(InputValidator.validateRequired(undefined, "Name")).toBeTruthy();
    });

    it("should return null for valid values", () => {
      expect(InputValidator.validateRequired("test", "Name")).toBeNull();
      expect(InputValidator.validateRequired(0, "Name")).toBeNull();
    });
  });

  describe("validateLength", () => {
    it("should validate minimum length", () => {
      const error = InputValidator.validateLength("ab", "Name", 3, 10);
      expect(error).toBeTruthy();
      expect(error.code).toBe("TOO_SHORT");
    });

    it("should validate maximum length", () => {
      const error = InputValidator.validateLength("abcdefghijk", "Name", 1, 5);
      expect(error).toBeTruthy();
      expect(error.code).toBe("TOO_LONG");
    });

    it("should return null for valid length", () => {
      expect(InputValidator.validateLength("abc", "Name", 1, 5)).toBeNull();
    });
  });

  describe("validateEmail", () => {
    it("should validate correct email formats", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "user+tag@example.co.uk",
      ];
      validEmails.forEach(email => {
        expect(InputValidator.validateEmail(email)).toBeNull();
      });
    });

    it("should reject invalid email formats", () => {
      const invalidEmails = [
        "notanemail",
        "@nodomain.com",
        "user@",
        "user@.com",
      ];
      invalidEmails.forEach(email => {
        expect(InputValidator.validateEmail(email)).toBeTruthy();
      });
    });

    it("should return error for required empty email", () => {
      const error = InputValidator.validateEmail("", "Email");
      expect(error).toBeTruthy();
      expect(error.code).toBe("REQUIRED");
    });
  });

  describe("validateDiscordId", () => {
    it("should validate correct Discord IDs", () => {
      expect(InputValidator.validateDiscordId("123456789012345678")).toBeNull();
      expect(InputValidator.validateDiscordId("12345678901234567")).toBeNull();
    });

    it("should reject invalid Discord IDs", () => {
      expect(InputValidator.validateDiscordId("abc")).toBeTruthy();
      expect(InputValidator.validateDiscordId("123")).toBeTruthy();
      expect(
        InputValidator.validateDiscordId("1234567890123456789x"),
      ).toBeTruthy();
    });
  });

  describe("containsMaliciousContent", () => {
    it("should detect script tags", () => {
      expect(
        InputValidator.containsMaliciousContent("<script>alert(1)</script>"),
      ).toBe(true);
    });

    it("should detect javascript: protocol", () => {
      expect(
        InputValidator.containsMaliciousContent("javascript:alert(1)"),
      ).toBe(true);
    });

    it("should detect event handlers", () => {
      expect(
        InputValidator.containsMaliciousContent('<img onerror="alert(1)">'),
      ).toBe(true);
    });

    it("should detect iframe tags", () => {
      expect(
        InputValidator.containsMaliciousContent("<iframe src='evil'></iframe>"),
      ).toBe(true);
    });

    it("should return false for safe content", () => {
      expect(InputValidator.containsMaliciousContent("Hello World")).toBe(
        false,
      );
      expect(InputValidator.containsMaliciousContent("No HTML here")).toBe(
        false,
      );
    });
  });
});

describe("FormValidator", () => {
  it("should validate required fields", () => {
    const validator = createModalValidator("test");
    validator.addTextField("name", { required: true });

    const result = validator.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should validate email fields", () => {
    const validator = createModalValidator("test");
    validator.addEmailField("email", { required: true });

    const result = validator.validate({ email: "notvalid" });
    expect(result.valid).toBe(false);
    expect(result.hasErrors).toBe(true);
  });

  it("should validate number fields with range", () => {
    const validator = createModalValidator("test");
    validator.addNumberField("amount", { required: true, min: 1, max: 100 });

    const result = validator.validate({ amount: "150" });
    expect(result.valid).toBe(false);
  });

  it("should validate length limits", () => {
    const validator = createModalValidator("test");
    validator.addTextField("name", { required: true, maxLength: 5 });

    const result = validator.validate({ name: "This is too long" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("TOO_LONG");
  });

  it("should strip HTML from text inputs", () => {
    const validator = createModalValidator("test");
    validator.addTextField("message", { stripHtml: true, removeScripts: true });

    const result = validator.validate({ message: "<b>Safe text</b>" });
    expect(result.sanitized.message).toBe("Safe text");
  });

  it("should return sanitized values", () => {
    const validator = createModalValidator("test");
    validator.addTextField("name", { maxLength: 100 });

    const result = validator.validate({ name: "  John Doe  " });
    expect(result.valid).toBe(true);
    expect(result.sanitized.name).toBe("John Doe");
  });

  it("should get error messages", () => {
    const validator = createModalValidator("test");
    validator.addTextField("name", { required: true });

    const result = validator.validate({});
    expect(result.getErrorMessages().length).toBeGreaterThan(0);
  });

  it("should get first error", () => {
    const validator = createModalValidator("test");
    validator.addTextField("name", { required: true });
    validator.addTextField("email", { required: true });

    const result = validator.validate({});
    expect(result.getFirstError()).toBeTruthy();
  });
});

describe("formValidationErrors", () => {
  it("should have all required error message functions", () => {
    expect(typeof formValidationErrors.REQUIRED).toBe("function");
    expect(typeof formValidationErrors.TOO_SHORT).toBe("function");
    expect(typeof formValidationErrors.TOO_LONG).toBe("function");
    expect(typeof formValidationErrors.INVALID_EMAIL).toBe("string");
    expect(typeof formValidationErrors.INVALID_DISCORD_ID).toBe("string");
    expect(typeof formValidationErrors.CONTAINS_HTML).toBe("function");
    expect(typeof formValidationErrors.INVALID_USER_ID).toBe("string");
  });

  it("should generate correct error messages", () => {
    expect(formValidationErrors.REQUIRED("Name")).toBe("Name is required");
    expect(formValidationErrors.TOO_SHORT("Name", 3)).toBe(
      "Name must be at least 3 characters",
    );
    expect(formValidationErrors.TOO_LONG("Name", 10)).toBe(
      "Name must be at most 10 characters",
    );
  });
});

describe("INPUT_LIMITS", () => {
  it("should have all required limits", () => {
    expect(INPUT_LIMITS.SHORT_TEXT).toBe(100);
    expect(INPUT_LIMITS.MEDIUM_TEXT).toBe(500);
    expect(INPUT_LIMITS.LONG_TEXT).toBe(2000);
    expect(INPUT_LIMITS.MESSAGE_CONTENT).toBe(2000);
    expect(INPUT_LIMITS.EMBED_TITLE).toBe(256);
    expect(INPUT_LIMITS.EMBED_DESCRIPTION).toBe(4096);
    expect(INPUT_LIMITS.POLL_QUESTION).toBe(300);
    expect(INPUT_LIMITS.POLL_OPTION).toBe(55);
  });
});
