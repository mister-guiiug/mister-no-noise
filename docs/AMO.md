# Publication Modules Firefox (AMO)

Automatisée depuis 1.4.0 : monter la version, fusionner sur `main`. Voir
[`MAINTENANCE.fr.md`](MAINTENANCE.fr.md).

## Identifiants

| Champ | Valeur |
| ----- | ------ |
| Add-on id | `mister-no-noise@mister-guiiug` |
| Nom produit EN / FR | No Noise / Sans bruit |
| Catégorie | `privacy-security` |
| Licence | MIT |
| Canal | **listed** |

## Fichiers

| Chemin | Rôle |
| ------ | ---- |
| [`amo/fiche.json`](../amo/fiche.json) | Descriptions multi-langue + catégorie |
| [`amo/captures.json`](../amo/captures.json) | Ordre et légendes des captures |
| [`amo/captures/*.png`](../amo/captures/) | 4 PNG **1280×800** |
| [`extension/icons/icone-128.png`](../extension/icons/icone-128.png) | Icône fiche |
| [`extension/_locales/*/messages.json`](../extension/_locales/) | Nom + résumé (15 langues ; AMO n’affiche pas ar/hi) |

## Commandes

```bash
npm test
npm run lint
npm run fiche-amo -- --verifier
npm run captures          # Chrome requis
npm run paquet            # soumet si clés présentes
```

Secrets du dépôt : `AMO_API_KEY`, `AMO_API_SECRET`.
