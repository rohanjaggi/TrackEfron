export interface TasteDNA {
  fingerprint: string;
  film_identity: {
    core: string;
    aspect_lens: string;
    patterns: string;
    rating_style: string;
  };
  music_identity: {
    core: string;
    aspect_lens: string;
    patterns: string;
    rating_style: string;
  };
  cross_domain: {
    thread: string;
    surprising_connection: string;
  };
  blind_spots: string[];
  guilty_pleasures: string[];
}

export interface TasteDNARow {
  id: string;
  user_id: string;
  generated_at: string;
  model_version: string;
  fingerprint: string;
  film_profile: TasteDNA["film_identity"];
  music_profile: TasteDNA["music_identity"];
  cross_domain: TasteDNA["cross_domain"];
  blind_spots: string[];
  guilty_pleasures: string[];
  film_log_count: number;
  music_log_count: number;
}

export interface MusicRecommendation {
  artist: string;
  title: string;
  type: "album" | "track";
  explanation: string;
  confidence: "high" | "medium" | "discovery";
  spotify_id?: string;
  image_url?: string | null;
  album_name?: string;
}

export interface FilmRecommendation {
  tmdb_id: number;
  title: string;
  media_type: "movie" | "tv";
  poster_url?: string | null;
  explanation: string;
  source: "ml" | "ai";
  year?: number;
}

export interface VibeSearchResult {
  title: string;
  artist?: string;
  year?: number;
  type: "album" | "track" | "movie" | "tv";
  why: string;
  spotify_id?: string;
  tmdb_id?: number;
  image_url?: string | null;
  poster_url?: string | null;
}

export interface VibeSearchResponse {
  interpretation: string;
  results: VibeSearchResult[];
}
