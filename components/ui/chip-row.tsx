/** Mobile's horizontally-scrollable chip row (frame 2B), the small-screen counterpart to
 * Segmented's boxed pill — used for the range, heatmap metric and weight-mode toggles. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-[5px] overflow-x-auto pb-0.5">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={`shrink-0 whitespace-nowrap rounded-full px-[11px] py-1.5 font-mono text-[10.5px] ${
              on ? "bg-accent text-bg" : "border border-field-border bg-raised text-muted-2"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
