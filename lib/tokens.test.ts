import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE } from "@/lib/theme/palette";
import { CARD_BG, MUTED_2 } from "@/lib/theme/surfaces";
import { contrastRatio } from "./color";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

/** Reads the hex custom properties out of the :root block, so the CSS stays the only source. */
function rootTokens(): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...root.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  );
}

/** The same, for the light theme's `:root[data-theme="light"]` block. */
function lightTokens(): Record<string, string> {
  const block = /:root\[data-theme="light"\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  );
}

const TEXT_TOKENS = ["ink", "muted-1", "muted-2", "muted-3", "accent", "good", "warn", "bad"];
/** Chart marks, not text: WCAG's 3:1 for graphics, against the card they sit on. */
const GRAPHIC_TOKENS = ["domain-rec", "domain-body", "sleep-deep", "sleep-rem", "sleep-light", "sleep-awake"];
const MIN_GRAPHIC_CONTRAST = 3;
const SURFACES = ["bg", "card"];
const MIN_TEXT_CONTRAST = 4.5;

describe("design tokens", () => {
  const tokens = rootTokens();

  it("keeps the TypeScript palette used for heatmap fills in sync with the CSS", () => {
    expect(DEFAULT_PALETTE).toEqual({
      good: tokens.good,
      bad: tokens.bad,
      missed: tokens.bad,
      warn: tokens.warn,
      accent: tokens.accent,
    });
  });

  it("keeps CARD_BG and MUTED_2 in sync with the CSS", () => {
    expect(CARD_BG).toBe(tokens.card);
    expect(MUTED_2).toBe(tokens["muted-2"]);
  });

  it("defines every token named in the brief", () => {
    for (const name of [...TEXT_TOKENS, ...SURFACES, "border"]) {
      expect(tokens[name], name).toBeDefined();
    }
  });

  for (const text of TEXT_TOKENS) {
    for (const surface of SURFACES) {
      it(`${text} on ${surface} is at least ${MIN_TEXT_CONTRAST}:1`, () => {
        expect(contrastRatio(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
      });
    }
  }

  describe("chart tokens", () => {
    const themes = { dark: tokens, light: lightTokens() };
    for (const [theme, t] of Object.entries(themes)) {
      for (const name of GRAPHIC_TOKENS) {
        it(`${theme} ${name} is at least ${MIN_GRAPHIC_CONTRAST}:1 on card`, () => {
          expect(t[name], `${theme} --${name}`).toBeDefined();
          expect(contrastRatio(t[name], t.card)).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
        });
      }
    }
  });
});
