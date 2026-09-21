import type { InputHTMLAttributes, ReactNode } from "react";

/** Mono micro-label used above every form control (frame 2D). */
export const labelClass = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-2";

export const inputClass =
  "w-full rounded-[9px] border border-field-border bg-inset px-[13px] py-[11px] text-[13.5px] " +
  "text-ink outline-none placeholder:text-muted-3 focus:border-accent focus:ring-[3px] focus:ring-accent/13";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}
