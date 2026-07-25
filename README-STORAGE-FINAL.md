# Correctif stockage v4

Cette version force le rechargement des fichiers front-end (`app-v4.js`, `admin-v4.js`) et laisse le SDK Vercel Blob choisir automatiquement OIDC ou l’ancien token statique.

Après upload sur GitHub :
1. vérifier Storage > Blob > Projects ;
2. connecter `liste-cadeaux-mariage` à Production ;
3. cliquer sur Upgrade to OIDC si proposé ;
4. redéployer sans cache ;
5. ouvrir `/api/public` et vérifier `degradedMode: false` et `release: storage-v4`.
