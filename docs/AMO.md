# Publication Modules Firefox (AMO)

Préparé dans le dépôt ; **soumission listed uniquement au go**.

## Identifiants

| Champ | Valeur |
| ----- | ------ |
| Add-on id | `mister-no-noise@mister-guiiug` |
| Nom produit EN / FR | No Noise / Sans bruit |
| Catégorie | `privacy-security` |
| Licence | MIT |
| Canal | **listed** (fiche publique) — première soumission en 1.3.1 |

## Fichiers prêts

| Chemin | Rôle |
| ------ | ---- |
| [`amo/fiche.json`](../amo/fiche.json) | Descriptions multi-langue + catégorie |
| [`amo/captures.json`](../amo/captures.json) | Ordre et légendes des captures |
| [`amo/captures/*.png`](../amo/captures/) | 4 PNG **1280×800** |
| [`icons/icone-128.png`](../icons/icone-128.png) | Icône fiche |
| [`_locales/*/messages.json`](../_locales/) | Nom + résumé (15 langues ; AMO n’affiche pas ar/hi sur la fiche) |

## Checklist avant soumission listed

1. Version incrémentée dans `manifest.json` et `package.json` (ex. `1.3.0`).
2. `npm test` + `npm run lint` verts.
3. Captures encore à jour : `node scripts/captures-amo.mjs` (Chrome requis).
4. Secrets GitHub du dépôt : `AMO_API_KEY`, `AMO_API_SECRET` (mêmes clés que No Prices).
5. Premier passage listed : créer / promouvoir l’add-on unlisted → listed dans
   le tableau de bord développeur AMO, ou soumettre via `web-ext sign --channel=listed`.
6. Après approbation Mozilla : tag GitHub + attacher le `.xpi` signé ; poser le
   lien « Get it on Firefox Add-ons » dans les README.

## Notes AMO

- Langues de fiche (comme No Prices) : fr, en-US(+GB/CA), es-ES(+MX/AR/CL), de,
  it, pt-PT(+BR), nl, pl, zh-CN, ja, ko, tr, ru. **Pas** de texte de fiche ar/hi.
- Politique de confidentialité : aucune donnée collectée — le texte de
  `fiche.json` et la section Privacy du README suffisent ; pas d’URL tierce
  requise si « none » est déclaré dans le manifeste.
- Permissions justifiées dans le README (history, storage, alarms,
  contextMenus, notifications optionnelles).

## Régénérer les captures

```bash
node scripts/captures-amo.mjs
```
