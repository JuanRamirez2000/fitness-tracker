/** The design's own placeholder (frame 2A): not a real chart, just reserving the card frame
 * for whatever gets tracked next (sleep, protein, ...) without a layout redesign. */
export function OpenChartSlot() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-5 py-5 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-3">open chart slot</span>
      <p className="max-w-[220px] text-[11.5px] leading-relaxed text-muted-2">
        Same card frame. Sleep or protein drops in here without a redesign.
      </p>
    </div>
  );
}
