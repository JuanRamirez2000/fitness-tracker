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


/** Every tab's shape while its rows load: the week-so-far tiles, the swipeable section, the
 * first cards of the rest. */
function TabShapeSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <div className="h-3 w-48 animate-pulse rounded bg-card" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      </div>
      <div className="h-[360px] animate-pulse rounded-xl border border-border bg-card" />
      <Section>
        <SectionHeading n="01">{" "}</SectionHeading>
        <CardGrid>
          <CardBone span={6} height={300} />
          <CardBone span={6} height={300} />
        </CardGrid>
      </Section>
    </>
  );
}

/** The active tab's body while its rows load. Only the top of the page: below the fold
 * nothing shows before the content does. */
export function TabSkeleton({ tab }: { tab: TabKey }) {
  void tab;
  return <TabShapeSkeleton />;
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
