/** Lowercase and drop spaces, dashes and underscores, so "RTX 5070" matches "rtx-5070". */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[\s\-_]+/g, "");
}

/** Sorts 2 before 10, unlike plain text sorting. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Every word must match some field. Fields must already be normalised. */
export function matchesAllWords(query: string, fields: string[]): boolean {
  const words = query.trim().split(/\s+/).map(normalise).filter(Boolean);
  return words.every((word) => fields.some((field) => field.includes(word)));
}
