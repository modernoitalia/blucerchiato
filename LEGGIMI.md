# Casanova Blucerchiata – sito su Netlify

I dati (tesserati, quote, spese) sono salvati nell'archivio di Netlify (Netlify Blobs), separati dal sito:
puoi aggiornare grafica e codice quando vuoi e i dati restano al loro posto.

## Cosa c'è nella cartella
- `public/` → il sito (index.html, logo.png, sfondo.jpg)
- `netlify/functions/api.mjs` → il "server": controlla le password e legge/scrive i dati
- `netlify.toml`, `package.json` → configurazione

## Pubblicazione (una volta sola)
1. Crea un repository su GitHub e carica tutta questa cartella.
2. Su Netlify: **Add new site → Import an existing project → GitHub** e scegli il repository.
   Lascia le impostazioni di build come sono (le legge da `netlify.toml`).
3. Prima del deploy, o subito dopo (poi fai "Trigger deploy"), vai su
   **Site configuration → Environment variables** e crea:
   - `ADMIN_PASSWORD` = la password admin
   - `SESSION_SECRET` = una stringa lunga e casuale (almeno 32 caratteri), serve a firmare gli accessi
4. Apri il sito: il lucchetto 🔒 in basso porta all'accesso admin.

In alternativa con la CLI: `npm i -g netlify-cli`, poi `netlify login`, `netlify init`,
`netlify env:set ADMIN_PASSWORD ...`, `netlify env:set SESSION_SECRET ...`, `netlify deploy --prod`.
Il semplice trascinamento della cartella su Netlify NON basta (le funzioni non vengono installate).

## Aggiornamenti futuri
Modifichi `public/index.html` (o altro) e fai un nuovo push/deploy: i dati NON si cancellano.
Se vuoi cambiare la password admin, cambia `ADMIN_PASSWORD` e rifai il deploy.

## Backup
Nell'area admin: **Scarica backup** salva tutti i dati in un file .json; **Ripristina backup** li ricarica.
Fai un backup ogni tanto, e prima di grosse modifiche.

## Password dei tesserati
COGNOME + numero tessera (es. ROSSI12). Maiuscole, spazi e accenti non contano.
