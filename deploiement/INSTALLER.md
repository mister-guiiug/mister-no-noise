# Installer « Sans bruit » {{version}}

Extension Firefox qui retire le bruit récurrent de l’historique de navigation —
les sites que vous choisissez, selon vos règles. Firefox 140 ou plus récent.

| Fichier du paquet                 | À quoi il sert                                                       |
| --------------------------------- | -------------------------------------------------------------------- |
| `mister-no-noise-{{version}}.xpi` | l’extension **signée par Mozilla** : installation durable (§ 1, § 3) |
| `mister-no-noise-{{version}}.zip` | l’extension non signée : essai, ou Firefox Developer Edition (§ 2)   |
| `policies.json`                   | imposer l’extension sur un ordinateur (§ 3)                          |
| `SHA256SUMS`                      | vérifier que les fichiers n’ont pas été altérés (§ 4)                |

Le `.xpi` n’existe que si le paquet a été signé. S’il manque, passer au § 2.

**Le plus simple** : l’extension est publiée sur addons.mozilla.org. Ouvrir
<https://addons.mozilla.org/firefox/addon/mister-no-noise@mister-guiiug/> dans
Firefox, puis **Ajouter à Firefox**.

## 1. Installer le fichier signé

1. Dans Firefox, ouvrir **≡ → Extensions et thèmes** (`about:addons`).
2. Cliquer sur la **roue dentée** → **Installer un module depuis un fichier…**
3. Choisir `mister-no-noise-{{version}}.xpi`, puis **Ajouter**.

L’icône apparaît dans la barre d’outils. Un clic ouvre le popup : interrupteur,
nettoyage immédiat, modes temps réel et périodique.

**Mises à jour** : automatiques depuis addons.mozilla.org. Releases :
<https://github.com/mister-guiiug/mister-no-noise/releases>

## 2. Installer le fichier non signé (.zip)

- **Temporaire** : `about:debugging#/runtime/this-firefox` → **Charger un module
  complémentaire temporaire…** → `mister-no-noise-{{version}}.zip`.
- **Durablement**, seulement Developer Edition / Nightly / ESR :
  `xpinstall.signatures.required` → `false`, puis installer le `.zip` comme au § 1.

## 3. Imposer l’extension (stratégie d’entreprise)

1. Copier `mister-no-noise-{{version}}.xpi` dans un dossier stable, renommé
   `C:\Firefox\mister-no-noise.xpi` (sans numéro de version).
2. Corriger `install_url` dans `policies.json` si besoin.
3. Copier `policies.json` dans le dossier `distribution` de Firefox :

   | Système | Dossier                                                      |
   | ------- | ------------------------------------------------------------ |
   | Windows | `C:\Program Files\Mozilla Firefox\distribution\`             |
   | macOS   | `/Applications/Firefox.app/Contents/Resources/distribution/` |
   | Linux   | `/etc/firefox/policies/`                                     |

4. Redémarrer Firefox. `about:policies` doit afficher **Active**.

## 4. Vérifier les empreintes

```bash
sha256sum -c SHA256SUMS
```

Sur Windows (PowerShell) :

```powershell
Get-FileHash mister-no-noise-{{version}}.xpi -Algorithm SHA256
```
