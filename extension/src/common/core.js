'use strict';
/*
 * No Noise — Firefox history cleaner
 * core.js: shared logic (storage, rules, URL matching, i18n helpers).
 * Loaded in the background (event page / service worker) and the popup/options
 * pages. Exposes a global `MNN` object.
 *
 * @typedef {Object} Rule
 * @property {string}  id            Stable identifier.
 * @property {boolean} enabled       Whether the rule participates in matching.
 * @property {string}  kind          'block' (delete) or 'allow' (protect/keep).
 * @property {string}  type          'contains' | 'domain' | 'wildcard' | 'regex'.
 * @property {string}  value         Pattern.
 * @property {string}  note          Free-form note / category.
 * @property {string}  mode          'both' | 'realtime' | 'periodic'.
 * @property {number}  olderThanDays Only delete matches older than N days (0 = no age limit).
 *
 * @typedef {Object} Settings
 * @property {boolean} enabled
 * @property {boolean} realtime
 * @property {boolean} periodic
 * @property {number}  intervalMinutes
 * @property {boolean} dryRun
 * @property {boolean} caseSensitive
 * @property {boolean} notifications
 * @property {string}  notificationDetail 'count' | 'host'
 * @property {string}  logDetail          'host' | 'full' | 'off'
 * @property {boolean} confirmManual
 * @property {number}  massThreshold
 * @property {boolean} contextMenu
 */
(function (root) {
  const CONFIG_KEY = 'mnn.config'; // { version, settings, rules }  — written by the UI
  const STATS_KEY = 'mnn.stats';   // { totalDeleted, lastRun, ... } — written by the background
  // Clés avant le renommage SHC→MNN (1.4.0) : lues une fois, puis migrées.
  const LEGACY_CONFIG_KEY = 'shc.config';
  const LEGACY_STATS_KEY = 'shc.stats';
  const LOG_MAX = 300;
  const MAX_RULES = 5000;          // import hardening
  const MAX_VALUE_LEN = 2000;

  const DEFAULT_SETTINGS = {
    enabled: true,
    realtime: true,
    periodic: false,
    intervalMinutes: 30,
    dryRun: false,
    caseSensitive: false,
    notifications: true,
    notificationDetail: 'count', // 'count' | 'host'
    logDetail: 'host',           // 'host' | 'full' | 'off'
    confirmManual: true,
    massThreshold: 500,
    contextMenu: true,           // show the "Add this site" right-click entry
  };

  const DEFAULT_STATS = { totalDeleted: 0, lastRun: null, lastRunDeleted: 0, log: [] };

  const RULE_TYPE_KEYS = ['contains', 'domain', 'wildcard', 'regex'];
  const RULE_TYPE_FALLBACK = {
    contains: 'Contains', domain: 'Domain', wildcard: 'Wildcard (*)', regex: 'Regular expression',
  };
  const RULE_KINDS = ['block', 'allow'];
  const RULE_MODES = ['both', 'realtime', 'periodic'];

  // --- i18n helpers -------------------------------------------------------
  function t(key, subs) {
    try { return browser.i18n.getMessage(key, subs) || ''; } catch (e) { return ''; }
  }
  function formatDate(ts) {
    try { return new Date(ts).toLocaleString(browser.i18n.getUILanguage()); }
    catch (e) { return new Date(ts).toLocaleString(); }
  }
  function localizeDom(rootEl) {
    rootEl = rootEl || document;
    rootEl.querySelectorAll('[data-i18n]').forEach((el) => {
      const m = t(el.getAttribute('data-i18n')); if (m) el.textContent = m;
    });
    rootEl.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const m = t(el.getAttribute('data-i18n-placeholder')); if (m) el.setAttribute('placeholder', m);
    });
    rootEl.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const m = t(el.getAttribute('data-i18n-title'));
      if (m) { el.setAttribute('title', m); el.setAttribute('aria-label', m); }
    });
    try { document.documentElement.lang = browser.i18n.getUILanguage(); } catch (e) { /* no document */ }
  }
  function ruleTypeLabel(type) { return t('ruleType_' + type) || RULE_TYPE_FALLBACK[type] || type; }

  // --- rules --------------------------------------------------------------
  function makeId() { return 'r_' + Math.random().toString(36).slice(2, 10); }

  /** @returns {Rule} */
  function rule(type, value, note, extra) {
    return Object.assign({
      id: makeId(), enabled: true, kind: 'block',
      type: type || 'contains', value: value || '', note: note || '',
      mode: 'both', olderThanDays: 0,
    }, extra || {});
  }

  function defaultRules() {
    const social = t('noteSocial') || 'Social media';
    const google = t('noteGoogle') || 'Google';
    return [
      rule('domain', 'facebook.com', social),
      rule('contains', 'www.google.com', google),
      rule('contains', 'www.google.fr', google),
      rule('contains', 'photos.google.com', google),
    ];
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function ruleToRegex(r, caseSensitive) {
    const flags = caseSensitive ? '' : 'i';
    if (r.type === 'regex') return new RegExp(r.value, flags);
    if (r.type === 'wildcard') {
      let out = '';
      for (const ch of r.value) out += ch === '*' ? '.*' : escapeRegex(ch);
      return new RegExp(out, flags);
    }
    return new RegExp(escapeRegex(r.value), flags); // contains: literal substring
  }

  function normDomain(domain, cs) {
    let d = String(domain).trim();
    if (!cs) d = d.toLowerCase();
    return d.replace(/^\*?\.?/, '').replace(/^www\./, '');
  }
  function hostMatchesDomain(url, d, cs) {
    let host;
    try { host = new URL(url).hostname; } catch (e) { return false; }
    if (!cs) host = host.toLowerCase();
    host = host.replace(/^www\./, '');
    return !!d && (host === d || host.endsWith('.' + d));
  }

  // --- compiled-matcher cache (T1) + ReDoS guard (S5) ---------------------
  const _cache = new Map();      // key -> matcher | null
  const SELFTEST_BUDGET_MS = 5000;
  let _selfTestBudget = SELFTEST_BUDGET_MS; // cumulative, reset with the cache
  function cacheKey(r, cs) { return r.type + ' ' + (cs ? '1' : '0') + ' ' + r.value; }
  function clearCache() { _cache.clear(); _selfTestBudget = SELFTEST_BUDGET_MS; }
  function nowMs() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  // Self-test for user regexes, designed so the test itself can never hang:
  // probe with SHORT inputs first and escalate. Exponential backtracking
  // (e.g. `(a+)+$`) explodes at ~22 chars; high-polynomial (e.g. `.*.*.*.*!`)
  // at a few hundred — both are caught within a bounded step count, long
  // before the input lengths where they could freeze the thread. Quadratic
  // patterns pass, which is tolerable on URL-sized inputs. A cumulative
  // budget bounds the total time spent testing (e.g. a malicious import full
  // of slow patterns); once exhausted, untested patterns count as unsafe.
  function regexSelfTest(pattern, cs) {
    let re;
    try { re = new RegExp(pattern, cs ? '' : 'i'); } catch (e) { return { valid: false, safe: false }; }
    if (_selfTestBudget <= 0) return { valid: true, safe: false };
    const t0 = nowMs();
    let safe = true;
    try {
      for (const n of [8, 12, 16, 22]) { // exponential probes (near-miss input)
        re.test('a'.repeat(n) + '!' + 'b'.repeat(n));
        if (nowMs() - t0 > 25) { safe = false; break; }
      }
      if (safe) {
        for (const n of [64, 128, 256, 512, 1024]) { // polynomial probes (URL-like input)
          re.test('https://sub.example.test/path/' + 'ab/'.repeat(Math.ceil(n / 3)) + '?q=x');
          if (nowMs() - t0 > 25) { safe = false; break; }
        }
      }
    } catch (e) { safe = false; }
    _selfTestBudget -= nowMs() - t0;
    return { valid: true, safe };
  }

  function buildMatcher(r, cs) {
    if (!r.value) return null;
    if (r.type === 'domain') { const d = normDomain(r.value, cs); return d ? { domain: d } : null; }
    // contains/wildcard compile to escaped literals (+ `.*`) — safe by
    // construction; only user-written regexes need the self-test.
    let unsafe = false;
    if (r.type === 'regex') {
      const test = regexSelfTest(r.value, cs);
      if (!test.valid) return null;
      unsafe = !test.safe;
    }
    let re; try { re = ruleToRegex(r, cs); } catch (e) { return null; }
    return { re, unsafe };
  }
  function matcher(r, cs) {
    const k = cacheKey(r, cs);
    if (_cache.has(k)) return _cache.get(k);
    const m = buildMatcher(r, cs);
    _cache.set(k, m);
    return m;
  }

  /** Whether a rule's pattern matches a URL (ignores kind/mode/age). */
  function patternMatches(r, url, cs) {
    if (!r || !r.value || !url) return false;
    const m = matcher(r, cs);
    if (!m || m.unsafe) return false; // unsafe regex is skipped at match time (surfaced in UI)
    if (m.domain) return hostMatchesDomain(url, m.domain, cs);
    try { return m.re.test(url); } catch (e) { return false; }
  }

  /** Is this rule's regex flagged unsafe? (for UI warnings) */
  function ruleUnsafe(r, cs) {
    if (r.type !== 'regex') return false; // other types are safe by construction
    const m = matcher(r, cs);
    return !!(m && m.unsafe);
  }
  function ruleInvalid(r, cs) {
    if (!r.value) return false;
    return matcher(r, cs) === null;
  }

  function blockEligibleFor(ctx) {
    if (ctx === 'realtime') return (r) => r.mode !== 'periodic' && !(r.olderThanDays > 0);
    return (r) => r.mode !== 'realtime'; // sweep / manual
  }

  /**
   * Decide the fate of a URL. Allow rules always protect. A block rule deletes
   * only if eligible for the context and no allow rule matches.
   * @returns {Rule|null} the winning block rule, or null to keep.
   */
  function decide(rules, url, cs, ctx) {
    const eligible = blockEligibleFor(ctx || 'sweep');
    let block = null;
    for (const r of rules) {
      if (!r.enabled) continue;
      if (!patternMatches(r, url, cs)) continue;
      if (r.kind === 'allow') return null; // protected
      if (!block && eligible(r)) block = r;
    }
    return block;
  }

  /** Rich evaluation for the URL tester. */
  function evaluateUrl(rules, url, cs) {
    const blocks = [], allows = [];
    for (const r of rules) {
      if (!r.enabled) continue;
      if (!patternMatches(r, url, cs)) continue;
      (r.kind === 'allow' ? allows : blocks).push(r);
    }
    return { blocks, allows, deleted: blocks.length > 0 && allows.length === 0 };
  }

  function parseLegacy(text) {
    const out = [];
    const note = t('noteImported') || 'imported';
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const value = line.replace(/^%+/, '').replace(/%+$/, '').trim();
      if (value) out.push(rule('contains', value, note));
    }
    return out;
  }

  function normRule(r) {
    if (!r || typeof r !== 'object') return null;
    let value = typeof r.value === 'string' ? r.value : '';
    if (!value) return null;
    if (value.length > MAX_VALUE_LEN) value = value.slice(0, MAX_VALUE_LEN);
    const type = RULE_TYPE_FALLBACK[r.type] ? r.type : 'contains';
    const kind = RULE_KINDS.includes(r.kind) ? r.kind : 'block';
    const mode = RULE_MODES.includes(r.mode) ? r.mode : 'both';
    let older = parseInt(r.olderThanDays, 10); if (!(older >= 0)) older = 0;
    return {
      id: typeof r.id === 'string' ? r.id : makeId(),
      enabled: r.enabled !== false,
      kind, type, value, mode, olderThanDays: older,
      note: typeof r.note === 'string' ? r.note.slice(0, 200) : '',
    };
  }

  function normalizeConfig(obj) {
    obj = obj || {};
    const settings = Object.assign({}, DEFAULT_SETTINGS, obj.settings || {});
    settings.intervalMinutes = Math.max(1, parseInt(settings.intervalMinutes, 10) || 30);
    settings.massThreshold = Math.max(0, parseInt(settings.massThreshold, 10) || 0);
    if (!['count', 'host'].includes(settings.notificationDetail)) settings.notificationDetail = 'count';
    if (!['host', 'full', 'off'].includes(settings.logDetail)) settings.logDetail = 'host';
    let rules = Array.isArray(obj.rules) ? obj.rules.map(normRule).filter(Boolean) : defaultRules();
    if (rules.length > MAX_RULES) rules = rules.slice(0, MAX_RULES);
    return { version: 2, settings, rules };
  }

  function normalizeStats(obj) {
    obj = obj || {};
    const log = Array.isArray(obj.log) ? obj.log.slice(-LOG_MAX) : [];
    return {
      totalDeleted: parseInt(obj.totalDeleted, 10) || 0,
      lastRun: obj.lastRun || null,
      lastRunDeleted: parseInt(obj.lastRunDeleted, 10) || 0,
      log,
    };
  }

  // --- storage ------------------------------------------------------------
  async function migrateKey(from, to) {
    const s = await browser.storage.local.get([from, to]);
    if (s[to] != null || s[from] == null) return s[to];
    await browser.storage.local.set({ [to]: s[from] });
    await browser.storage.local.remove(from);
    return s[from];
  }
  async function loadConfig() {
    const raw = await migrateKey(LEGACY_CONFIG_KEY, CONFIG_KEY);
    return normalizeConfig(raw);
  }
  async function saveConfig(cfg) {
    const norm = normalizeConfig(cfg);
    clearCache(); // rules/settings may have changed
    await browser.storage.local.set({ [CONFIG_KEY]: norm });
    await browser.storage.local.remove(LEGACY_CONFIG_KEY).catch(() => {});
    return norm;
  }
  async function loadStats() {
    const raw = await migrateKey(LEGACY_STATS_KEY, STATS_KEY);
    return normalizeStats(raw);
  }
  async function saveStats(stats) {
    const norm = normalizeStats(stats);
    await browser.storage.local.set({ [STATS_KEY]: norm });
    await browser.storage.local.remove(LEGACY_STATS_KEY).catch(() => {});
    return norm;
  }

  root.MNN = {
    CONFIG_KEY, STATS_KEY, LOG_MAX, MAX_RULES, MAX_VALUE_LEN,
    DEFAULT_SETTINGS, DEFAULT_STATS,
    RULE_TYPE_KEYS, RULE_TYPE_FALLBACK, RULE_KINDS, RULE_MODES,
    t, formatDate, localizeDom, ruleTypeLabel,
    makeId, rule, defaultRules, clone,
    patternMatches, hostMatchesDomain, decide, evaluateUrl,
    ruleUnsafe, ruleInvalid, regexSelfTest, clearCache,
    parseLegacy, normalizeConfig, normalizeStats,
    loadConfig, saveConfig, loadStats, saveStats,
  };
})(typeof self !== 'undefined' ? self : this);
