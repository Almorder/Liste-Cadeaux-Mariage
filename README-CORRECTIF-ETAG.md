# Correctif ETag v7

Ce correctif traite les conflits `BlobPreconditionFailedError: ETag mismatch`.

- détection robuste des erreurs HTTP 412 / ETag mismatch ;
- 8 tentatives avec backoff exponentiel et jitter ;
- relecture forte (`useCache: false`) avant chaque nouvelle tentative ;
- identifiant de requête pour éviter les doublons si le navigateur renvoie la même participation ;
- version publique attendue : `storage-v7-etag-retry`.
