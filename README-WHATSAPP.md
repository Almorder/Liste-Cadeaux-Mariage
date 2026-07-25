# Coordination WhatsApp par cadeau

Version : `storage-v10-whatsapp-groups`

## Fonctionnement dans l’administration

Ouvrir **Administration → Mises en relation**.

Chaque cadeau concerné possède désormais sa propre fiche avec :

- toutes les participations actives ;
- toutes les demandes de mise en relation ;
- une fusion automatique des doublons grâce au numéro de téléphone ;
- le total promis et le montant restant ;
- un bouton WhatsApp individuel avec un message prérempli ;
- la copie de tous les numéros ;
- le téléchargement des participants au format `.vcf` pour les importer dans le téléphone ;
- un champ pour enregistrer le lien d’invitation du groupe WhatsApp ;
- un suivi : groupe à créer, lien prêt, invitations envoyées, groupe actif.

## Procédure recommandée

1. Cliquer sur **Importer dans le téléphone**.
2. Importer le fichier `.vcf` dans les contacts du téléphone.
3. Créer le groupe dans WhatsApp avec les contacts concernés.
4. Dans WhatsApp, copier le lien d’invitation du groupe.
5. Coller ce lien dans la fiche du cadeau et cliquer sur **Enregistrer**.
6. Cliquer sur **Préparer les messages**.
7. Ouvrir chaque conversation WhatsApp afin d’envoyer le message et le lien.
8. Cliquer sur **Marquer comme envoyées**.

## Confidentialité

- Le lien privé du groupe est stocké uniquement dans l’espace administrateur.
- Il est volontairement retiré de la réponse de `/api/public`.
- Les nouveaux formulaires demandent explicitement l’accord de la personne avant tout contact WhatsApp.
- Les anciennes participations restent visibles avec la mention **Ancienne entrée**, car leur consentement WhatsApp n’avait pas encore été enregistré.

## Déploiement

Remplacer les fichiers du dépôt avec le contenu de cette version puis laisser Vercel redéployer automatiquement.

Aucune variable d’environnement supplémentaire n’est nécessaire.
