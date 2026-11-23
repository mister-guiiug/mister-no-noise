#!/usr/bin/env node
/**
 * Le paquet de déploiement : zip, xpi signé (si clés AMO), INSTALLER.md,
 * policies.json, SHA256SUMS. Soumet au canal listed.
 *
 * Pas d'`updates.json` : l'extension n'a jamais été distribuée hors
 * d'addons.mozilla.org, et Firefox met à jour une version du catalogue depuis
 * le catalogue, `.xpi` de release compris. mister-no-prices le garde pour ses
 * installations faites depuis les releases jusqu'à sa 1.7.0.
 *
 *   node scripts/paquet.mjs
 *
 * Secrets : WEB_EXT_API_KEY, WEB_EXT_API_SECRET (ou `.env`).
 * EXIGER_SIGNATURE=1 échoue sans clés. ATTENTE_MINUTES (défaut 15).
 * Écrit `signe=oui|non` dans GITHUB_OUTPUT si présent.
 */
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import webExt from "web-ext";
import { API, client, estDebitLimite, etatDe } from "./amo.mjs";

const racine = path.resolve(import.meta.dirname, "..");
const source = path.join(racine, "extension");

try {
  process.loadEnvFile(path.join(racine, ".env"));
} catch (erreur) {
  if (erreur.code !== "ENOENT") throw erreur;
}
const lireJson = async (fichier) => JSON.parse(await readFile(fichier, "utf8"));
const sortie = async (cle, valeur) => {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${cle}=${valeur}\n`);
};

const manifeste = await lireJson(path.join(source, "manifest.json"));
const { version: versionPaquet } = await lireJson(path.join(racine, "package.json"));
const { version } = manifeste;
const id = manifeste.browser_specific_settings.gecko.id;
if (versionPaquet !== version) {
  throw new Error(`package.json (${versionPaquet}) et manifest.json (${version}) divergent`);
}

const nom = `mister-no-noise-${version}`;
/** Le nom du `.xpi` signé d'une version : celui que la release joint. */
const nomXpi = (v) => `mister-no-noise-${v}.xpi`;
const dossier = path.join(racine, "web-ext-artifacts", nom);
await rm(dossier, { recursive: true, force: true });
await mkdir(dossier, { recursive: true });

const empreinte = async (fichier) =>
  createHash("sha256")
    .update(await readFile(path.join(dossier, fichier)))
    .digest("hex");

await webExt.cmd.build(
  {
    sourceDir: source,
    artifactsDir: dossier,
    filename: `${nom}.zip`,
    overwriteDest: true,
  },
  { shouldExitProgram: false },
);
const extensions = [`${nom}.zip`];

const { WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret } = process.env;
if (apiKey && apiSecret) {
  const amo = client({ cle: apiKey, secret: apiSecret });
  let enLigne = await amo.version(id, version);
  if (enLigne) {
    console.log(`${version} est déjà sur addons.mozilla.org (canal ${enLigne.channel}) : pas de nouvelle soumission.`);
  } else {
    const telechargement = path.join(dossier, ".signature");
    try {
      await webExt.cmd.sign(
        {
          sourceDir: source,
          artifactsDir: telechargement,
          apiKey,
          apiSecret,
          channel: "listed",
          amoBaseUrl: API,
          amoMetadata: path.join(racine, "amo", "fiche.json"),
          approvalTimeout: 0,
        },
        { shouldExitProgram: false },
      );
    } catch (erreur) {
      // AMO limite le débit des soumissions (429) : sortir en vert, le passage
      // planifié reprendra.
      const detail = String(erreur?.message ?? erreur);
      if (estDebitLimite(erreur)) {
        console.log(
          `::notice::AMO limite le débit sur la soumission : reprise au prochain passage. (${detail.slice(0, 200)})`,
        );
        await sortie("signe", "non");
        await rm(dossier, { recursive: true, force: true });
        process.exit(0);
      }
      throw erreur;
    }
    await rm(telechargement, { recursive: true, force: true });
  }
  const minutes = Number(process.env.ATTENTE_MINUTES ?? 15);
  enLigne = await amo.attendre(id, version, { delai: minutes * 60_000 });
  if (!enLigne) throw new Error(`${version} introuvable sur addons.mozilla.org après la soumission`);
  if (enLigne.channel !== "listed") {
    throw new Error(
      `${version} a été signée hors catalogue (canal ${enLigne.channel}) : monter la version pour la publier`,
    );
  }
  const etat = etatDe(enLigne);
  if (etat === "refusee") {
    throw new Error(`${version} a été refusée par addons.mozilla.org`);
  }
  if (etat === "en-relecture") {
    console.log(
      `::notice::${version} est soumise à addons.mozilla.org et attend sa relecture : pas de paquet ni de release pour l'instant. Le prochain passage reprendra.`,
    );
    await sortie("signe", "non");
    await rm(dossier, { recursive: true, force: true });
    process.exit(0);
  }
  await amo.telecharger(enLigne, path.join(dossier, nomXpi(version)));
  extensions.push(nomXpi(version));
} else if (process.env.EXIGER_SIGNATURE) {
  throw new Error("EXIGER_SIGNATURE : WEB_EXT_API_KEY et WEB_EXT_API_SECRET manquent");
} else {
  console.warn("Sans clés d'API Mozilla : paquet SANS .xpi signé.");
}

const remplir = (texte) => texte.replaceAll("{{version}}", version).replaceAll("{{id}}", id);
const annexes = ["INSTALLER.md", "policies.json"];
for (const fichier of annexes) {
  const modele = await readFile(path.join(racine, "deploiement", fichier), "utf8");
  await writeFile(path.join(dossier, fichier), remplir(modele));
}
JSON.parse(await readFile(path.join(dossier, "policies.json"), "utf8"));

const empreintes = [];
for (const fichier of extensions) empreintes.push(`${await empreinte(fichier)}  ${fichier}\n`);
await writeFile(path.join(dossier, "SHA256SUMS"), empreintes.join(""));

console.log(`\nPaquet ${nom} : ${path.relative(racine, dossier)}`);
for (const fichier of [...extensions, ...annexes, "SHA256SUMS"]) console.log(`  ${fichier}`);
await sortie("signe", extensions.includes(nomXpi(version)) ? "oui" : "non");
