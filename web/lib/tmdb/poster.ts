/**
 * Re-targets a stored TMDB image URL to another size. Saved rows keep the
 * poster size that was current when they were written (older ones are w92),
 * so display code asks for the size its slot needs. URLs without a size
 * segment (for example Spotify images) pass through unchanged.
 */
export function resizePoster(url: string | null | undefined, size: string): string | null {
  if (!url) return null;
  return url.replace(/\/w\d+\//, `/${size}/`);
}
