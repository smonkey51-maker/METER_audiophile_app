import { NextResponse } from "next/server";
import { getModel, wrappedStats } from "@/lib/db";
import { fullProfile } from "@/lib/spotify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Il "simil-Wrapped": Spotify non dà lo storico completo via API, solo i
 * primi 50 di tre finestre temporali — il resto della scena lo fa quello
 * che Jessica ha imparato dentro METER, cosa che Spotify non può sapere.
 */
export async function GET() {
  const [model, stats] = await Promise.all([getModel(), wrappedStats()]);

  let spotify = null;
  try {
    const p = await fullProfile();
    spotify = {
      topArtist: p.topArtistsAllTime[0] ?? null,
      topArtists: p.topArtistsAllTime.slice(0, 5),
      topGenres: p.genresAllTime.slice(0, 5),
      topTrack: p.topTracksMonth[0] ?? p.topTracksAllTime[0] ?? null,
      savedCount: p.savedTracks.length,
      followingCount: p.following.length,
    };
  } catch { /* Wrapped resta comunque leggibile senza Spotify collegato. */ }

  return NextResponse.json({
    spotify,
    model: { cycles: model.cycles, axes: model.axes, identity: model.identity },
    stats,
  });
}
