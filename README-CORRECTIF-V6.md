# Correctif v6 — OIDC automatique

Ce correctif retire les options non documentées `storeId` et `oidcToken` qui étaient envoyées au SDK.
Avec `@vercel/blob` 2.6.1, les Vercel Functions utilisent automatiquement OIDC lorsque `BLOB_READ_WRITE_TOKEN` est absent.

Vérification après déploiement :
- ouvrir `/api/public`
- vérifier `release: "storage-v6-oidc-auto"`
- vérifier `degradedMode: false`

Aucune donnée ne doit être ajoutée manuellement dans le Blob Store.
