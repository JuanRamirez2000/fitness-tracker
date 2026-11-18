import Link from "next/link";
import { SPORT_STYLE, type ActiveSport } from "@/lib/sport";
import { quickLook, type QuickLookCard, type QuickLookTarget } from "@/lib/dashboard/quick-look";
import type { DashboardData, TabKey } from "@/lib/dashboard/types";
import { toneColor } from "@/lib/kpis/tone-color";

/** Static class names per sport, so Tailwind sees each in full. */
const GLYPH_TONE: Record<ActiveSport, string> = { ride: "text-sport-ride", run: "text-sport-run", swim: "text-sport-swim" };

/** Each target's place: a section of the Training tab (its id), or the Weight tab. */
function hrefFor(target: QuickLookTarget, tab: TabKey): string {
  if (target === "weight") return "/?tab=weight";
  return tab === "training" ? `#${target}` : `/?tab=training#${target}`;
}

function Card({ card, tab }: { card: QuickLookCard; tab: TabKey }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2">
        {card.sport && (
          <span className={`${GLYPH_TONE[card.sport]} shrink-0`} title={SPORT_STYLE[card.sport].label}>
            {SPORT_STYLE[card.sport].glyph}
          </span>
        )}
        <span className="truncate">{card.label}</span>
      </span>
      <span className="truncate font-mono text-[18px] leading-tight text-ink">{card.value}</span>
      <span className="truncate font-mono text-[10px]" style={{ color: toneColor(card.tone) }}>
        {card.sub}
      </span>
    </>
  );
  const frame = `flex snap-start flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5 ${card.wide ? "w-[240px] lg:col-span-2 lg:w-auto" : "w-[150px] lg:w-auto"} shrink-0 min-w-0`;
  if (!card.target) return <div className={frame}>{body}</div>;
  const href = hrefFor(card.target, tab);
  return href.startsWith("#") ? (
    <a href={href} className={`${frame} hover:border-border-strong`}>
      {body}
    </a>
  ) : (
    <Link href={href} className={`${frame} hover:border-border-strong`}>
      {body}
    </Link>
  );
}

/**
 * The quick-look strip at the top of every tab: small cards for today's readiness, the next
 * session, each plan, the week, load, weight, sleep and the race. A row that scrolls sideways
 * and snaps card by card on a phone; a wrapped grid from a laptop up. Each card links to the
 * section behind it.
 */
export function QuickLook({ data }: { data: DashboardData }) {
  const cards = quickLook(data);
  if (!cards.length) return null;
  return (
    <nav aria-label="Quick look" className="-mx-4 md:mx-0">
      <div className="flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 md:px-0 lg:grid lg:grid-cols-6 lg:overflow-visible">
        {cards.map((c) => (
          <Card key={c.key} card={c} tab={data.tab} />
        ))}
      </div>
    </nav>
  );
}
