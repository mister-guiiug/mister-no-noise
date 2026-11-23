<p align="center">
  <img src="extension/icons/icone.svg" alt="" width="112">
</p>

<h1 align="center">Sans bruit</h1>

<p align="center">
  <strong>Une extension Firefox qui retire le bruit récurrent de votre historique de navigation,<br>
  pour que les pages qui comptent remontent à la surface — entièrement sur votre machine.</strong>
</p>

<p align="center">
  <a href="https://github.com/mister-guiiug/mister-no-noise/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/mister-guiiug/mister-no-noise/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/mister-guiiug/mister-no-noise/releases/latest"><img alt="Dernière version" src="https://img.shields.io/github/v/release/mister-guiiug/mister-no-noise?label=version&color=7c4dff"></a>
  <img alt="Firefox 140+" src="https://img.shields.io/badge/Firefox-140%2B-FF7139?logo=firefoxbrowser&logoColor=white">
  <img alt="Firefox pour Android 142+" src="https://img.shields.io/badge/Android-142%2B-FF7139?logo=firefoxbrowser&logoColor=white">
  <img alt="15 langues" src="https://img.shields.io/badge/langues-15-d6336c">
  <img alt="Aucune donnée collectée" src="https://img.shields.io/badge/donn%C3%A9es%20collect%C3%A9es-aucune-2ea44f">
  <a href="LICENSE"><img alt="Licence MIT" src="https://img.shields.io/github/license/mister-guiiug/mister-no-noise?label=licence&color=blue"></a>
</p>

<p align="center">
  <a href="https://addons.mozilla.org/fr/firefox/addon/mister-no-noise@mister-guiiug/"><strong>L’installer depuis Modules Firefox</strong></a>
  · <a href="https://github.com/mister-guiiug/mister-no-noise/releases/latest">Télécharger le .xpi signé</a>
  · <a href="README.md">Read in English</a>
  · <a href="https://github.com/mister-guiiug/mister-no-prices">Extension sœur : Sans prix</a>
</p>

<table>
  <tr>
    <td><img src="amo/captures/1-popup.png" alt="Popup : interrupteur, nettoyer, modes temps réel et périodique"></td>
    <td><img src="amo/captures/2-regles.png" alt="Règles Supprimer et Conserver dans les options"></td>
  </tr>
  <tr>
    <td align="center"><sub>Le réglage, à un clic</sub></td>
    <td align="center"><sub>Règles Supprimer et Conserver</sub></td>
  </tr>
  <tr>
    <td><img src="amo/captures/3-bruit.png" alt="Analyseur de bruit de l’historique"></td>
    <td><img src="amo/captures/4-apercu.png" alt="Aperçu en mode simulation"></td>
  </tr>
  <tr>
    <td align="center"><sub>Analyseur de bruit</sub></td>
    <td align="center"><sub>Aperçu en simulation</sub></td>
  </tr>
</table>

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
- **Pause minutée** (5 / 15 / 60 min) depuis le popup, et page **Quoi de neuf**
  à l’installation ou à la mise à jour.
- **Packs de règles** (réseaux, Google, shopping, actus) et **Firefox Sync**
  optionnel pour les réglages (les règles restent sur l’appareil).
- **Sécurité** : mode simulation, confirmation avant un nettoyage manuel,
  avertissement au-delà d’un seuil configurable.
- **Journal prudent** : noms de domaine seulement par défaut (URL complète ou
  désactivé en option) ; notifications optionnelles.
- **Testeur d’URL**, statistiques, import/export JSON (aperçu fusion /
  remplacement) et import d’une liste de motifs en texte.
- **Quinze langues**, sur ordinateur et Android. 100 % local.

## Installation

Firefox 140 ou plus récent sur ordinateur, Firefox pour Android 142 ou plus.

| Méthode                            | Durée                              | Comment                                                                                                                           |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Modules Firefox** (recommandé)   | durable, mises à jour auto         | ouvrir la [page de l’extension](https://addons.mozilla.org/fr/firefox/addon/mister-no-noise@mister-guiiug/) → _Ajouter à Firefox_ |
| **Fichier signé d’une release**    | durable, mises à jour auto         | ouvrir le `.xpi` de la [dernière release](https://github.com/mister-guiiug/mister-no-noise/releases/latest) dans Firefox          |
| **Temporaire, depuis les sources** | jusqu’au redémarrage               | `about:debugging#/runtime/this-firefox` → _Charger un module temporaire…_ → `manifest.json`                                       |
| **Avec web-ext**                   | jusqu’à la fermeture de la fenêtre | `npm install` puis `npm start`                                                                                                    |

## Vie privée

**Aucune donnée n’est collectée.** Le manifeste le déclare
(`data_collection_permissions: none`). Pas d’analytique, pas de compte, pas de
publicité.

- Règles, réglages, journal et statistiques restent dans Firefox
  (`storage.local`).
- L’extension **n’émet aucune requête réseau** qui lui soit propre.
- Les notifications bureau ne sont demandées que si vous les activez ; le menu
  clic droit peut être désactivé.
- Le journal stocke **les noms de domaine seulement** par défaut.

## Fonctionnement

Les règles vivent dans le stockage local. La page d’arrière-plan compare chaque
URL visitée (et chaque fenêtre de balayage) aux motifs Supprimer / Conserver
compilés, avec une garde ReDoS sur les regex utilisateur. Les balayages
parcourent l’historique par fenêtres temporelles et suppriment par lots ; un
aperçu renvoie un jeton de courte durée pour que « Nettoyer » ne rescane pas.

## Langues

Anglais, français, espagnol, allemand, italien, portugais, néerlandais,
polonais, chinois simplifié, japonais, arabe (droite-à-gauche), coréen, turc,
hindi et russe. L’extension suit la langue de Firefox.

Les traductions hors français et anglais n’ont pas encore été relues par des
locuteurs natifs. Les corrections sont bienvenues : un fichier par langue,
[`extension/_locales/<langue>/messages.json`](extension/_locales).
Voir aussi [Maintenance](docs/MAINTENANCE.fr.md).

## Contribuer

Issues et pull requests bienvenues. Pour ajouter une langue : copier
`extension/_locales/en/messages.json` et traduire les `message` (placeholders inchangés).
`npm test` vérifie que toutes les locales ont les mêmes clés.

## Développement

Node.js 22 ou plus récent.

```bash
npm install
npm start            # Firefox avec l’extension, rechargement à chaque changement
npm test
npm run lint
npm run lint:js
npm run build
```

## Versions

Incrémenter `version` dans `extension/manifest.json` et `package.json`,
fusionner dans `main`. Le workflow de publication soumet la version à Modules
Firefox (`listed`). Une fois Mozilla approuvée, une release GitHub suit avec
le `.xpi` signé. Textes et captures : [`amo/`](amo/) — détail dans
[Maintenance](docs/MAINTENANCE.fr.md) et [docs/AMO.md](docs/AMO.md).

## Limites connues

- L’historique déjà purgé par les politiques de rétention de Firefox est perdu.
- Un historique très volumineux peut n’être scanné qu’en partie ; l’UI le dit.
- Les regex hostiles sont ignorées par la garde ReDoS.
- Le support Chrome (`manifest.chrome.json`) est expérimental.

## Licence

[MIT](LICENSE). Projet indépendant, non affilié à Mozilla au-delà de la revue
habituelle des modules.
