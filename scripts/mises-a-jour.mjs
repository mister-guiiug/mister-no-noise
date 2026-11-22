/**
 * Le manifeste de mise à jour (`updates.json`) joint à chaque release pour
 * les copies installées hors catalogue. Les versions listées sur AMO n'ont
 * pas d'`update_url` : Firefox les met à jour depuis addons.mozilla.org.
 */

/** L'adresse du dépôt GitHub, tirée de `homepage_url`. */
export function depotDe(manifeste) {
  const url = manifeste.homepage_url ?? "";
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(url)) {
    throw new Error(`homepage_url doit être l'adresse d'un dépôt GitHub, pas « ${url} »`);
  }
  return url;
}

/** Le nom du `.xpi` signé d'une version : celui que la release joint. */
export const nomXpi = (version) => `mister-no-noise-${version}.xpi`;

/**
 * @param {object} manifeste le manifest.json de l'extension
 * @param {string} empreinte SHA-256 du `.xpi` signé, en hexadécimal
 */
export function manifesteDeMiseAJour(manifeste, empreinte) {
  if (!/^[0-9a-f]{64}$/.test(empreinte)) throw new Error(`empreinte SHA-256 invalide : ${empreinte}`);
  const { id, strict_min_version } = manifeste.browser_specific_settings.gecko;
  const { version } = manifeste;
  return {
    addons: {
      [id]: {
        updates: [
          {
            version,
            update_link: `${depotDe(manifeste)}/releases/download/v${version}/${nomXpi(version)}`,
            update_hash: `sha256:${empreinte}`,
            applications: { gecko: { strict_min_version } },
          },
        ],
      },
    },
  };
}
