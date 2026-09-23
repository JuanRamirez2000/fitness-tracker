import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "./theme-context";

describe("THEME_INIT_SCRIPT", () => {
  it("is valid, self-contained JavaScript", () => {
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });

  it("only ever sets data-theme to light, never any other value", () => {
    expect(THEME_INIT_SCRIPT).toContain('dataset.theme="light"');
    expect(THEME_INIT_SCRIPT).toMatch(/t==="light"/);
  });

  it("reads the same localStorage key the toggle writes", () => {
    expect(THEME_INIT_SCRIPT).toContain('localStorage.getItem("theme")');
  });
});
