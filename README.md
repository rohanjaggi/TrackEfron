# TrackEfron

A personal movie and TV show tracking app. Log what you watch, rate it across multiple categories, build your library, and discover new titles.

## Features

- **Log Watches** — Search for any movie or TV show, rate it (with half-star precision), write a review, and score across 6 categories (plot, cinematography, acting, soundtrack, pacing, casting)
- **Library** — Browse everything you've watched in grid or list view, with filtering and search
- **Watchlist** — Save titles you want to watch next, add from search or discover
- **Discover** — Search the full TMDB catalogue and see what's trending today
- **Detail Pages** — Full movie/TV info with cast, genres, overview, and your personal review
- **Profile** — Upload a profile picture, view your stats, and see a colour-themed backdrop extracted from your avatar
- **Analytics** — Insights into your watching habits and taste profile (coming soon)

## Tech Stack

- **Frontend:** [Next.js](https://nextjs.org) (App Router), React 19, TypeScript, Tailwind CSS
- **Backend/Auth/Database:** [Supabase](https://supabase.com) (PostgreSQL, Auth, Storage)
- **UI Components:** [Radix UI](https://radix-ui.com), [shadcn/ui](https://ui.shadcn.com), [Lucide Icons](https://lucide.dev)
- **Movie Data:** [TMDB API](https://www.themoviedb.org/documentation/api)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [TMDB API](https://developer.themoviedb.org/docs/getting-started) key

### Setup

1. Clone the repo and install dependencies:

   ```bash
   cd web
   npm install
   ```

2. Create a `.env.local` file in the `web/` directory:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   TMDB_API_KEY=your_tmdb_api_key
   TMDB_BEARER_TOKEN=your_tmdb_bearer_token
   ```

3. Set up the Supabase database tables (`watch_logs`, `watchlist`) and storage bucket (`avatars`) with the appropriate RLS policies.

4. Run the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## TMDB Attribution

<img src="web/public/images/tmdb.svg" alt="TMDB Logo" width="120" />

This product uses the TMDB API but is not endorsed or certified by TMDB.

All movie and TV show data, including titles, overviews, posters, backdrops, cast information, ratings, and genre classifications, is provided by [The Movie Database (TMDB)](https://www.themoviedb.org). TMDB is a community-built movie and TV database.

In accordance with the [TMDB Terms of Use](https://www.themoviedb.org/terms-of-use):
- All movie/TV metadata and images are sourced from TMDB
- TMDB logo attribution is displayed in the application footer
- This application does not claim ownership of any TMDB data

## License

This project is for personal/educational use.
