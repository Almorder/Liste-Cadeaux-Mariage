# Correctif V8 — ETag canonique via `head()`

Ce correctif résout les conflits permanents `BlobPreconditionFailedError: ETag mismatch`.

## Cause

Le contenu était lu avec `get()`, puis son ETag était réutilisé pour `ifMatch`. Dans le déploiement concerné, cet ETag ne correspondait pas toujours à l’ETag canonique attendu par l’écriture conditionnelle.

## Correction

- lecture cohérente avec `get(..., { useCache: false })` ;
- récupération de l’ETag canonique avec `head()` ;
- vérification que GET et HEAD concernent la même version ;
- 12 tentatives avec backoff en cas de véritable écriture concurrente ;
- release publique : `storage-v8-head-etag`.

Aucune variable Vercel ni donnée Blob ne doit être modifiée.
