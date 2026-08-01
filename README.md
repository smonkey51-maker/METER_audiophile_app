# METER - JESSICA AI

Curatrice musicale con memoria che si consolida nel tempo.

Non è un motore di raccomandazione: è un'agente che si costruisce un **modello esplicito** del tuo ascolto, lo mostra, e ti lascia correggerlo. Il modello vive su tre livelli — registro grezzo, assi appresi, identità di lungo periodo — e solo i due livelli superiori entrano nel prompt, così il costo per richiesta resta costante anche dopo migliaia di ascolti.

## Come impara

**Registra** Ogni ascolto, con verdetto e dimensioni toccate. Due origini: i giudizi espliciti che dai (segnale forte) e ciò che Spotify registra da solo (segnale debole di esposizione).

**Assi** Affermazioni sul tuo gusto con una confidenza tra 0.25 e 0.95. Mai 1: un modello di gusto non chiude del tutto una porta. Ogni asse porta le evidenze da cui nasce.

**Identità** La somma del resto, per costruire un'idea dell'ascoltatore.
