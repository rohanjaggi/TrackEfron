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

export async function searchMulti(query: string) {
    const url = `${baseUrl}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return (data.results as any[]).filter(
        (r) => r.media_type === "movie" || r.media_type === "tv"
    );
}

export async function getMovieDetails(id: number) {
    const url = `${baseUrl}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    return response.json();
}

export async function getTvDetails(id: number) {
    const url = `${baseUrl}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    return response.json();
}

export async function getTrending() {
    const url = `${baseUrl}/trending/all/day?api_key=${TMDB_API_KEY}`;
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

export async function getMovieProviders(id: number) {
    const url = `${baseUrl}/movie/${id}/watch/providers?api_key=${TMDB_API_KEY}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function getTvProviders(id: number) {
    const url = `${baseUrl}/tv/${id}/watch/providers?api_key=${TMDB_API_KEY}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function getNowPlaying() {
    const url = `${baseUrl}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function getUpcoming() {
    const url = `${baseUrl}/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function getTopRated(type: "movie" | "tv") {
    const url = `${baseUrl}/${type}/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function discoverByGenre(type: "movie" | "tv", genreIds: string) {
    const url = `${baseUrl}/discover/${type}?api_key=${TMDB_API_KEY}&with_genres=${genreIds}&sort_by=vote_average.desc&vote_count.gte=50&language=en-US&page=1`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function getSimilar(type: "movie" | "tv", id: number) {
    const url = `${baseUrl}/${type}/${id}/similar?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results;
}

export async function getPersonCredits(personId: number) {
    const url = `${baseUrl}/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=en-US`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`);
    }
    return response.json();
}