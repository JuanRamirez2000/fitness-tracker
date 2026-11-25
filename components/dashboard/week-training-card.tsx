import { ChartCard } from "@/components/charts/chart-card";
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
 * Home's "This week's training": the picked week (the header's week picker) as a few small
 * tiles: time against the aim, sessions done, load, and the next session.
 */
export function WeekTrainingCard({ week, tiles }: { week: ProgressWeek; tiles: WeekTile[] }) {
  return (
    <ChartCard title={week.current ? "This week's training" : "That week's training"} subtitle={`${fmtDate(week.monday)} – ${fmtDate(week.sunday)}`}>
      {tiles.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((t) => (
            <Tile key={t.key} tile={t} />
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-2">Nothing recorded this week yet.</p>
      )}
    </ChartCard>
  );
}
