/**
 * Make user text safe to put inside a PostgREST `.or(...)` / `.ilike(...)` filter value.
 * `,` `(` `)` are filter syntax and `*` is PostgREST's own `%` wildcard, so they are dropped; `%` `_` `\` are LIKE wildcards or
 * the escape character, so they are escaped and match literally.
 */
export function escapeIlike(q: string): string {
  return q.replace(/[,()*]/g, "").replace(/[\\%_]/g, "\\$&");
}
