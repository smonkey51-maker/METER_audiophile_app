import { sql } from "@vercel/postgres";
import { EMPTY_MODEL, type Listen, type Model } from "./types";

export const OWNER = process.env.OWNER_ID || "owner";

export async function getModel(owner = OWNER): Promise<Model> {
  const { rows } = await sql`select * from model where owner_id = ${owner}`;
  if (!rows.length) {
    await sql`insert into model (owner_id) values (${owner}) on conflict do nothing`;
    return { ...EMPTY_MODEL };
  }
  const r = rows[0];
  return {
    axes: r.axes ?? [], rules: r.rules ?? [], summary: r.summary ?? "",
    identity: r.identity ?? "", eras: r.eras ?? [], changelog: r.changelog ?? [],
    cycles: r.cycles ?? 0, taste: r.taste ?? [],
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

export async function saveModel(m: Model, owner = OWNER) {
  await sql`
    insert into model (owner_id, axes, rules, summary, identity, eras, changelog, cycles, taste, updated_at)
    values (${owner}, ${JSON.stringify(m.axes)}, ${JSON.stringify(m.rules)}, ${m.summary},
            ${m.identity}, ${JSON.stringify(m.eras)}, ${JSON.stringify(m.changelog)}, ${m.cycles},
            ${JSON.stringify(m.taste)}, now())
    on conflict (owner_id) do update set
      axes = excluded.axes, rules = excluded.rules, summary = excluded.summary,
      identity = excluded.identity, eras = excluded.eras, changelog = excluded.changelog,
      cycles = excluded.cycles, taste = excluded.taste, updated_at = now()`;
}

export async function recentListens(limit = 12, owner = OWNER): Promise<Listen[]> {
  const { rows } = await sql`
    select * from listens where owner_id = ${owner}
    order by coalesce(played_at, created_at) desc limit ${limit}`;
  return rows as unknown as Listen[];
}

export async function pendingListens(owner = OWNER): Promise<Listen[]> {
  const { rows } = await sql`
    select * from listens where owner_id = ${owner} and consolidated = false
    order by coalesce(played_at, created_at) desc limit 200`;
  return rows as unknown as Listen[];
}

/** Inserisce, oppure incrementa plays se l'ascolto esiste già. */
export async function upsertListen(l: Partial<Listen>, owner = OWNER) {
  const { rows } = await sql`
    select id, plays from listens
    where owner_id = ${owner} and lower(artist) = lower(${l.artist!}) and lower(track) = lower(${l.track!})
    order by id desc limit 1`;

  if (rows.length && !l.verdict) {
    await sql`update listens set plays = plays + 1, consolidated = false where id = ${rows[0].id}`;
    return rows[0].id as number;
  }
  if (rows.length && l.verdict) {
    await sql`
      update listens set verdict = ${l.verdict}, dims = ${JSON.stringify(l.dims ?? [])},
        rig = ${l.rig ?? null}, consolidated = false where id = ${rows[0].id}`;
    return rows[0].id as number;
  }

  const { rows: ins } = await sql`
    insert into listens (owner_id, artist, track, album, spotify_url, spotify_id, verdict, dims,
                         rig, meter, dynamics, production, era, bridge, source, plays, played_at)
    values (${owner}, ${l.artist!}, ${l.track!}, ${l.album ?? null}, ${l.spotify_url ?? null}, ${null},
            ${l.verdict ?? null}, ${JSON.stringify(l.dims ?? [])}, ${l.rig ?? null}, ${l.meter ?? null},
            ${l.dynamics ?? null}, ${l.production ?? null}, ${l.era ?? null}, ${l.bridge ?? null},
            ${l.source ?? "rec"}, ${l.plays ?? 1}, ${l.played_at ?? null})
    returning id`;
  return ins[0].id as number;
}

export async function markConsolidated(ids: number[], owner = OWNER) {
  if (!ids.length) return;
  await sql`update listens set consolidated = true where owner_id = ${owner} and id = any(${ids as any})`;
}

export async function logCycle(n: number, kind: string, changelog: string[], axes: unknown, owner = OWNER) {
  await sql`insert into cycles (owner_id, n, kind, changelog, axes_after)
            values (${owner}, ${n}, ${kind}, ${JSON.stringify(changelog)}, ${JSON.stringify(axes)})`;
}

/** Numeri che Spotify non può dare: quanto è successo dentro METER stesso. */
export async function wrappedStats(owner = OWNER) {
  const { rows } = await sql`
    select
      count(*) filter (where verdict is not null)::int as judged,
      count(*) filter (where verdict = 'keep')::int as keep,
      count(*) filter (where verdict = 'maybe')::int as maybe,
      count(*) filter (where verdict = 'drop')::int as drop,
      count(*) filter (where source = 'rec')::int as picks
    from listens where owner_id = ${owner}`;

  const { rows: rigRows } = await sql`
    select rig, count(*)::int as n from listens
    where owner_id = ${owner} and rig is not null and verdict is not null
    group by rig order by n desc limit 1`;

  const r = rows[0];
  return {
    judged: r?.judged ?? 0, keep: r?.keep ?? 0, maybe: r?.maybe ?? 0, drop: r?.drop ?? 0,
    picks: r?.picks ?? 0, topRig: rigRows[0]?.rig as string | undefined,
  };
}
