# METER

Curatore musicale con memoria che si consolida nel tempo.

Non è un motore di raccomandazione: è un agente che si costruisce un **modello esplicito** del tuo ascolto, lo mostra, e ti lascia correggerlo. Il modello vive su tre livelli — registro grezzo, assi appresi, identità di lungo periodo — e solo i due livelli superiori entrano nel prompt, così il costo per richiesta resta costante anche dopo migliaia di ascolti.

## Come impara

**Registro (episodico).** Ogni ascolto, con verdetto e dimensioni toccate. Due origini: i giudizi espliciti che dai (segnale forte) e ciò che Spotify registra da solo (segnale debole di esposizione).

**Assi (semantico).** Affermazioni sul tuo gusto con una confidenza tra 0.25 e 0.95. Mai 1: un modello di gusto non chiude del tutto una porta. Ogni asse porta le evidenze da cui nasce.

**Identità (lungo periodo).** Tre-cinque frasi che sopravvivono ai cambi di fase, riscritte ogni quattro cicli. Non viene mai potata: è ciò che consente all'agente di dire "ti sei allontanato dal gain alto, sei tornato al pianoforte".

Il **dream cycle** (`/api/consolidate`) gira di notte via cron: Orient → Gather → Consolidate → Prune. Un asse contraddetto sotto 0.4 viene *riscritto in forma più precisa*, non cancellato — è lì che il sistema impara davvero.

## Perché le dimensioni contano più dei verdetti

"Mi piace / non mi piace" dice *che* qualcosa ha funzionato, mai *cosa*. Il giudizio ha due assi: verdetto (tenuto / in dubbio / scartato) più le dimensioni toccate (produzione, arrangiamento, esecuzione, timbro, dinamica, metrica, scrittura). Due brani scartati per ragioni diverse non devono produrre lo stesso asse.

La **catena d'ascolto** viene registrata a ogni voce, così il consolidamento può scrivere assi condizionali: "su diffusori regge, in auto no".

## Setup

```bash
npm install
cp .env.example .env.local        # compila le variabili
psql $POSTGRES_URL -f db/schema.sql
npm run dev
```

Poi apri `/api/spotify/login` una volta per autorizzare l'account.

### Variabili

| Variabile | Dove si prende |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `POSTGRES_URL` | Vercel → Storage → Neon |
| `SPOTIFY_CLIENT_ID` / `SECRET` | developer.spotify.com/dashboard |
| `SPOTIFY_REDIRECT_URI` | deve combaciare *esattamente* con quello registrato nel dashboard |
| `CRON_SECRET` | stringa casuale; Vercel la invia come `Authorization: Bearer` |
| `OWNER_ID` | un identificatore qualsiasi, singolo proprietario |

## Deploy su Vercel

Due processi girano da soli:

- `/api/cron/scrobble` ogni 30 min — legge `recently-played` e cattura anche ciò che ascolti con l'app chiusa
- `/api/cron/dream` alle 4:00 — consolida la giornata mentre dormi

Solo il dream è in `vercel.json`: il piano Hobby ammette un cron al giorno per progetto. Lo scrobble gira quindi da GitHub Actions (`.github/workflows/scrobble.yml`), che chiama l'endpoint con `Authorization: Bearer $CRON_SECRET`. Servono due secret nel repo: `METER_URL` (l'origin del deploy, senza slash finale) e `CRON_SECRET` (lo stesso valore impostato tra le env di Vercel). Su un piano Pro puoi rimettere `{ "path": "/api/cron/scrobble", "schedule": "*/30 * * * *" }` in `vercel.json` e disattivare il workflow.

Il system prompt è marcato con `cache_control: ephemeral`: identità, assi e regole non cambiano tra una richiesta e l'altra, quindi in lettura costano il 10%. Su un agente che rilegge la stessa memoria decine di volte al giorno è la voce di costo dominante.

## Estensioni ovvie

- **Multi-utente**: aggiungi `owner_id` a ogni query (lo schema è già predisposto) e una sessione al posto di `OWNER_ID`.
- **Provenienza del master**: Spotify serve spesso il remaster compresso senza dirlo, quindi un asse sulla dinamica può basarsi su una versione diversa da quella che pensi. Incrociare con MusicBrainz per l'edizione e con i database DR per la dinamica reale è il pezzo che manca davvero a un'app audiofila.
- **Compressione del registro**: oltre le ~500 voci, sostituire il registro grezzo con sintesi periodiche prima del consolidamento.
