import type { WeekTile } from "@/lib/dashboard/week-so-far";
import { fmtDate } from "@/lib/dates/format";
import { toneColor } from "@/lib/kpis/tone-color";
import type { ProgressWeek } from "@/lib/progress/week";
import { SPORT_STYLE, type ActiveSport } from "@/lib/sport";

/** Static class names per sport, so Tailwind sees each in full. */
const GLYPH_TONE: Record<ActiveSport, string> = { ride: "text-sport-ride", run: "text-sport-run", swim: "text-sport-swim" };

function Tile({ tile }: { tile: WeekTile }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="flex items-center gap-1.5 truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">
        {tile.sport && (
          <span className={`${GLYPH_TONE[tile.sport]} shrink-0`} title={SPORT_STYLE[tile.sport].label}>
            {SPORT_STYLE[tile.sport].glyph}
          </span>
        )}
        <span className="truncate">{tile.label}</span>
      </span>
      <span className="truncate font-mono text-[19px] leading-tight text-ink">{tile.value}</span>
      <span className="truncate font-mono text-[10px]" style={{ color: toneColor(tile.tone) }}>
        {tile.sub}
      </span>
    </div>
  );
}

/**
 * The top of every tab: the picked week so far (the header's week picker), as a row of small
 * tiles about that tab. Two across on a phone, three on a tablet, one row on a laptop.
 */
export function WeekSoFar({ week, tiles }: { week: ProgressWeek; tiles: WeekTile[] }) {
  const label = week.current ? "This week so far" : `Week of ${fmtDate(week.monday)}`;
  return (
    <section id="week-so-far" aria-label={label} className="flex scroll-mt-28 flex-col gap-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
        {label} · {fmtDate(week.monday)} – {fmtDate(week.sunday)}
      </span>
      {tiles.length > 0 ? (
        <div className={`grid grid-cols-2 gap-2.5 md:grid-cols-3 ${tiles.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          {tiles.map((t) => (
            <Tile key={t.key} tile={t} />
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-2">Nothing recorded this week yet.</p>
      )}
    </section>
  );
}
