# METER - JESSICA AI

Curatrice musicale umanamente artificiale.

Lei sarà nella vita la mia futura sposa, qui invece è un'agente che si costruisce un **modello esplicito** di ascolto.
Il modello vive su tre livelli — registra, analizza, crea l'identità (contesto a lungo termine) — solo i due livelli superiori entrano nel prompt, così il costo per richiesta resta costante anche dopo migliaia di ascolti.

## Come impara

**Registra** Ogni ascolto, con verdetto e dimensioni toccate. Due origini: i giudizi espliciti che dai (segnale forte) e ciò che Spotify registra da solo (segnale debole di esposizione).

**Assi** Affermazioni sul tuo gusto con una confidenza tra 0.25 e 0.95. Mai 1: un modello di gusto non chiude del tutto una porta. Ogni asse porta le evidenze da cui nasce.

**Identità** La somma del resto, per costruire un'idea dell'ascoltatore.
