import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * METER non ha un sistema di login: prima usava la protezione SSO di Vercel
 * per restare privato, ma quella blocca anche il redirect OAuth di Spotify e
 * la chiamata cron di GitHub Actions. Basic Auth la sostituisce senza
 * interferire con nessuno dei due: i cron passano col loro CRON_SECRET,
 * il browser mantiene le credenziali per tutta la sessione sull'origin.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const expected = "Basic " + btoa(`${user}:${pass}`);
  if (req.headers.get("authorization") === expected) return NextResponse.next();

  return new NextResponse("Autenticazione richiesta", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="METER"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
