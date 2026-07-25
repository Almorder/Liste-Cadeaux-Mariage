# Correctif OIDC explicite

Ce correctif transmet explicitement aux appels `@vercel/blob` :

- le jeton OIDC reçu par la Vercel Function dans l’en-tête `x-vercel-oidc-token` ;
- l’identifiant du store fourni par `BLOB_STORE_ID` ;
- ou, en secours, `BLOB_READ_WRITE_TOKEN` lorsqu’un ancien token statique existe.

## Configuration Vercel requise

Dans `Settings > Environment Variables`, vérifier que `BLOB_STORE_ID` existe pour Production. Cette variable est normalement ajoutée automatiquement lorsque le Blob Store est connecté au projet avec OIDC.

Conserver aussi :

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Aucune donnée ne doit être importée manuellement dans Blob. Le premier appel à `/api/public` crée automatiquement `registry/state.json`.

## Vérification

Après le déploiement, ouvrir :

`https://liste-cadeaux-mariage.vercel.app/api/public`

Résultat attendu :

- `"degradedMode": false`
- `"release": "storage-v6-oidc-auto"`

Si le stockage échoue encore, la réponse contient `blobDiagnostics` avec uniquement des booléens sans secret :

- `storeIdPresent`
- `readWriteTokenPresent`
- `oidcHeaderPresent`
- `oidcEnvironmentPresent`
