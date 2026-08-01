-- METER — schema
-- Un'istanza, un proprietario. Per il multi-utente: aggiungi owner_id a ogni tabella e indicizzalo.

create table if not exists spotify_auth (
  owner_id      text primary key,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  updated_at    timestamptz not null default now()
);

-- Modello appreso: una riga per proprietario, riscritta a ogni consolidamento.
create table if not exists model (
  owner_id   text primary key,
  axes       jsonb not null default '[]',
  rules      jsonb not null default '[]',
  summary    text  not null default '',
  identity   text  not null default '',
  eras       jsonb not null default '[]',
  changelog  jsonb not null default '[]',
  cycles     int   not null default 0,
  taste      jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Registro d'ascolto. verdict null = ascolto passivo non ancora giudicato.
create table if not exists listens (
  id           bigserial primary key,
  owner_id     text not null,
  artist       text not null,
  track        text not null,
  album        text,
  spotify_url  text,
  spotify_id   text,
  verdict      text,               -- keep | maybe | drop | null
  dims         jsonb not null default '[]',
  rig          text,
  meter        text,
  dynamics     text,
  production   text,
  era          text,
  bridge       text,
  source       text not null,      -- rec | manual | spotify | import
  plays        int  not null default 1,
  consolidated boolean not null default false,
  played_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists listens_owner_pending on listens (owner_id, consolidated, created_at desc);
create unique index if not exists listens_dedup on listens (owner_id, lower(artist), lower(track), coalesce(played_at, created_at));

-- Traccia dei cicli, utile per capire come si è mosso il modello nel tempo.
create table if not exists cycles (
  id         bigserial primary key,
  owner_id   text not null,
  n          int not null,
  kind       text not null,        -- consolidate | meta | import
  changelog  jsonb not null default '[]',
  axes_after jsonb not null default '[]',
  created_at timestamptz not null default now()
);
