import { sql } from "@vercel/postgres";
import { OWNER } from "./db";

/**
 * Gli scope: lettura del profilo per l'innesto, cronologia per lo scrobble,
 * scrittura playlist per l'export. Niente di più.
 */
export const SCOPES = [
  "user-read-recently-played",
  "user-read-currently-playing",
  "user-top-read",
  "user-library-read",
  "user-follow-read",
  "playlist-read-private",
  "playlist-modify-private",
].join(" ");

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

function basicAuth() {
  const raw = `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number; scope: string }>;
}

export async function saveTokens(t: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }, owner = OWNER) {
  const expires = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  await sql`
    insert into spotify_auth (owner_id, access_token, refresh_token, expires_at, scope, updated_at)
    values (${owner}, ${t.access_token}, ${t.refresh_token ?? ""}, ${expires}, ${t.scope ?? ""}, now())
    on conflict (owner_id) do update set
      access_token = excluded.access_token,
      refresh_token = case when excluded.refresh_token = '' then spotify_auth.refresh_token else excluded.refresh_token end,
      expires_at = excluded.expires_at, scope = excluded.scope, updated_at = now()`;
}

/** Restituisce un access token valido, rinnovandolo se scaduto. */
export async function accessToken(owner = OWNER): Promise<string | null> {
  const { rows } = await sql`select * from spotify_auth where owner_id = ${owner}`;
  if (!rows.length) return null;
  const row = rows[0];
  if (new Date(row.expires_at).getTime() > Date.now()) return row.access_token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
  });
  if (!res.ok) return null;
  const t = await res.json();
  await saveTokens(t, owner);
  return t.access_token as string;
}

async function get(path: string, owner = OWNER) {
  const token = await accessToken(owner);
  if (!token) throw new Error("spotify: non autorizzato");
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`spotify ${path} → ${res.status}`);
  return res.json();
}

const trackName = (t: any) => `${(t.artists ?? []).map((a: any) => a.name).join(", ")} — ${t.name}`;

/**
 * Innesto: le tre finestre temporali sono il punto. long_term vs short_term
 * è dove si legge la traiettoria, che è ciò che l'identità deve catturare.
 */
export async function fullProfile(owner = OWNER) {
  const [tLong, tMed, tShort, trLong, trShort, saved, follow, recent] = await Promise.all([
    get("/me/top/artists?time_range=long_term&limit=50", owner),
    get("/me/top/artists?time_range=medium_term&limit=50", owner),
    get("/me/top/artists?time_range=short_term&limit=50", owner),
    get("/me/top/tracks?time_range=long_term&limit=50", owner),
    get("/me/top/tracks?time_range=short_term&limit=50", owner),
    get("/me/tracks?limit=50", owner),
    get("/me/following?type=artist&limit=50", owner),
    get("/me/player/recently-played?limit=50", owner),
  ]);

  const names = (r: any) => (r?.items ?? []).map((a: any) => a.name);
  const genres = (r: any) => [...new Set((r?.items ?? []).flatMap((a: any) => a.genres ?? []))].slice(0, 40);

  return {
    topArtistsAllTime: names(tLong),
    topArtistsSixMonths: names(tMed),
    topArtistsMonth: names(tShort),
    genresAllTime: genres(tLong),
    genresMonth: genres(tShort),
    topTracksAllTime: (trLong?.items ?? []).map(trackName),
    topTracksMonth: (trShort?.items ?? []).map(trackName),
    savedTracks: (saved?.items ?? []).map((i: any) => trackName(i.track)),
    following: names(follow?.artists),
    recent: (recent?.items ?? []).map((i: any) => ({
      artist: (i.track.artists ?? []).map((a: any) => a.name).join(", "),
      track: i.track.name,
      album: i.track.album?.name,
      url: i.track.external_urls?.spotify,
      played_at: i.played_at,
    })),
  };
}

/** Lo scrobble vero: cattura anche ciò che ascolti con l'app chiusa. */
export async function recentlyPlayed(afterMs?: number, owner = OWNER) {
  const q = afterMs ? `&after=${afterMs}` : "";
  const data = await get(`/me/player/recently-played?limit=50${q}`, owner);
  return (data?.items ?? []).map((i: any) => ({
    artist: (i.track.artists ?? []).map((a: any) => a.name).join(", "),
    track: i.track.name,
    album: i.track.album?.name,
    url: i.track.external_urls?.spotify,
    played_at: i.played_at as string,
  }));
}

export async function searchTrack(artist: string, track: string, owner = OWNER) {
  const q = encodeURIComponent(`artist:${artist} track:${track}`);
  const data = await get(`/search?q=${q}&type=track&limit=1`, owner);
  const t = data?.tracks?.items?.[0];
  return t ? { url: t.external_urls.spotify as string, uri: t.uri as string } : { url: "", uri: "" };
}

export async function createPlaylist(name: string, uris: string[], owner = OWNER) {
  const token = await accessToken(owner);
  if (!token) throw new Error("spotify: non autorizzato");
  const me = await get("/me", owner);
  const res = await fetch(`${API}/users/${me.id}/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, public: false, description: "Costruita da METER" }),
  });
  const pl = await res.json();
  if (uris.length) {
    await fetch(`${API}/playlists/${pl.id}/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: uris.slice(0, 100) }),
    });
  }
  return { url: pl.external_urls.spotify as string, name: pl.name as string };
}
