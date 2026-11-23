"use strict";
/* Unit tests for the pure matching logic (run with `node --test`). */
const assert = require("node:assert");
const { test } = require("node:test");

// Minimal WebExtension shims so core.js can load outside the browser.
global.self = global;
global.browser = { i18n: { getMessage: () => "", getUILanguage: () => "en" } };
require("../extension/src/common/core.js");
const S = global.MNN;

test("contains matches a substring, case-insensitive by default", () => {
  const r = S.rule("contains", "facebook.com");
  assert.equal(S.patternMatches(r, "https://www.facebook.com/feed", false), true);
  assert.equal(S.patternMatches(r, "https://FACEBOOK.com/x", false), true);
  assert.equal(S.patternMatches(r, "https://example.com/", false), false);
});

test("case sensitivity is honored", () => {
  const r = S.rule("contains", "ABC");
  assert.equal(S.patternMatches(r, "https://x/abc", false), true);
  assert.equal(S.patternMatches(r, "https://x/abc", true), false);
  assert.equal(S.patternMatches(r, "https://x/ABC", true), true);
});

test("domain covers subdomains but avoids look-alikes", () => {
  const r = S.rule("domain", "google.com");
  assert.equal(S.patternMatches(r, "https://photos.google.com/a", false), true);
  assert.equal(S.patternMatches(r, "https://www.google.com/", false), true);
  assert.equal(S.patternMatches(r, "https://google.com/", false), true);
  assert.equal(S.patternMatches(r, "https://notgoogle.com/", false), false);
  assert.equal(S.patternMatches(r, "https://google.com.evil.test/", false), false);
});

test("wildcard translates * to .*", () => {
  const r = S.rule("wildcard", "*.google.com/photos*");
  assert.equal(S.patternMatches(r, "https://x.google.com/photos/1", false), true);
  assert.equal(S.patternMatches(r, "https://x.google.com/mail", false), false);
});

test("regex works and invalid regex never throws", () => {
  const ok = S.rule("regex", "^https://x\\.test/\\d+$");
  assert.equal(S.patternMatches(ok, "https://x.test/42", false), true);
  assert.equal(S.patternMatches(ok, "https://x.test/ab", false), false);
  const bad = S.rule("regex", "("); // invalid
  assert.equal(S.patternMatches(bad, "anything", false), false);
  assert.equal(S.ruleInvalid(bad, false), true);
});

test("decide: allow rule protects against a matching block rule", () => {
  const rules = [S.rule("domain", "google.com"), S.rule("contains", "/maps", "", { kind: "allow" })];
  assert.equal(S.decide(rules, "https://www.google.com/search", false, "sweep").value, "google.com");
  assert.equal(S.decide(rules, "https://www.google.com/maps/place", false, "sweep"), null);
});

test("decide: realtime skips periodic-only and age-limited rules", () => {
  const realtimeOnly = [S.rule("domain", "a.test", "", { mode: "periodic" })];
  assert.equal(S.decide(realtimeOnly, "https://a.test/", false, "realtime"), null);
  assert.equal(S.decide(realtimeOnly, "https://a.test/", false, "sweep").value, "a.test");
  const aged = [S.rule("domain", "b.test", "", { olderThanDays: 30 })];
  assert.equal(S.decide(aged, "https://b.test/", false, "realtime"), null);
});

test("evaluateUrl reports blocks, allows and verdict", () => {
  const rules = [S.rule("domain", "x.test"), S.rule("contains", "/keep", "", { kind: "allow" })];
  const v1 = S.evaluateUrl(rules, "https://x.test/a", false);
  assert.equal(v1.deleted, true);
  const v2 = S.evaluateUrl(rules, "https://x.test/keep", false);
  assert.equal(v2.deleted, false);
  assert.equal(v2.allows.length, 1);
});

test("parseLegacy strips % and skips comments", () => {
  const rules = S.parseLegacy("%facebook.com%\n# a comment\n\n%amazon.fr%");
  assert.equal(rules.length, 2);
  assert.equal(rules[0].value, "facebook.com");
  assert.equal(rules[1].value, "amazon.fr");
  assert.equal(rules[0].type, "contains");
});

test("normalizeConfig migrates v1 rules and applies defaults", () => {
  const cfg = S.normalizeConfig({ rules: [{ type: "contains", value: "x" }] });
  assert.equal(cfg.version, 2);
  assert.equal(cfg.rules[0].kind, "block");
  assert.equal(cfg.rules[0].mode, "both");
  assert.equal(cfg.rules[0].olderThanDays, 0);
  assert.equal(cfg.settings.confirmManual, true);
});

test("normalizeConfig hardens against oversized imports", () => {
  const many = Array.from({ length: S.MAX_RULES + 50 }, (_, i) => ({ type: "contains", value: "v" + i }));
  const cfg = S.normalizeConfig({ rules: many });
  assert.equal(cfg.rules.length, S.MAX_RULES);
  const long = S.normalizeConfig({ rules: [{ type: "contains", value: "a".repeat(S.MAX_VALUE_LEN + 100) }] });
  assert.equal(long.rules[0].value.length, S.MAX_VALUE_LEN);
});

test("regexSelfTest flags invalid patterns", () => {
  assert.equal(S.regexSelfTest("(", false).valid, false);
  assert.equal(S.regexSelfTest("abc", false).valid, true);
  assert.equal(S.regexSelfTest("abc", false).safe, true);
});

test("ReDoS guard: catastrophic (exponential) regex is flagged in bounded time", () => {
  S.clearCache();
  const t0 = Date.now();
  const res = S.regexSelfTest("(a+)+$", false);
  const took = Date.now() - t0;
  assert.equal(res.valid, true);
  assert.equal(res.safe, false);
  assert.ok(took < 2000, "guard finished in " + took + "ms (must never hang)");
});

test("ReDoS guard: high-polynomial regex is flagged in bounded time", () => {
  S.clearCache();
  const t0 = Date.now();
  const res = S.regexSelfTest(".*.*.*.*!", false);
  const took = Date.now() - t0;
  assert.equal(res.valid, true);
  assert.equal(res.safe, false);
  assert.ok(took < 2000, "guard finished in " + took + "ms (must never hang)");
});

test("ReDoS guard: unsafe regex is skipped at match time; literals are safe by construction", () => {
  S.clearCache();
  const bad = S.rule("regex", "(a+)+$");
  assert.equal(S.ruleUnsafe(bad, false), true);
  assert.equal(S.patternMatches(bad, "https://x.test/aaaa", false), false); // skipped, not evaluated
  const w = S.rule("wildcard", "*a*b*c*d*e*");
  assert.equal(S.ruleUnsafe(w, false), false);
  assert.equal(S.patternMatches(w, "https://x.test/aXbXcXdXe", false), true);
  const c = S.rule("contains", "(a+)+$"); // literal text here, not a regex
  assert.equal(S.ruleUnsafe(c, false), false);
  assert.equal(S.patternMatches(c, "https://x.test/(a+)+$", false), true);
});

test("ReDoS guard: cumulative budget marks later patterns unsafe instead of spending time", () => {
  S.clearCache();
  // Exhaust the budget with catastrophic patterns (each individually bounded)...
  for (let i = 0; i < 400; i++) {
    const r = S.regexSelfTest("(a+)+" + i + "$", false);
    if (!r.safe && i > 0) {
      /* keep going until the budget trips */
    }
  }
  // ...then a trivial pattern is reported unsafe (conservative), not tested.
  const t0 = Date.now();
  const res = S.regexSelfTest("abc-post-budget", false);
  assert.ok(Date.now() - t0 < 50, "post-budget test must be instantaneous");
  assert.equal(res.valid, true);
  assert.equal(res.safe, false);
  S.clearCache(); // restore the budget for any following test
});

test("storage keys use the mnn. prefix", () => {
  assert.equal(S.CONFIG_KEY, "mnn.config");
  assert.equal(S.STATS_KEY, "mnn.stats");
});

test("normalizeConfig keeps empty draft rules (Add button)", () => {
  const cfg = S.normalizeConfig({
    rules: [S.rule("contains", "kept.com"), S.rule("contains", "", "")],
  });
  assert.equal(cfg.rules.length, 2);
  assert.equal(cfg.rules[1].value, "");
  assert.equal(S.patternMatches(cfg.rules[1], "https://anything.test/", false), false);
});

test("estActif respects pauseJusqua", () => {
  const now = Date.now();
  assert.equal(S.estActif({ enabled: true, pauseJusqua: 0 }, now), true);
  assert.equal(S.estActif({ enabled: true, pauseJusqua: now + 60_000 }, now), false);
  assert.equal(S.estActif({ enabled: false, pauseJusqua: 0 }, now), false);
});

test("rulesFromPack skips duplicates already present", () => {
  const existing = [S.rule("domain", "facebook.com", "Social")];
  const added = S.rulesFromPack("social", existing);
  assert.ok(added.every((r) => r.value !== "facebook.com"));
  assert.ok(added.some((r) => r.value === "instagram.com"));
});
