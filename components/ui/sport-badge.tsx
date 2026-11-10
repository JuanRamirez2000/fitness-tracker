import { SPORT_STYLE } from "@/lib/sport";

/** Static class names per sport, so Tailwind sees each one in full. */
const TONE: Record<keyof typeof SPORT_STYLE, string> = {
  ride: "border-sport-ride/45 bg-sport-ride/10 text-sport-ride",
  run: "border-sport-run/45 bg-sport-run/10 text-sport-run",
};

/** A colored pill naming an activity's sport: glyph, word and hue, so it reads without color too. */
export function SportBadge({ sport, className = "" }: { sport: keyof typeof SPORT_STYLE; className?: string }) {
  const s = SPORT_STYLE[sport];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[1px] font-mono text-[10px] ${TONE[sport]} ${className}`}>
      <span aria-hidden>{s.glyph}</span>
      {s.label}
    </span>
  );
}
