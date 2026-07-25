# Correctif Vercel Blob OIDC

Cette version utilise `@vercel/blob` 2.6.1 et fonctionne avec l’authentification OIDC désormais activée par défaut lors de la connexion d’un nouveau Blob Store.

Après remplacement des fichiers dans GitHub :
1. Attendre le déploiement automatique Vercel.
2. Vérifier que le Blob Store est **Private** et connecté au projet.
3. Vérifier uniquement `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `SESSION_SECRET` dans les variables Production.
4. Tester `/`, puis `/admin`.

La variable `BLOB_READ_WRITE_TOKEN` n’est plus obligatoire lorsque la connexion utilise OIDC.
