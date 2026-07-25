# Liste de mariage Myriam & Nolan

Version : `storage-v10-whatsapp-groups`

Site public et espace administrateur privé pour Vercel, avec un stockage Vercel Blob en événements immuables. Chaque participation est enregistrée dans un fichier indépendant afin d’éviter les conflits ETag.

## Fonctionnalités

- 46 cadeaux importés depuis le fichier Excel ;
- variantes exclusives regroupées ;
- achat complet et participation collective ;
- suivi des montants promis, reçus et annulés ;
- espace administrateur protégé ;
- ajout et modification des cadeaux ;
- mise en relation regroupée par produit ;
- messages WhatsApp individuels préremplis ;
- export `.vcf` des participants pour les importer dans le téléphone ;
- enregistrement privé du lien d’invitation du groupe WhatsApp ;
- exactement 12 Vercel Functions, compatible avec la limite du plan Hobby.

## Déploiement

1. Importer le contenu de ce dossier dans le dépôt GitHub relié à Vercel.
2. Vérifier que le Blob Store privé est toujours connecté au projet.
3. Conserver les variables existantes :
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - les variables Blob ajoutées automatiquement par Vercel
4. Lancer ou attendre le nouveau déploiement Production.

Aucune nouvelle variable d’environnement n’est nécessaire pour la coordination WhatsApp.

## Vérification de la version

Ouvrir :

```text
https://votre-projet.vercel.app/api/public
```

La réponse doit contenir :

```json
"release": "storage-v10-whatsapp-groups"
```

## Administration

Ouvrir :

```text
https://votre-projet.vercel.app/admin
```

La section **Mises en relation** affiche une fiche par cadeau avec tous les participants et toutes les demandes associées.

Le fonctionnement détaillé se trouve dans `README-WHATSAPP.md`.

## Confidentialité

- les noms, téléphones et messages ne sont accessibles qu’après connexion à l’administration ;
- les liens privés des groupes WhatsApp sont retirés de `/api/public` ;
- les nouveaux formulaires demandent explicitement l’accord de la personne avant tout contact WhatsApp ;
- aucun secret ne doit être ajouté au dépôt GitHub.
