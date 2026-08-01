import { NextResponse } from "next/server";
import { profileName } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ name: (await profileName()) ?? null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
