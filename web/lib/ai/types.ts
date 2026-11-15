export interface TasteObservation {
  text: string;
  cited_title: string;
}

interface TasteIdentity {
  core: string;
  aspect_lens: string;
}

export interface TasteDNA {
  fingerprint: string;
  pulse: string[];
  observations: TasteObservation[];
  film_identity: TasteIdentity;
  music_identity: TasteIdentity;
  blind_spots: string[];
}

export interface MusicRecommendation {
  artist: string;
  title: string;
  type: "album" | "track";
  explanation: string;
  confidence: Confidence;
  spotify_id?: string | null;
  image_url?: string | null;
  album_name?: string | null;
}

export type Confidence = "high" | "medium" | "discovery";

export interface FilmRecommendation {
  tmdb_id: number;
  title: string;
  media_type: "movie" | "tv";
  year: number | null;
  poster_url: string | null;
  explanation: string;
  confidence: Confidence;
}

export interface FilmCandidate {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  year: number | null;
  genres: string[];
  overview: string;
  poster_url: string | null;
}

export interface RawFilmPick {
  tmdb_id: number | null;
  title: string;
  year: number | null;
  media_type: "movie" | "tv";
  explanation: string;
  confidence: Confidence;
}

export type RecsResponse<T> = {
  status: "ok" | "not_enough_logs" | "empty";
  items: T[];
};

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

export type SpotifyRange = "short_term" | "medium_term" | "long_term";

export interface SpotifyTops {
  artists: Record<SpotifyRange, { id: string; name: string; genres: string[]; image_url: string | null }[]>;
  tracks: Record<SpotifyRange, { id: string; name: string; artist: string }[]>;
}

export interface RightNow {
  rising: { id: string; name: string; image_url: string | null }[];
  dropped_off: { id: string; name: string; image_url: string | null }[];
}

export type MusicRecsResponse = RecsResponse<MusicRecommendation> & { right_now: RightNow | null };
