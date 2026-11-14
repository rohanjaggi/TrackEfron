export function eraLimits(years: number[]): {
  topDecades: number[];
  olderBefore: number | null;
  maxOlder: number;
} {
  const counts = new Map<number, number>();
  for (const y of years) {
    const decade = Math.floor(y / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  const topDecades = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .slice(0, 2)
    .map(([decade]) => decade);
  const olderBefore = topDecades.length ? Math.min(...topDecades) : null;
  return { topDecades, olderBefore, maxOlder: 5 };
}
