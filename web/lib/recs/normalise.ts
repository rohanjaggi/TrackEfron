export function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when either normalised string contains the other (both non-empty). */
export function overlaps(a: string, b: string): boolean {
  const x = normalise(a);
  const y = normalise(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}
