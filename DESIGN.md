# TrackEfron design system

Ink-black, sharp-edged, hairline-ruled. A personal diary of films, TV and music.
Two worlds share one skeleton and differ in detail:

- **Film mode** is a cinema programme: printer's double rules, registration ticks, stamped marks, smooth ink wipes. Accent: film gold.
- **Music mode** is a hi-fi faceplate: bevelled panels, meter-scale rules, stepped switches, LED marks. Accent: teal.

The mode is `data-mode="film|music"` on `<html>`. Components never branch on mode for styling: they use tokens and classes, and the CSS swaps the character. Branch on mode only for content (copy, icons, aspect ratio).

Live catalogue: run the app and open `/dev/kit` (development only). Source of truth: `web/app/globals.css`, `web/tailwind.config.ts`, `web/components/ui/*`.

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

Cormorant Garamond (display) and Azeret Mono (interface). Body is 13px mono.

| Use | Class |
|---|---|
| Page title, once per page | `.t-display` (inside `PageHeader`). `<strong>` for a name, `<em>` for the italic accent clause |
| Section title | `.t-title` (inside `SectionHeader`) |
| Card or row title | `.t-card` |
| Reviews, long reading | `.t-prose` |
| Big figures | `.t-numeral` + a size, or `StatBlock` |
| Field labels, column heads, metadata keys | `.label-upper` |
| Secondary line | `.t-meta` |

Minimum text size is 11px (`.label-upper`); badges may use 10px caps. Do not invent sizes: no `text-[9px]`, no `text-xs`/`text-sm`/`text-base`/`text-lg` grab-bag. Body copy is the inherited 13px or `text-[12px]`.

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
