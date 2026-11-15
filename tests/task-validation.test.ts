import { describe, expect, it } from "vitest";

import { MSG_TITLE_INVALID, validateTitle } from "@/lib/task-validation";

describe("AC-001.4 title validation", () => {
  it("AC-001.4 uses the exact message text", () => {
    expect(MSG_TITLE_INVALID).toBe("Title must be 1 to 200 characters and not only spaces.");
  });

  it("AC-001.4 rejects an empty title", () => {
    expect(validateTitle("")).toBe(MSG_TITLE_INVALID);
  });

  it("AC-001.4 rejects a title of only spaces", () => {
    expect(validateTitle("   \t ")).toBe(MSG_TITLE_INVALID);
  });

  it("AC-001.4 rejects a title longer than 200 code points", () => {
    expect(validateTitle("a".repeat(201))).toBe(MSG_TITLE_INVALID);
    expect(validateTitle("😀".repeat(201))).toBe(MSG_TITLE_INVALID);
  });

  it("AC-001.4 accepts 1 and 200 code points (emoji count once)", () => {
    expect(validateTitle("a")).toBeNull();
    expect(validateTitle("a".repeat(200))).toBeNull();
    expect(validateTitle("😀".repeat(200))).toBeNull();
    expect(validateTitle("Buy milk")).toBeNull();
  });
});
