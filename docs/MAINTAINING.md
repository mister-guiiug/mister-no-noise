# Maintaining

[Français](MAINTENANCE.fr.md) · [Back to the README](../README.md)

Releasing, deploying, keeping the listing up to date.

## Releasing a version

Publishing is **automated**: bump `version` in
[`extension/manifest.json`](../extension/manifest.json) and `package.json` (the
tests keep them aligned), merge the pull request. A pull request that does not
change the version publishes nothing.

[`publication.yml`](../.github/workflows/publication.yml), on every push to
`main` and every three hours:

1. checks whether release `v<version>` exists; if so, stops;
2. tests, validates (`web-ext lint`), then **submits** the version to
   addons.mozilla.org (“listed” channel), with [`amo/fiche.json`](../amo/fiche.json);
3. once Mozilla approves it, downloads the signed `.xpi` and publishes release
   `v<version>`. While under review the run ends green; the next scheduled run
   picks it up.

Secrets `AMO_API_KEY` and `AMO_API_SECRET` are only passed to the submitting
step. Mozilla accepts a version number **once** across all channels.

## Deployment package

`npm run paquet` builds `web-ext-artifacts/mister-no-noise-<version>/`:

| File | Purpose |
| ---- | ------- |
| `mister-no-noise-<version>.xpi` | signed by Mozilla — only with API keys |
| `mister-no-noise-<version>.zip` | unsigned extension |
| `INSTALLER.md` | step-by-step install guide (French) |
| `policies.json` | enterprise policy that force-installs the extension |
| `updates.json` | for copies installed from GitHub releases |
| `SHA256SUMS` | checksums |

Templates live in [`deploiement/`](../deploiement/).

> With API keys in the environment or `.env`, `npm run paquet` **submits** the
> version to AMO. Without keys, the package comes out without a `.xpi`.

## The addons.mozilla.org listing

[`fiche-amo.yml`](../.github/workflows/fiche-amo.yml) syncs the listing when
its sources change on `main`, and daily.

| On the listing | Comes from |
| -------------- | ---------- |
| name, summary | `extName`, `extDescription` per language |
| description, category | [`amo/fiche.json`](../amo/fiche.json) |
| homepage | the manifest’s `homepage_url` |
| icon | `extension/icons/icone-128.png` |
| screenshots | [`amo/captures.json`](../amo/captures.json) + `amo/captures/` (1280×800) |

Regenerate screenshots: `npm run captures` (Chrome + `playwright-core`).

## Storage keys (1.4.0+)

Config and stats use `mnn.config` / `mnn.stats`. Older installs with
`shc.*` are migrated once on load, then the legacy keys are removed.

## Sister extension

[No Prices](https://github.com/mister-guiiug/mister-no-prices) — same author,
same publishing and listing tooling pattern.
