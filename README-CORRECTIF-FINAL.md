# Correctif final : stockage append-only

Cette version n'écrase plus `registry/state.json`.

Chaque modification est enregistrée dans un Blob JSON unique sous `events/` :

- `events/commitments/` pour les participations ;
- `events/contacts/` pour les demandes de mise en relation ;
- `events/gifts/` pour les modifications admin ;
- `events/settings/` pour les textes généraux.

Il n'existe donc plus d'écriture conditionnelle `ifMatch`, plus de comparaison ETag et plus de conflit `REGISTRY_READ_CONFLICT` ou `REGISTRY_WRITE_CONFLICT`.

Le fichier historique `registry/state.json` reste lu comme base de migration, mais il n'est plus jamais modifié.

Après le déploiement, `/api/public` doit afficher :

```json
"degradedMode": false,
"release": "storage-v9-append-only"
```
