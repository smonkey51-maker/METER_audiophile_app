import { NextResponse } from "next/server";
import { exchangeCode, saveTokens } from "@/lib/spotify";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?spotify=error", req.url));
  try {
    const tokens = await exchangeCode(code);
    await saveTokens(tokens);
    return NextResponse.redirect(new URL("/?spotify=ok", req.url));
  } catch {
    return NextResponse.redirect(new URL("/?spotify=error", req.url));
  }
}
