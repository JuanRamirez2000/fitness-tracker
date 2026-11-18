import type { Insight, InsightTone } from "@/lib/insights/types";

const GLYPH: Record<InsightTone, string> = { good: "●", watch: "◐", act: "○" };
const TONE_TEXT: Record<InsightTone, string> = { good: "text-good", watch: "text-warn", act: "text-bad" };
const TONE_WORD: Record<InsightTone, string> = { good: "on track", watch: "keep an eye on it", act: "worth changing" };

/** One insight: topic, the state as a headline, what it means, one thing to do, and the numbers
 * folded underneath. The glyph and word carry the tone; color is secondary. */
export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <article className="flex h-full flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-4 md:px-[22px] md:py-5">
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
        <span>{insight.topic}</span>
        <span className="normal-case tracking-normal">
          <span className={TONE_TEXT[insight.tone]} aria-hidden>
            {GLYPH[insight.tone]}
          </span>{" "}
          {TONE_WORD[insight.tone]}
        </span>
      </div>
      <h3 className="font-serif text-[19px] leading-[1.25] font-normal text-pretty">{insight.headline}</h3>
      <p className="text-[13px] leading-[1.55] text-muted-1 text-pretty">{insight.effect}</p>
      <p className="flex gap-2 text-[13px] leading-[1.55] text-ink text-pretty">
        <span className="font-mono text-[10px] leading-[21px] uppercase tracking-[0.1em] text-accent">Do</span>
        <span>{insight.lever}</span>
      </p>
      {insight.numbers.length > 0 && (
        <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-divider pt-2.5 font-mono text-[11px]">
          {insight.numbers.map((n) => (
            <div key={n.label} className="contents">
              <dt className="text-muted-2">{n.label}</dt>
              <dd className="text-right text-muted-1">{n.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
