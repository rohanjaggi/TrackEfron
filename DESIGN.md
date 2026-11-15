# TrackEfron design system

Ink-black, sharp-edged, hairline-ruled, lettered like the 1970s. A personal diary of films, TV and music.
Two worlds share one skeleton and differ in detail:

- **Film mode** is a cinema programme: a soft poster serif, printer's double rules, registration ticks, stamped marks, smooth ink wipes. Accent: film gold.
- **Music mode** is a record sleeve and hi-fi faceplate: a condensed gothic, bevelled panels, meter-scale rules, stepped switches, LED marks. Accent: teal.

The mode is `data-mode="film|music"` on `<html>`. Components never branch on mode for styling: they use tokens and classes, and the CSS swaps the character. Branch on mode only for content (copy, icons, aspect ratio).

Live catalogue: run the app and open `/dev/kit` (development only). Source of truth: `web/app/globals.css`, `web/tailwind.config.ts`, `web/components/ui/*`.

## Film and music stay apart

- Film mode shows films and TV only (`watch_logs`, `watchlist`, TMDB, posters 2:3, "watch", "watchlist"). Music mode shows albums and tracks only (`listen_logs`, `music_queue`, Spotify, square covers, "listen", "queue"). No screen mixes the two in one list, count or sentence.
- Each mode fetches only its own tables, and only the signed-in user's rows (`.eq("user_id", user.id)`).
- A page about one item follows the item: it calls `useSyncMode(domain)` so the app moves to that item's mode (media detail, a list, a log being edited).
- The two legitimately cross-domain surfaces are a friend's profile and the taste profile. They show Film & TV and Music as separate labelled sections; wrap each in `mode-film` / `mode-music` so it wears its own colours.
- Film and TV ids are different namespaces: match and key on (`media_type`, `tmdb_id`), never `tmdb_id` alone.
- On a mode switch, clear search text, open result panels and mode-specific filters, and ignore responses still in flight from the old mode.

## Non-negotiables

1. **Nothing is rounded.** Every Tailwind radius resolves to 0. Do not write `rounded-*` or `border-radius`.
2. **1px hairlines.** `border` is the default weight. Never `border-2` or `border-4`. Emphasis comes from colour (`border-border-strong`, `border-primary`), not thickness.
3. **Use the primitives.** If a primitive exists for it, use it. Do not hand-roll buttons, tabs, cards, inputs, loaders, empty states, stars or page titles.
4. **No inline colour or type styles.** No `style={{ color, background, border, fontSize, fontWeight }}`. Use classes. `style` is only for genuinely dynamic values (a width from data, a chart colour).
5. **No JS hover styling.** No `onMouseEnter`/`onMouseLeave` that mutates `style`. Use `hover:` and `focus-visible:` classes.
6. **No eyebrow above a page title.** The title carries itself.
7. **One solid accent button per view.** Everything else is `outline` or `ghost`.
8. **No off-palette colour.** No `red-500`, `green-500`, `yellow-500`, raw hex, or `rgba()` literals. Third-party brand marks (Spotify green on a "Connect Spotify" button) are the one exception.
9. **`secondary` is a surface, not an ink.** Never `text-secondary`.
10. **No `transition-all`, no `animate-spin`, no `animate-pulse`, no `Loader2`.** See Motion and Loading.
11. **Everything clickable is a link or a button**, reachable by keyboard, with a name. No `<div onClick>`.

## Colour

| Role | Class | Notes |
|---|---|---|
| Page | `bg-background` | 4% |
| Frame | `.frame` / `bg-surface` | 8% |
| Well, hovered frame | `bg-surface-2` | 12% |
| Popover, menu | `bg-surface-3` / `bg-popover` | 16% |
| Hairline | `border-border` | default |
| Strong rule | `border-border-strong` | hover, input edge, emphasis |
| Text | `text-foreground` | 15:1 |
| Secondary text | `text-muted-foreground` | AA on every surface. Body copy, labels, metadata |
| Decoration only | `text-dim` | placeholders, disabled, icons in empty artwork. Never sentences |
| Accent | `text-primary` `bg-primary` `border-primary` | follows the mode; supports `/opacity` |
| Fixed mode colours | `text-film` `text-music` | only when showing both modes side by side |
| Status | `text-success` `text-warning` `text-danger` | each also `bg-*/10`, `border-*/50` |
| Charts | `var(--chart-1)` … `var(--chart-5)` | pass as strings to Recharts; they change with mode |

Chart chrome: grid lines `var(--border-raw)`, axis text `var(--text-muted)`, tooltip on `var(--surface-3)` with a `var(--border-strong)` hairline and no radius.

## Type

Set like the 1970s: a soft poster serif for film, a condensed sleeve gothic for music, one wide grotesque for everything you read and press. No monospace. Sentence case everywhere.

| Face | Where | Notes |
|---|---|---|
| Young Serif | Film titles, figures and the wordmark | One weight only. Never add `font-medium`/`font-semibold`/`font-bold` to a title role: it would be faked. No italic either; emphasis is the accent colour. |
| Sofia Sans Extra Condensed | Music titles and figures | 600–800, with italics. Runs about 1.5× larger than the film face because condensed type needs the height; the role classes handle this. |
| Archivo, semi-expanded | Interface, both modes: body, labels, buttons, nav, tabs, badges, reviews | Set at 112% width (`--ui-stretch`, applied on `body`), like hi-fi faceplate lettering. 400 body, 500 labels and nav, 600 buttons. Italic for quoted reviews. Never narrow it back with `font-stretch` on a component. |

The wordmark (`.wordmark`) is fixed in Young Serif in both modes. A logo does not change voice with the mode.

Title roles read their face, weight and scale from per-mode variables, so the same class changes voice with the mode:

| Use | Class |
|---|---|
| Page title, once per page | `.t-display` (inside `PageHeader`). `<strong>` for a name, `<em>` for the accent clause |
| Section title | `.t-title` (inside `SectionHeader`) |
| Card or row title | `.t-card` (poster serif in film; interface face in music, so long album and track names stay readable) |
| A line in the product's voice: empty states, error pages, the taste line | `.t-voice`, `.t-voice-lg` |
| Big figures | `.t-numeral` with `.t-numeral-lg` or `.t-numeral-md`, or `StatBlock` |
| Reviews, long reading | `.t-prose` |
| Field labels, column heads, stat labels | `.t-label` |
| Secondary line | `.t-meta` |
| The logo lettering | `.wordmark` |

Rules:
- Sentence case for every label, button, tab, badge and nav item. No `uppercase`, no letterspacing (`tracking-*`). The single exception is the confirmation stamp on toasts (`.stamp-mark`), which is in capitals like a ticket stamp.
- Body is 14px. Small text is 12–13px; the floor is 11.5px (badges, counts). Do not invent sizes.
- Do not size title roles with fixed pixel classes; use the role classes so they scale with the mode.
- Secondary information is distinguished by colour (`text-muted-foreground`) and, for quotations, italic. Not by capitals.

## Primitives (`web/components/ui/`)

| Need | Use |
|---|---|
| Page title + actions | `PageHeader` from `ui/page` |
| Section title over a rule | `SectionHeader` |
| A figure with a label | `StatBlock` (bare numeral, never boxed) |
| Label ……… value | `LeaderRow` |
| Nothing here yet | `EmptyState` |
| Inline error/success/warning | `Notice` (`tone="error"` is `role="alert"`) |
| Label + control + hint/error | `Field` |
| User picture | `Avatar` (square) |
| Any button or button-looking link | `Button` (`asChild` to wrap a `Link`) |
| Container | `Card` or `className="frame"`; add `frame-accent` for the accent top line, `frame-interactive` if clickable, `frame-raised ticks` for the one feature object on a page |
| Text entry | `Input`, `Textarea`, `Select` from `ui/input` (never a bare `<select>`) |
| Filter / view / type choice | `SegmentedControl` |
| Switching sections of a page | `TabBar` |
| Tag | `Badge` |
| Poster or cover in a grid | `MediaCard` inside `MediaGrid` (posters `aspect="poster"`, albums and tracks `aspect="square"`) |
| Rating display / entry | `Stars` / `StarInput` from `ui/stars` (never ★ glyphs) |
| Delete or remove | `ConfirmButton` (two-press confirm; the only destructive pattern) |
| Feedback after an action | `useToast()` from `ui/toast`: `toast({ mark: "Logged", title: "Dune added to your library" })`; errors use `tone: "error"` |
| Loading | `Skeleton`, `MediaGridSkeleton`, `RowListSkeleton`, `LoadingLine`, `PageLoading` from `ui/loading` |
| Menus | `DropdownMenu*` |

Rows in a list use `className="row-item"` (hairline below, surface on hover).

## Layout

- Pages render inside a 1200px column with the shell's padding. Do not add another max-width wrapper or page padding.
- Vertical rhythm: sections are separated by `gap-16` (or `mt-16`); inside a section use 5–6 units. More space above a heading than below it.
- Frames are for objects (a card, a panel, a form). Do not wrap whole sections in frames, and never nest a frame in a frame; use `.well` or a hairline inside.
- Not everything is a card. Prefer a ruled list (`row-item`) or bare figures over a grid of identical boxes.
- Must hold at 390px wide with no horizontal scroll: toolbars wrap, grids collapse, tables scroll inside their own container.

## Motion: the projection booth

Cuts and wipes, never floats or bounces. Animate only `transform`, `opacity`, `clip-path` and colour.

| Moment | How |
|---|---|
| Colour/border state change | `transition-colors duration-cut ease-mech` (or `transition-[…]` naming the properties) |
| Press | built into `Button` |
| Route change | automatic (`app/protected/template.tsx`) |
| Film ↔ music | automatic (accent cross-fade, bar sweep, cue mark) |
| Grid or list arriving | `className="advance"` on the parent (`MediaGrid` has it) |
| Disclosure panel, search results, popover | `className="drawer-in"` on the panel when it mounts |
| Selected tab / segment | built into `SegmentedControl` and `TabBar` |
| Poster hover | built into `MediaCard` |
| Figure appearing | built into `StatBlock` (`.counter-in`) |
| Saved, logged, rated, removed | a toast with a `mark` |

Durations: `duration-tick` 80ms, `duration-cut` 140ms, `duration-move` 240ms, `duration-reel` 420ms. Easings: `ease-mech`, `ease-reel`. No other durations. No hover lift (`-translate-y`), no hover scale, no icon rotation. Reduced motion is handled globally; do not add per-component checks.

## Loading, empty, error

- Loading is a skeleton shaped like the content, or `LoadingLine` with a label that says what is loading ("Searching", "Loading your library"). Never a spinner.
- Every list has an `EmptyState` with a line in the product's voice and one action.
- Every failed request tells the user: a `Notice tone="error"` in place, or an error toast. Say what failed and what to do next, in plain words. Never show a raw error object or code.
- Supabase calls return `{ error }` rather than throwing: check it.

## Accessibility

- Icon-only buttons need `aria-label`. Decorative icons get `aria-hidden="true"`.
- Controls shown on hover must also show on focus (`group-focus-within:`) and on touch.
- Form controls have a real `<label htmlFor>` (use `Field`).
- Images that repeat a visible title use `alt=""`.
- One `<h1>` per page (from `PageHeader`); sections are `<h2>`.

## Voice

Plain, warm, a little dry. Controls say what they do ("Log a watch", "Remove from queue"). Film mode says watch, watchlist, film; music mode says listen, queue, album. No jargon in the interface ("ML", "embeddings", "collaborative filtering").
