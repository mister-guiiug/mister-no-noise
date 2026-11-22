<p align="center">
  <img src="icons/icon.svg" alt="" width="112">
</p>

<h1 align="center">Sans bruit</h1>

<p align="center">
  <strong>Une extension Firefox qui retire le bruit récurrent de votre historique de navigation,<br>
  pour que les pages qui comptent remontent à la surface — entièrement sur votre machine.</strong>
</p>

<p align="center">
  <img alt="Firefox 140+" src="https://img.shields.io/badge/Firefox-140%2B-FF7139?logo=firefoxbrowser&logoColor=white">
  <img alt="Firefox pour Android 142+" src="https://img.shields.io/badge/Android-142%2B-FF7139?logo=firefoxbrowser&logoColor=white">
  <img alt="8 langues" src="https://img.shields.io/badge/langues-8-d6336c">
  <img alt="Aucune donnée collectée" src="https://img.shields.io/badge/donn%C3%A9es%20collect%C3%A9es-aucune-2ea44f">
  <a href="LICENSE"><img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="README.md">Read in English</a>
</p>

## Pourquoi

L’historique est une deuxième mémoire : quand on ne sait plus où l’on a vu
quelque chose — une doc, un article, un produit — on y cherche, et on trouve.
Jusqu’au jour où le signal disparaît sous le bruit.

Chaque jour, les mêmes sites s’empilent : pull requests, albums photo,
recherches identiques, les mêmes tableaux de bord. Aucune de ces visites ne
mérite d’être gardée, et pourtant elles enterrent la page qui compte.

Couper l’historique jette aussi l’utile. Un « assistant » dans le nuage lirait
votre navigation. **Sans bruit** ne retire que les sites que vous choisissez —
automatiquement, au fil de la navigation — et n’envoie jamais un octet hors de
votre machine.

## Fonctions

- **Trois modes**, combinables : temps réel (adaptatif), balayage périodique et
  à la demande — plus <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> et un menu
  clic droit **« Ajouter ce site à Sans bruit »**.
- **Règles Supprimer et Conserver** — une règle Conserver protège une URL même
  si une règle Supprimer correspond (purger `google.com` mais garder
  `google.com/maps`).
- **Quatre types de motifs** : Contient, Domaine (sous-domaines inclus),
  Joker (`*`), Expression régulière.
- **Planification et rétention par règle** : toujours / temps réel seulement /
  balayages seulement, et éventuellement seulement les entrées de plus de N
  jours.
- **Analyseur de bruit** — scanne l’historique, montre les domaines qui
  l’encombrent le plus, en fait une règle en un clic.
- **Sécurité** : mode simulation, confirmation avant un nettoyage manuel,
  avertissement au-delà d’un seuil configurable.
- **Journal prudent** : noms de domaine seulement par défaut (URL complète ou
  désactivé en option) ; notifications optionnelles.
- **Testeur d’URL**, statistiques, import/export JSON (aperçu fusion / remplacement)
  et import d’une liste de motifs en texte.
- **Huit langues**, selon la locale du navigateur. 100 % local.

## Installation (développement)

Firefox 140 ou plus récent sur ordinateur, Firefox pour Android 142 ou plus.

| Méthode | Comment |
| ------- | ------- |
| **Temporaire, depuis les sources** | `about:debugging#/runtime/this-firefox` → *Charger un module temporaire…* → choisir `manifest.json` |
| **Avec web-ext** | `npm install` puis `npm start` |

```bash
npm install
npm test            # tests unitaires
npm run lint        # web-ext lint (Mozilla)
npm run lint:js     # ESLint
npm run build       # .zip dans web-ext-artifacts/
```

La publication sur Modules Firefox viendra plus tard — le dépôt est préparé
(`mister-no-noise@mister-guiiug`) mais pas encore soumis.

## Vie privée

**Aucune donnée n’est collectée.** Le manifeste le déclare
(`data_collection_permissions: none`). Pas d’analytique, pas de compte, pas de
publicité.

Règles, réglages, journal et statistiques restent dans le navigateur
(`storage.local`). Les notifications bureau ne sont demandées que si vous les
activez. Le menu clic droit peut être désactivé dans les options.

## Permissions

| Permission | Rôle |
| ---------- | ---- |
| `history` | Lire et supprimer des entrées d’historique |
| `storage` | Stocker règles, réglages et statistiques |
| `alarms` | Déclencher le balayage périodique |
| `contextMenus` | Entrée « Ajouter ce site » (désactivable) |
| `notifications` | Signaler les nettoyages (**optionnel**) |

## Langues

Anglais (défaut), français, espagnol, allemand, italien, portugais (Brésil),
russe, chinois simplifié. Pour en ajouter une : copier
`_locales/en/messages.json` vers `_locales/<code>/messages.json` et traduire
les valeurs `message`.

## Licence

[MIT](LICENSE) — © GuiiuG
