import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Alle 4:00. Consolidare a ore morte invece che a soglia di reazioni:
 * la memoria si assesta mentre dormi e la mattina il modello è cambiato.
 */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "non autorizzato" }, { status: 401 });
  }
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const res = await fetch(`${base}/api/consolidate`, { method: "POST" });
  return NextResponse.json(await res.json());
}
