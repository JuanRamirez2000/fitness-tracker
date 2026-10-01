import { describe, expect, it } from "vitest";
import { contrastRatio, mix } from "@/lib/color";
import { COLOR_BLIND_PALETTE, DEFAULT_PALETTE, type Palette } from "@/lib/theme/palette";
import {
  CELL_FLAT,
  CELL_NO_DATA,
  CELL_STEPS_FLOOR,
  CELL_WARMING_UP,
} from "./colors";
import { STAR_INK_DARK, STAR_INK_LIGHT, starInk } from "./star-ink";

// The activity_types colors seeded by schema.sql.
const ACTIVITY_COLORS = ["#F97316", "#A855F7", "#14B8A6", "#EC4899", "#06B6D4", "#94A3B8"];

const READABLE = 4.5;
const PALETTES: [string, Palette][] = [
  ["default", DEFAULT_PALETTE],
  ["color-blind", COLOR_BLIND_PALETTE],
];

/** Every solid fill a cell can have, so a new ramp cannot ship a star that disappears. */
function everyFill(palette: Palette): string[] {
  const ramp = (from: string, to: string) =>
    Array.from({ length: 21 }, (_, i) => mix(from, to, i / 20));
  return [
    CELL_NO_DATA,
    CELL_FLAT,
    CELL_WARMING_UP,
    CELL_STEPS_FLOOR,
    palette.good,
    palette.bad,
    palette.missed,
    palette.warn,
    palette.accent,
    ...ramp(CELL_FLAT, palette.good), // weight down
    ...ramp(CELL_FLAT, palette.bad), // weight up
    ...ramp(CELL_STEPS_FLOOR, palette.accent), // steps
    mix(CELL_NO_DATA, palette.accent, 0.24), // logged: steps only
    mix(CELL_NO_DATA, palette.accent, 0.62), // logged: weight only
    ...ACTIVITY_COLORS,
  ];
}

describe("starInk", () => {
  for (const [name, palette] of PALETTES) {
    it(`is readable (>= ${READABLE}:1) on every ${name} palette fill`, () => {
      for (const fill of everyFill(palette)) {
        expect(contrastRatio(starInk(fill), fill), fill).toBeGreaterThanOrEqual(READABLE);
      }
    });
  }

  it("picks light ink on dark fills and dark ink on light fills", () => {
    expect(starInk(CELL_NO_DATA)).toBe(STAR_INK_LIGHT);
    expect(starInk(CELL_FLAT)).toBe(STAR_INK_LIGHT);
    expect(starInk(DEFAULT_PALETTE.good)).toBe(STAR_INK_DARK);
    expect(starInk(DEFAULT_PALETTE.warn)).toBe(STAR_INK_DARK);
    expect(starInk("#ffffff")).toBe(STAR_INK_DARK);
    expect(starInk("#000000")).toBe(STAR_INK_LIGHT);
  });

  it("always chooses the higher-contrast ink, across the full gray scale", () => {
    for (let level = 0; level <= 255; level += 5) {
      const hex = "#" + level.toString(16).padStart(2, "0").repeat(3);
      const chosen = contrastRatio(starInk(hex), hex);
      expect(chosen).toBeGreaterThanOrEqual(contrastRatio(STAR_INK_LIGHT, hex) - 1e-9);
      expect(chosen).toBeGreaterThanOrEqual(contrastRatio(STAR_INK_DARK, hex) - 1e-9);
      expect(chosen, hex).toBeGreaterThanOrEqual(READABLE);
    }
  });

  it("reads on both halves of every 'multiple' activity cell", () => {
    for (const a of ACTIVITY_COLORS) {
      for (const b of ACTIVITY_COLORS) {
        const ink = starInk(a, b);
        expect(contrastRatio(ink, a), `${a}/${b}`).toBeGreaterThanOrEqual(READABLE);
        expect(contrastRatio(ink, b), `${a}/${b}`).toBeGreaterThanOrEqual(READABLE);
      }
    }
  });

  it("optimizes the worse half when the two colors straddle the light/dark line", () => {
    // Near-black next to near-white: no single ink reads well on both halves.
    const halves = ["#101010", "#f0f0f0"];
    const worst = (ink: string) => Math.min(...halves.map((h) => contrastRatio(ink, h)));
    const chosen = starInk(...halves);
    const other = chosen === STAR_INK_LIGHT ? STAR_INK_DARK : STAR_INK_LIGHT;
    expect(worst(chosen)).toBeGreaterThanOrEqual(worst(other));
  });
});
