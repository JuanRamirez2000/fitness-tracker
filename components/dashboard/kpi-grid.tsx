import { WIDGETS } from "@/dashboard.config";
import type { DashboardData } from "@/lib/dashboard/types";
import { defaultDashboardLayout } from "@/lib/dashboard/widget-layout";
import type { ResolvedWidget } from "./kpi-card";
import { MobileWidgetList } from "./mobile-widget-list";
import { WidgetGrid, type WidgetEntry } from "./widget-grid";

/** Adding a critical number is one new file plus one line in dashboard.config.ts — this
 * component never changes. It resolves the saved (or default) bento-grid arrangement, and
 * runs every widget's compute()/format() here, server-side, since WidgetGrid is a "use
 * client" boundary that cannot receive a KpiDefinition's functions as props (see
 * ResolvedWidget's own comment in kpi-card.tsx). Both WidgetGrid (desktop, editable) and
 * MobileWidgetList (mobile, read-only) get the same plain-data ResolvedWidget[]. */
export function KpiGrid({ data }: { data: DashboardData }) {
  const items: WidgetEntry[] = WIDGETS.map((widget) => {
    const value = widget.kpi.compute(data);
    const resolved: ResolvedWidget = {
      id: widget.kpi.id,
      label: widget.kpi.label,
      visual: widget.kpi.visual,
      emptyMessage: widget.kpi.emptyMessage,
      value,
      formatted: value ? widget.kpi.format(value) : null,
    };
    return { widget: resolved, defaultFootprint: widget.defaultFootprint };
  });
  const layout = data.profile.dashboard_layout ?? defaultDashboardLayout(WIDGETS.map((w) => ({ id: w.kpi.id, defaultFootprint: w.defaultFootprint })));

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2 md:hidden">Critical numbers</span>
      <WidgetGrid items={items} athleteId={data.profile.id} initialLayout={layout} />
      <MobileWidgetList items={items.map((item) => item.widget)} layout={layout} />
    </div>
  );
}
