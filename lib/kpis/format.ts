/** A signed number with a real minus sign, one decimal: 1 -> "+1.0", -0.4 -> "−0.4". */
export function signed(n: number, digits = 1): string {
  return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(digits);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
