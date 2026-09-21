import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-accent font-medium text-bg",
  secondary: "border border-field-border text-muted-1",
} as const;

// md matches the dialog buttons (frame 2D); lg matches the quick-log Save (frame 2C).
const SIZES = {
  md: "rounded-lg px-4 py-2 text-[12.5px]",
  lg: "h-12 rounded-[11px] px-5 text-[15px]",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${VARIANTS[variant]} ${SIZES[size]} transition-opacity disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
