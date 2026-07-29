# Correctif V11 — prix indicatifs et sauvegarde serveur

Cette version ajoute :

- une mention claire sur le caractère indicatif des prix et des liens marchands ;
- la mention « Prix indicatif » sur les cartes et fiches cadeaux ;
- un bouton marchand présenté comme une référence, sans obligation d’achat chez le vendeur indiqué ;
- des aides dans l’éditeur administrateur ;
- un export qui relit obligatoirement la dernière version du serveur avant de créer le fichier JSON ;
- aucune sauvegarde locale ou obsolète n’est téléchargée lorsque le stockage est inaccessible ;
- des métadonnées d’export dans le JSON (`exportMetadata.source = "server"`).

Release attendue dans `/api/public` : `storage-v11-price-guidance-export`.
