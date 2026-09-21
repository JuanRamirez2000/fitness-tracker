import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Marisol Reyes")).toBe("MR");
    expect(initialsOf("juan pablo ramirez")).toBe("JP");
  });

  it("handles a single name and stray whitespace", () => {
    expect(initialsOf("juan")).toBe("J");
    expect(initialsOf("  ana   ")).toBe("A");
  });

  it("keeps a full character for non-BMP letters", () => {
    expect(initialsOf("𠮷野 家")).toBe("𠮷家");
  });

  it("falls back when there is no name", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});
