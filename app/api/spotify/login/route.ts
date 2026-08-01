import { NextResponse } from "next/server";
import { SCOPES } from "@/lib/spotify";

export async function GET() {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", process.env.SPOTIFY_REDIRECT_URI!);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("show_dialog", "true");
  return NextResponse.redirect(url.toString());
}
