import {
  searchSpotify,
  getSpotifyItem,
  getNewReleases,
  getArtistTopTracks,
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
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "new-releases") {
    try {
      const results = await getNewReleases(20);
      return NextResponse.json(results);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "artist-top") {
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing artist id" }, { status: 400 });
    try {
      const tracks = await getArtistTopTracks(id);
      return NextResponse.json(tracks);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
