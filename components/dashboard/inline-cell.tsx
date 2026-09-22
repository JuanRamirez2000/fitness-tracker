"use client";

import { useRef, useState, type ReactNode } from "react";
import type { FieldValues } from "react-hook-form";
import type { FieldSpec } from "@/lib/dashboard/table-tab";

const inputClass =
  "w-full rounded-md border border-accent bg-inset px-1.5 py-0.5 text-ink outline-none ring-[3px] ring-accent/13";

/**
 * The first editing pattern: click the formatted value, get a real input in its place,
 * Enter or blur commits, Escape cancels. `onCommit` is expected to update local state
 * optimistically and roll back on failure — this component only owns the edit/display toggle.
 */
export function InlineCell<Values extends FieldValues>({
  value,
  display,
  field,
  onCommit,
}: {
  value: unknown;
  display: ReactNode;
  field: FieldSpec<Values>;
  onCommit: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full rounded-md px-1.5 py-0.5 text-left hover:bg-raised focus:bg-raised focus:outline-none"
      >
        {display}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = ref.current?.value ?? "";
    if (next !== String(value ?? "")) onCommit(next);
  };

  const currentValue = value === null || value === undefined ? "" : String(value);

  if (field.kind === "select") {
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        autoFocus
        defaultValue={currentValue}
        onBlur={commit}
        onChange={(e) => {
          // A select's value only ever changes via a discrete choice, so commit right away
          // rather than waiting for a separate blur — closer to how a native <select> feels.
          setEditing(false);
          if (e.target.value !== currentValue) onCommit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        className={inputClass}
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      autoFocus
      type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"}
      step={field.kind === "number" ? (field.step ?? 1) : undefined}
      defaultValue={currentValue}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      onFocus={(e) => e.currentTarget.select()}
      className={inputClass}
    />
  );
}
