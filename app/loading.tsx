import { APP_NAME } from "@/lib/app";

/** Next's route-level loading state while the page awaits loadDashboardData. A plain skeleton
 * of the real layout (sticky header with tab row, KPI row, a section of cards) rather than a
 * spinner, so the page doesn't jump in structure once data arrives. */
export default function DashboardLoading() {
  return (
    <>
      <header className="border-b border-divider">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 pt-3 pb-2 md:px-8 md:pt-4">
          <span className="font-serif text-[19px] text-muted-3 md:text-[21px]">{APP_NAME}</span>
          <div className="ml-auto h-[30px] w-[30px] animate-pulse rounded-full bg-raised" />
        </div>
        <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-4 md:px-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="my-3 h-5 w-20 animate-pulse rounded bg-raised" />
          ))}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-8 pb-20 md:px-8 md:pt-9">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[130px] animate-pulse rounded-[10px] border border-border bg-card" />
          ))}
        </div>
        <div className="h-[300px] animate-pulse rounded-xl border border-border bg-card" />
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
          <div className="h-[240px] animate-pulse rounded-xl border border-border bg-card lg:col-span-7" />
          <div className="h-[240px] animate-pulse rounded-xl border border-border bg-card lg:col-span-5" />
        </div>
      </main>
    </>
  );
}
