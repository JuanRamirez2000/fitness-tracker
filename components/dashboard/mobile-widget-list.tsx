import { orderForMobile, type WidgetLayoutItem } from "@/lib/dashboard/widget-layout";
import { KpiCard, type ResolvedWidget } from "./kpi-card";

/** Mobile's simplified, read-only rendering (frame 2B's spirit, generalized): every widget
 * the user hasn't hidden, in the order they last arranged it on desktop — no drag/resize here,
 * touch editing is out of scope (see the plan), so this just respects show/hide + order. */
export function MobileWidgetList({ items, layout }: { items: ResolvedWidget[]; layout: WidgetLayoutItem[] }) {
  const ordered = orderForMobile(layout);
  const byId = new Map(items.map((item) => [item.id, item] as const));

  return (
    <div className="grid grid-cols-2 gap-2.5 md:hidden">
      {ordered.map((position) => {
        const widget = byId.get(position.i);
        if (!widget) return null;
        return <KpiCard key={widget.id} widget={widget} footprint={{ w: 1, h: 1 }} />;
      })}
    </div>
  );
}
