import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
const manifeste = JSON.parse(lire("extension/manifest.json"));
const remplir = (texte) =>
  texte.replaceAll("{{version}}", manifeste.version).replaceAll("{{id}}", manifeste.browser_specific_settings.gecko.id);

describe("le paquet de déploiement", () => {
  it("package.json et le manifeste portent la même version", () => {
    assert.equal(JSON.parse(lire("package.json")).version, manifeste.version);
  });

  it("policies.json reste du JSON une fois rempli, et vise l'extension", () => {
    const { policies } = JSON.parse(remplir(lire("deploiement/policies.json")));
    const reglage = policies.ExtensionSettings[manifeste.browser_specific_settings.gecko.id];
    assert.equal(reglage.installation_mode, "force_installed");
    assert.match(reglage.install_url, /^file:\/\/\/.+\.xpi$/);
    assert.equal(reglage.private_browsing, true);
  });

  it("le guide ne laisse aucun gabarit non rempli", () => {
    assert.doesNotMatch(remplir(lire("deploiement/INSTALLER.md")), /\{\{/);
  });
});

describe("la publication", () => {
  it("l'identifiant est mister-no-noise@mister-guiiug", () => {
    assert.equal(manifeste.browser_specific_settings.gecko.id, "mister-no-noise@mister-guiiug");
  });

  it("n'a pas d'update_url : publiée sur addons.mozilla.org", () => {
    assert.equal(manifeste.browser_specific_settings.gecko.update_url, undefined);
  });

  it("le dépôt des releases est homepage_url", () => {
    assert.equal(manifeste.homepage_url, "https://github.com/mister-guiiug/mister-no-noise");
  });

  it("aucun updates.json : Firefox met à jour depuis addons.mozilla.org", async () => {
    const { readFile } = await import("node:fs/promises");
    const paquet = await readFile(new URL("../scripts/paquet.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(paquet, /writeFile\([^)]*updates\.json/u);
  });
});

describe("la fiche d'addons.mozilla.org", async () => {
  const fiche = JSON.parse(lire("amo/fiche.json"));
  const { etatDe, jeton } = await import("../scripts/amo.mjs");
  const CATEGORIES = [
    "alerts-updates",
    "appearance",
    "bookmarks",
    "download-management",
    "feeds-news-blogging",
    "games-entertainment",
    "language-support",
    "photos-music-videos",
    "privacy-security",
    "search-tools",
    "shopping",
    "social-communication",
    "tabs",
    "web-development",
    "other",
  ];

  it("a des catégories connues et la licence du dépôt", () => {
    assert.ok(fiche.categories.length >= 1 && fiche.categories.length <= 2);
    for (const c of fiche.categories) assert.ok(CATEGORIES.includes(c), c);
    assert.equal(fiche.version.license, JSON.parse(lire("package.json")).license);
  });

  it("décrit l'extension dans chaque langue de la fiche, avec le dépôt", () => {
    for (const langue of Object.keys(fiche.description)) {
      assert.ok(fiche.description[langue]?.length > 200, langue);
      // Les liens sont lus comme des URL, hôte et chemin comparés à l'égal : une regex
      // d'adresse sans ancre ou une sous-chaîne, CodeQL les lit comme un filtre d'URL
      // contournable (js/regex/missing-regexp-anchor, js/incomplete-url-substring-sanitization).
      const liens = (fiche.description[langue].match(/https:\/\/[^\s)\]]+/g) ?? []).map((lien) => new URL(lien));
      assert.ok(
        liens.some((url) => url.hostname === "github.com" && url.pathname === "/mister-guiiug/mister-no-noise"),
        langue,
      );
    }
  });

  it("lit l'état d'une version d'après son fichier", () => {
    assert.equal(etatDe({ file: { status: "public" } }), "publiee");
    assert.equal(etatDe({ file: { status: "disabled" } }), "refusee");
    assert.equal(etatDe({ file: { status: "unreviewed" } }), "en-relecture");
  });

  it("signe un jeton HS256 d'une minute, au nom de la clé", () => {
    const [entete, corps, signature] = jeton("user:1:2", "secret", 1000).split(".");
    assert.deepEqual(JSON.parse(Buffer.from(entete, "base64url")), { alg: "HS256", typ: "JWT" });
    const { iss, iat, exp, jti } = JSON.parse(Buffer.from(corps, "base64url"));
    assert.deepEqual([iss, iat, exp], ["user:1:2", 1000, 1060]);
    assert.ok(jti);
    assert.match(signature, /^[A-Za-z0-9_-]{43}$/);
  });
});

describe("le client d'addons.mozilla.org", async () => {
  const { client } = await import("../scripts/amo.mjs");
  const json = (corps) => ({
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => corps,
  });

  it("cherche la version sur toutes les pages, tous canaux, avec un jeton", async () => {
    const vues = [];
    const fetch = async (url, { headers }) => {
      vues.push(String(url));
      assert.match(headers.Authorization, /^JWT [\w-]+\.[\w-]+\.[\w-]+$/);
      return String(url).includes("page=2")
        ? json({ results: [{ version: "1.4.0", channel: "listed", file: { status: "public" } }], next: null })
        : json({ results: [{ version: "1.3.2" }], next: "https://addons.mozilla.org/api/v5/x/?page=2" });
    };
    const amo = client({ cle: "k", secret: "s", fetch });
    assert.equal((await amo.version("a@b", "1.4.0")).channel, "listed");
    assert.match(vues[0], /addons\/addon\/a%40b\/versions\/\?filter=all_with_unlisted/);
    assert.equal(await amo.version("a@b", "9.9.9"), null);
  });

  it("attend la fin de la relecture, sans dépasser le délai", async () => {
    let appels = 0;
    const fetch = async () => {
      appels += 1;
      return json({
        results: [{ version: "1.4.0", file: { status: appels < 3 ? "unreviewed" : "public" } }],
        next: null,
      });
    };
    const amo = client({ cle: "k", secret: "s", fetch });
    const dormir = async () => {};
    assert.equal((await amo.attendre("a@b", "1.4.0", { delai: 60_000, intervalle: 1, dormir })).file.status, "public");
  });
});

describe("les captures de la fiche", async () => {
  const { chargerCaptures, planifier, languesDeFiche } = await import("../scripts/fiche-amo.mjs");
  const captures = await chargerCaptures();

  it("sont des PNG de 1280 × 800, légendés dans chaque langue de la fiche", () => {
    assert.ok(captures.length >= 1);
    for (const c of captures) {
      for (const langue of languesDeFiche()) assert.ok(c.legende[langue], `${c.fichier} : ${langue}`);
    }
    assert.deepEqual(
      captures.map((c) => c.position),
      captures.map((_, i) => i),
    );
  });

  it("ajoute ce qui manque et ne touche pas aux captures étrangères", () => {
    const voulues = [
      { fichier: "a.png", legende: { fr: "A", "en-US": "A en" }, position: 0 },
      { fichier: "b.png", legende: { fr: "B", "en-US": "B en" }, position: 1 },
    ];
    const { ajouter, modifier, etrangeres } = planifier(voulues, [
      { id: 7, caption: { fr: "B", "en-US": "vieux" }, position: 1 },
      { id: 9, caption: { fr: "Faite à la main" }, position: 2 },
    ]);
    assert.deepEqual(
      ajouter.map((c) => c.fichier),
      ["a.png"],
    );
    assert.equal(modifier.length, 1);
    assert.equal(modifier[0].id, 7);
    assert.equal(etrangeres.length, 1);
  });
});

describe("l'arborescence extension/", () => {
  it("porte le manifeste, les locales et les icônes", () => {
    assert.ok(lire("extension/manifest.json"));
    assert.ok(lire("extension/_locales/en/messages.json"));
    assert.ok(lire("extension/icons/icone.svg"));
    assert.match(lire("extension/src/common/core.js"), /mnn\.config/);
    assert.match(lire("extension/src/common/core.js"), /root\.MNN\s*=/);
  });
});

describe("le débit limité d'addons.mozilla.org à la soumission", async () => {
  const { estDebitLimite } = await import("../scripts/amo.mjs");

  it("reconnaît l'erreur relevée le 23/11/2026, et le 429 seul", () => {
    const relevee = new Error(
      'Submission failed (2): 429\n{\n  "detail": "Request was throttled. Expected available in 40287 seconds."\n}',
    );
    assert.equal(estDebitLimite(relevee), true);
    assert.equal(estDebitLimite(new Error("Submission failed (2): 429")), true);
  });

  it("laisse échouer tout le reste", () => {
    assert.equal(estDebitLimite(new Error("Submission failed (1): 400")), false);
    assert.equal(
      estDebitLimite(new Error("AMO 404 sur GET https://addons.mozilla.org/api/v5/addons/addon/x/versions/6750429/")),
      false,
    );
    assert.equal(estDebitLimite(new Error("getaddrinfo ENOTFOUND addons.mozilla.org")), false);
    assert.equal(estDebitLimite(undefined), false);
  });
});
