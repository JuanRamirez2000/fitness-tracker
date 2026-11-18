import { TAB_KEYS, TAB_LABELS, type TabKey } from "@/lib/dashboard/types";
import { APP_NAME } from "@/lib/app";
import { CardGrid, Cell, Section, SectionHeading, type Span } from "./layout";

/**
 * Placeholders shaped like the real page, shown while a tab's rows load (app/page.tsx's
 * Suspense, app/loading.tsx) and while the Refresh button rewrites a summary. Section headings
 * are the real text, so only the cards pulse and nothing jumps when the content lands.
 * No hooks: usable from server and client components alike.
 */

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-raised ${className}`} />;
}

/** One card's outline at the height the real card renders on a desktop. */
function CardBone({ span, height }: { span: Span; height: number }) {
  return (
    <Cell span={span}>
      <div className="animate-pulse rounded-xl border border-border bg-card" style={{ height }} />
    </Cell>
  );
}

/** The AI summary's label line and two and a half lines of text. */
export function SummarySkeleton({ label }: { label?: string }) {
  return (
    <div className="flex max-w-[860px] flex-col gap-2" aria-busy="true">
      {label ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">{label}</span>
      ) : (
        <Bone className="h-[13px] w-48" />
      )}
      <div className="flex flex-col gap-3 py-1">
        <Bone className="h-[18px] w-full" />
        <Bone className="h-[18px] w-[94%]" />
        <Bone className="h-[18px] w-[58%]" />
      </div>
    </div>
  );
}

/** The KPI row: six units on a desktop, three on a tablet, two on a phone. `spans` mirrors the
 * tab's cards in dashboard.config.ts (TAB_KPIS, a wide card's span 2). */
function KpiRowSkeleton({ spans, height }: { spans: readonly (1 | 2)[]; height: number }) {
  return (
    <div className="grid grid-flow-dense grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {spans.map((span, i) => (
        <div
          key={i}
          className={`animate-pulse rounded-[10px] border border-border bg-card ${span === 2 ? "col-span-2" : ""}`}
          style={{ height }}
        />
      ))}
    </div>
  );
}

/** The quick-look strip: a row of small cards. */
function QuickLookSkeleton() {
  return (
    <div className="-mx-4 flex gap-2.5 overflow-hidden px-4 md:mx-0 md:px-0 lg:grid lg:grid-cols-6">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`h-[74px] shrink-0 animate-pulse rounded-lg border border-border bg-card ${i === 2 ? "w-[240px] lg:col-span-2 lg:w-auto" : "w-[150px] lg:w-auto"}`} />
      ))}
    </div>
  );
}

function WeightSkeleton() {
  return (
    <>
      <QuickLookSkeleton />
      <SummarySkeleton />
      <KpiRowSkeleton spans={[1, 1, 1, 1, 1, 1]} height={135} />
      <Section>
        <SectionHeading n="01">Am I losing fat, not muscle?</SectionHeading>
        <CardGrid>
          <CardBone span={12} height={383} />
          <CardBone span={6} height={414} />
          <CardBone span={6} height={414} />
        </CardGrid>
      </Section>
    </>
  );
}

function TrainingSkeleton() {
  return (
    <>
      <QuickLookSkeleton />
      <Section>
        <SectionHeading n="01">How&apos;s my week going?</SectionHeading>
        <SummarySkeleton />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[135px] animate-pulse rounded-[10px] border border-border bg-card" />
          ))}
        </div>
        <CardGrid>
          <CardBone span={12} height={330} />
        </CardGrid>
      </Section>
    </>
  );
}

/** The active tab's body while its rows load. Only the top of the page: below the fold
 * nothing shows before the content does. */
export function TabSkeleton({ tab }: { tab: TabKey }) {
  return tab === "weight" ? <WeightSkeleton /> : <TrainingSkeleton />;
}

/** The sticky header before the profile is in: the brand and the real tab row, with the
 * range control and the owner's buttons pulsing. */
export function HeaderSkeleton({ tab }: { tab: TabKey }) {
  return (
    <header className="sticky top-0 z-20 border-b border-divider bg-bg">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center xl:max-w-[1460px] gap-x-3 gap-y-2.5 px-4 pt-3 pb-2 md:px-8 md:pt-4">
        <span className="font-serif text-[19px] md:text-[21px]">{APP_NAME}</span>
        <div className="order-last h-[34px] w-full animate-pulse rounded-lg bg-raised lg:order-none lg:ml-auto lg:w-[420px]" />
        <div className="ml-auto h-[30px] w-[120px] animate-pulse rounded-lg bg-raised lg:ml-3" />
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-8 xl:max-w-[1460px]">
        <nav aria-label="Dashboard sections" className="-mb-px flex gap-[clamp(18px,4vw,36px)] overflow-x-auto">
          {TAB_KEYS.map((key) => (
            <span
              key={key}
              className={`flex min-h-11 shrink-0 items-center border-b-2 pt-1 font-serif text-[18px] whitespace-nowrap ${
                key === tab ? "border-accent text-ink" : "border-transparent text-muted-2"
              }`}
            >
              {TAB_LABELS[key]}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
