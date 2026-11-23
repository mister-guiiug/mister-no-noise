# Maintenance

[English](MAINTAINING.md) · [Retour au README](../README.fr.md)

Publier, déployer, tenir la fiche AMO à jour.

## Publier une version

La publication est **automatique** : monter `version` dans
[`extension/manifest.json`](../extension/manifest.json) et `package.json` (les
tests les gardent alignés), fusionner la PR. Une PR sans changement de version
ne publie rien.

[`publication.yml`](../.github/workflows/publication.yml), à chaque poussée sur
`main` et toutes les trois heures :

1. vérifie si la release `v<version>` existe déjà ; sinon
2. teste, valide (`web-ext lint`), puis **soumet** la version à
   addons.mozilla.org (canal « listed »), avec [`amo/fiche.json`](../amo/fiche.json) ;
3. une fois approuvée par Mozilla, télécharge le `.xpi` signé et crée la
   release GitHub. En relecture : le passage finit en vert ; le suivant reprend.

Secrets `AMO_API_KEY` et `AMO_API_SECRET`, passés à la seule étape qui soumet.
Mozilla n’accepte un numéro de version **qu’une fois**, tous canaux confondus.

## Paquet de déploiement

`npm run paquet` produit `web-ext-artifacts/mister-no-noise-<version>/` :

| Fichier                         | Rôle                                         |
| ------------------------------- | -------------------------------------------- |
| `mister-no-noise-<version>.xpi` | signé par Mozilla — seulement avec les clés  |
| `mister-no-noise-<version>.zip` | non signé                                    |
| `INSTALLER.md`                  | guide d’installation                         |
| `policies.json`                 | stratégie d’entreprise (installation forcée) |
| `SHA256SUMS`                    | empreintes                                   |

Modèles dans [`deploiement/`](../deploiement/).

> Avec les clés d’API (environnement ou `.env`), `npm run paquet` **soumet**
> la version à AMO. Sans clés, le paquet sort sans `.xpi`.

## Fiche addons.mozilla.org

[`fiche-amo.yml`](../.github/workflows/fiche-amo.yml) la resynchronise quand
ses sources bougent sur `main`, et chaque jour.

| Sur la fiche           | Source                                                        |
| ---------------------- | ------------------------------------------------------------- |
| nom, résumé            | `extName`, `extDescription`                                   |
| description, catégorie | [`amo/fiche.json`](../amo/fiche.json)                         |
| page d’accueil         | `homepage_url` du manifeste                                   |
| icône                  | `extension/icons/icone-128.png`                               |
| captures               | [`amo/captures.json`](../amo/captures.json) + `amo/captures/` |

Régénérer les captures : `npm run captures` (Chrome + `playwright-core`).

## Clés de stockage (1.4.0+)

Config et stats : `mnn.config` / `mnn.stats`. Les anciennes clés `shc.*` sont
migrées une fois au chargement, puis retirées. Réglages optionnellement
recopiés dans `storage.sync` sous `mnn.settings` (les règles restent locales).

## Extension sœur

[Sans prix](https://github.com/mister-guiiug/mister-no-prices) — même auteur,
même schéma de publication et de fiche. Les scripts `amo.mjs` / `fiche-amo.mjs`
/ `paquet.mjs` sont volontairement jumeaux (seul l’`AGENT` et les chemins
diffèrent) : une correction dans l’un se reporte dans l’autre.
