/**
 * The index of the value in `xs` (ascending; nulls allowed) nearest to `x`, or null when there
 * is none. Binary search, so a hover over a few hundred points stays cheap on every pointer move.
 */
export function nearestIndex(xs: readonly (number | null)[], x: number): number | null {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo <= hi && xs[lo] === null) lo++;
  while (hi >= lo && xs[hi] === null) hi--;
  if (lo > hi) return null;
  // Narrow to the two defined neighbours around x.
  let a = lo;
  let b = hi;
  while (b - a > 1) {
    let mid = (a + b) >> 1;
    // Step off nulls toward a, so the search stays on defined values.
    while (mid > a && xs[mid] === null) mid--;
    if (mid === a) {
      mid = (a + b) >> 1;
      while (mid < b && xs[mid] === null) mid++;
      if (mid === b) break;
    }
    if ((xs[mid] as number) <= x) a = mid;
    else b = mid;
  }
  return Math.abs((xs[a] as number) - x) <= Math.abs((xs[b] as number) - x) ? a : b;
}
