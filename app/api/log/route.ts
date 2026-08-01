import { NextResponse } from "next/server";
import { getModel, saveModel, upsertListen } from "@/lib/db";
import type { Listen } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Listen>;
  if (!body.artist || !body.track) return NextResponse.json({ error: "artist e track richiesti" }, { status: 400 });
  const id = await upsertListen(body);
  return NextResponse.json({ id });
}

/** Aggiorna il profilo di partenza (aggiunta o rimozione di artisti). */
export async function PATCH(req: Request) {
  const { taste } = await req.json();
  const m = await getModel();
  await saveModel({ ...m, taste: Array.isArray(taste) ? taste : m.taste });
  return NextResponse.json({ ok: true });
}
