# Liste de mariage — Myriam & Nolan

Site public et espace administrateur privé, préparés pour un déploiement Vercel.

## Ce que contient cette version

- 46 produits importés depuis le fichier Excel ;
- exclusions automatiques des mémos `A TESTER` et `WISHLIST ONLY` ;
- catégories, recherche et filtres ;
- variantes de budget regroupées ;
- réservations complètes et participations collectives ;
- progression en euros et en pourcentage ;
- demandes de mise en relation ;
- administration privée des produits, images, statuts et participations ;
- stockage partagé entre tous les invités ;
- aucune donnée personnelle exposée par l’API publique.

## Architecture

Le projet utilise :

- des pages HTML/CSS/JavaScript statiques pour l’interface ;
- des Vercel Functions dans `/api` ;
- un **Vercel Blob Store privé** pour la liste, les coordonnées et les images ;
- une session administrateur signée dans un cookie `HttpOnly`.

L’adresse e-mail et le mot de passe administrateur sont uniquement enregistrés dans les variables d’environnement Vercel. Ils ne doivent jamais être ajoutés au dépôt GitHub.


## Compatibilité avec Vercel Hobby

Cette version contient exactement 12 fonctions Serverless, soit la limite du plan Hobby.
Le précédent endpoint de diagnostic `/api/health` a été retiré pour respecter cette limite.
La liste publique peut être testée avec `/api/public`.

## Déploiement Vercel

### 1. Importer le dépôt

Dans Vercel :

1. cliquez sur **Add New → Project** ;
2. sélectionnez le dépôt GitHub `Almorder/Liste-Cadeaux-Mariage` ;
3. conservez le framework **Other** et les réglages de build automatiques ;
4. lancez un premier déploiement.

### 2. Créer le stockage privé

Dans le projet Vercel :

1. ouvrez **Storage** ;
2. choisissez **Create Database → Blob** ;
3. sélectionnez impérativement **Private** ;
4. connectez le store au projet.

Vercel ajoutera automatiquement `BLOB_READ_WRITE_TOKEN` au projet.

### 3. Ajouter les secrets administrateur

Dans **Settings → Environment Variables**, ajoutez :

- `ADMIN_EMAIL` : votre adresse e-mail exacte ;
- `ADMIN_PASSWORD` : un mot de passe unique et long ;
- `SESSION_SECRET` : une chaîne aléatoire d’au moins 32 caractères.

Exemple de génération de secret :

```bash
openssl rand -base64 48
```

Ajoutez ces variables aux environnements **Production**, **Preview** et **Development**, puis redéployez le projet.

### 4. Ouvrir le site

- Liste publique : `https://votre-projet.vercel.app/`
- Administration : `https://votre-projet.vercel.app/admin`

Au premier chargement, le stockage est initialisé automatiquement avec les 46 produits.

## Sécurité

- les invités ne peuvent lire que les produits et les montants publics ;
- les noms, téléphones, messages et demandes ne sont retournés que par les routes `/api/admin/*` après authentification ;
- le cookie administrateur est `HttpOnly`, `Secure` et `SameSite=Strict` ;
- les images importées sont stockées dans le Blob Store privé et diffusées via une route limitée aux images produit ;
- aucune clé ou aucun mot de passe ne doit être commité dans GitHub.

## Utilisation locale

La page publique peut être ouverte avec un serveur statique local. Elle utilisera alors un mode de prévisualisation sans enregistrement. Les fonctions complètes nécessitent Vercel et un Blob Store connecté.

## Mise à jour des fichiers dans GitHub

Depuis un terminal placé dans le dossier du projet :

```bash
git add .
git commit -m "Déploie la liste de mariage sécurisée sur Vercel"
git push origin main
```

## Diagnostic rapide après déploiement

Ouvrez `https://votre-projet.vercel.app/api/health`.

Le résultat doit contenir :

```json
{
  "ok": true,
  "storage": { "ok": true, "code": "OK", "giftCount": 46 },
  "environment": {
    "blobTokenPresent": true,
    "adminEmailPresent": true,
    "adminPasswordPresent": true,
    "sessionSecretValid": true
  }
}
```

Si `storage.ok` est faux, vérifiez que le Blob Store est **Private**, connecté à ce projet et activé pour **Production**, puis redéployez sans cache.
