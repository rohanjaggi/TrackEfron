import {
  searchSpotify,
  getSpotifyItem,
} from "@/lib/spotify/spotify";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "search") {
    const query = searchParams.get("q") || "";
    const type = (searchParams.get("type") || "album,track") as "album" | "track" | "album,track";
    if (!query.trim()) return NextResponse.json([]);
    try {
      const results = await searchSpotify(query, type);
      return NextResponse.json(results);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Spotify request failed" }, { status: 500 });
    }
  }

  if (action === "detail") {
    const id = searchParams.get("id");
    const type = searchParams.get("type") as "album" | "track" | null;
    if (!id || (type !== "album" && type !== "track")) {
      return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
    }
    try {
      const item = await getSpotifyItem(id, type);
      return NextResponse.json(item);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Spotify request failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
