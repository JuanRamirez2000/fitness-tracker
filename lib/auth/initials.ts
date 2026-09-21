/** Up to two uppercase initials from a display name, for the avatar. */
export function initialsOf(displayName: string): string {
  const letters = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase());
  return letters.join("") || "?";
}
