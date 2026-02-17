const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_ACCESS_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;

const baseUrl = "https://api.themoviedb.org/3";

export async function searchMovieByName(query: string) {
    const url = `${baseUrl}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    const response = await fetch(url,
        {
            headers: {
                Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
        }
    );
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function searchSeriesByName(query: string) {
    const url = `${baseUrl}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    const response = await fetch(url,
        {
            headers: {
                Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
        }
    );
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export function getPoster(posterPath: string, size: string = "w500") {
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}