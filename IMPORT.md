# Da importare nel repo

Struttura completa, pronta da committare su `smonkey51-maker/METER_audiophile_app`.

```
.
├── README.md
├── package.json
├── next.config.mjs
├── tsconfig.json
├── vercel.json               # schedule dei due cron
├── .env.example
├── .gitignore
├── db/
│   └── schema.sql            # 4 tabelle: spotify_auth, model, listens, cycles
├── lib/
│   ├── types.ts              # Model, Listen, Axis + costanti condivise
│   ├── db.ts                 # accesso Postgres, upsert con dedup su artista+brano
│   ├── claude.ts             # SDK, prompt caching, parsing JSON difensivo, clamp assi
│   ├── prompts.ts            # curatore, memoria, consolidamento, meta, innesto
│   └── spotify.ts            # OAuth, refresh, profilo completo, scrobble, playlist
├── app/
│   ├── layout.tsx
│   ├── globals.css           # sistema visivo: variabili, blocchi, movimento
│   ├── page.tsx
│   └── api/
│       ├── state/route.ts            GET    stato completo per il client
│       ├── curate/route.ts           POST   consiglio + risoluzione link in parallelo
│       ├── memory/route.ts           POST   conversazione sul modello
│       │                             PATCH  applica una proposta approvata
│       ├── log/route.ts              POST   registra un ascolto
│       │                             PATCH  aggiorna il profilo di partenza
│       ├── consolidate/route.ts      POST   dream cycle + meta-consolidamento
│       ├── import/route.ts           POST   innesto dal profilo Spotify completo
│       ├── spotify/login/route.ts    GET    avvia OAuth
│       ├── spotify/callback/route.ts GET    scambia il code, salva i token
│       └── cron/
│           ├── scrobble/route.ts     GET    ogni 30 min
│           └── dream/route.ts        GET    alle 4:00
└── components/
    ├── Meter.tsx             # UI
    └── Ring.tsx              # anello concentrico: unico elemento focale
```

## Ordine di lavoro suggerito per Claude Code

1. `npm install`, poi `psql $POSTGRES_URL -f db/schema.sql`.
2. Registra l'app su developer.spotify.com. Il redirect URI deve combaciare **carattere per carattere** con `SPOTIFY_REDIRECT_URI`, incluso lo slash finale se c'è: è la causa numero uno di fallimento in questo flusso.
3. `npm run dev`, apri `/api/spotify/login`, autorizza.
4. Dalla home premi *Importa da Spotify*: legge le tre finestre temporali del profilo e scrive gli assi iniziali (confidenza limitata a 0.45 — sono inferenze dal volume, non giudizi).
5. Deploy su Vercel, imposta le env, verifica che i cron compaiano sotto Settings → Cron Jobs.

## Punti dove intervenire per primi

**`lib/prompts.ts`** è il cuore: le quattro fasi del consolidamento, la distinzione tra giudizio ed esposizione, e la regola che riscrive un asse contraddetto invece di cancellarlo. Toccare questo file cambia il comportamento dell'agente più di qualsiasi modifica al codice.

**`app/api/consolidate/route.ts`** decide ogni quanto si aggiorna l'identità (`META_EVERY`, default 4 cicli).

**`app/globals.css`** contiene tutto il sistema visivo in variabili: cambiando `--accent`, `--shell`, `--form` e `--r-block` cambia l'intera applicazione. Nessun componente ha colori o raggi propri.

## Non ancora fatto

- Multi-utente (lo schema regge, mancano le sessioni)
- Provenienza del master: senza, gli assi sulla dinamica si basano sulla versione che Spotify serve, che è spesso il remaster compresso
- Compressione del registro oltre le ~500 voci
- Test
