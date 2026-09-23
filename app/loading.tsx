/** Next's route-level loading state: swapped in automatically while the dashboard page's
 * Server Component awaits loadDashboardData, replaced the instant it resolves. A plain
 * skeleton of the real layout (header, KPI grid, heatmap, charts, table) rather than a
 * spinner, so the page doesn't visibly jump in structure once data arrives. */
export default function DashboardLoading() {
  return (
    <>
      <header className="flex items-center gap-3 border-b border-divider px-5 py-3 md:px-10 md:py-5">
        <span className="font-serif text-[19px] text-muted-3 md:text-[21px]">Tracker</span>
        <div className="ml-auto h-[30px] w-[30px] animate-pulse rounded-full bg-raised" />
      </header>
      <main className="flex flex-1 flex-col gap-6 px-5 pt-6 pb-24 md:px-10 md:py-7">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[130px] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-[260px] animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-[320px] animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-[220px] animate-pulse rounded-xl border border-border bg-card" />
      </main>
    </>
  );
}
