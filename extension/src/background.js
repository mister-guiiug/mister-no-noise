"use strict";
/*
 * No Noise — background (event page / service worker).
 * Real-time cleaning (onVisited), full/periodic sweeps, history analyzer,
 * per-rule preview, context menu and keyboard command. Sole writer of stats.
 */
const S = self.MNN;
const ALARM = "mnn-sweep";
const ALARM_PAUSE = "mnn-pause";
const DELETE_BATCH = 100;
const SCAN_CAP = 50000;
const DAY = 86400000;
const PREVIEW_TTL = 60000; // a preview's match list can be reused this long
const NOTIF_ID = "mnn-clean"; // fixed id: new notifications replace, not stack

let cfg = S.normalizeConfig(null);
let stats = S.normalizeStats(null);
let notifPerm = false;
let previewCache = null; // { token, matches, at } — lets cleanNow reuse the preview scan
const ready = init();

async function init() {
  cfg = await S.loadConfig();
  stats = await S.loadStats();
  await refreshNotifPerm();
  await setupAlarm();
  registerMenuClick();
  await setupMenu();
  await afficherEtat();
}

/** Pastille « off » quand coupée ou en pause minutée — comme No Prices. */
async function afficherEtat() {
  const pause = S.enPause(cfg.settings);
  const actif = S.estActif(cfg.settings);
  try {
    await browser.action.setBadgeBackgroundColor({ color: "#4b5563" });
    await browser.action.setBadgeText({ text: actif ? "" : S.t("badgeOff") || "off" });
    let title = S.t("titreActif") || "No Noise";
    if (!cfg.settings.enabled) title = S.t("titreInactif") || title;
    else if (pause) {
      const heure = new Date(cfg.settings.pauseJusqua).toLocaleTimeString(S.t("langue") || undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      title = S.t("titrePauseJusqua", [heure]) || title;
    }
    await browser.action.setTitle({ title });
    if (pause && browser.alarms) {
      browser.alarms.create(ALARM_PAUSE, { when: cfg.settings.pauseJusqua + 100 });
    } else if (browser.alarms) {
      await browser.alarms.clear(ALARM_PAUSE).catch(() => {});
    }
  } catch (e) {
    /* Android / pas d’action */
  }
}

// Serialize stats mutations (single writer). ------------------------------
let chain = Promise.resolve();
function withLock(fn) {
  const p = chain.then(fn, fn);
  chain = p.then(
    () => {},
    () => {},
  );
  return p;
}

// Debounced stats persistence (T2). ---------------------------------------
let saveTimer = null;
function scheduleStatsSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    S.saveStats(stats).catch(() => {});
  }, 1500);
}
async function flushStatsNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await S.saveStats(stats);
}

// Lifecycle ---------------------------------------------------------------
browser.runtime.onInstalled.addListener(async (details) => {
  const existing = await browser.storage.local.get(S.CONFIG_KEY);
  if (!existing[S.CONFIG_KEY]) await S.saveConfig(S.normalizeConfig(null));
  cfg = await S.loadConfig();
  stats = await S.loadStats();
  await refreshNotifPerm();
  await setupAlarm();
  registerMenuClick();
  await setupMenu();
  await afficherEtat();
  if (details && (details.reason === "install" || details.reason === "update")) {
    try {
      if (details.reason === "install") await browser.storage.local.set({ "mnn.firstRun": true });
      await browser.tabs.create({ url: browser.runtime.getURL("src/nouveautes/nouveautes.html") });
    } catch (e) {
      /* */
    }
  }
});

browser.runtime.onStartup.addListener(async () => {
  cfg = await S.loadConfig();
  stats = await S.loadStats();
  await refreshNotifPerm();
  await setupAlarm();
  registerMenuClick();
  await setupMenu();
  await afficherEtat();
});

// Keep the cache in sync with storage (the UI writes the config, we write stats).
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[S.SYNC_SETTINGS_KEY] && cfg.settings.syncSettings) {
    S.loadConfig()
      .then((c) => {
        cfg = c;
        setupAlarm().catch(() => {});
        afficherEtat().catch(() => {});
      })
      .catch(() => {});
    return;
  }
  if (area !== "local") return;
  if (changes[S.CONFIG_KEY]) {
    const prev = cfg.settings;
    cfg = S.normalizeConfig(changes[S.CONFIG_KEY].newValue);
    S.clearCache();
    previewCache = null; // rules changed: any cached preview is stale
    // Only touch the alarm / menu when their inputs actually changed (avoids
    // churn while the user is typing in the rule editor).
    if (
      prev.enabled !== cfg.settings.enabled ||
      prev.periodic !== cfg.settings.periodic ||
      prev.intervalMinutes !== cfg.settings.intervalMinutes ||
      prev.pauseJusqua !== cfg.settings.pauseJusqua
    ) {
      setupAlarm().catch(() => {});
    }
    if (prev.enabled !== cfg.settings.enabled || prev.pauseJusqua !== cfg.settings.pauseJusqua) {
      afficherEtat().catch(() => {});
    }
    if (prev.contextMenu !== cfg.settings.contextMenu) setupMenu().catch(() => {});
  }
  if (changes[S.STATS_KEY]) stats = S.normalizeStats(changes[S.STATS_KEY].newValue);
});

if (browser.permissions && browser.permissions.onAdded) {
  browser.permissions.onAdded.addListener(refreshNotifPerm);
}
if (browser.permissions && browser.permissions.onRemoved) {
  browser.permissions.onRemoved.addListener(refreshNotifPerm);
}
async function refreshNotifPerm() {
  try {
    notifPerm = await browser.permissions.contains({ permissions: ["notifications"] });
  } catch (e) {
    notifPerm = false;
  }
}

// Periodic sweep ----------------------------------------------------------
async function setupAlarm() {
  await browser.alarms.clear("shc-sweep").catch(() => {}); // clé avant 1.4.0
  await browser.alarms.clear(ALARM);
  if (S.estActif(cfg.settings) && cfg.settings.periodic) {
    const m = Math.max(1, cfg.settings.intervalMinutes || 30);
    browser.alarms.create(ALARM, { periodInMinutes: m, delayInMinutes: m });
  }
}
browser.alarms.onAlarm.addListener(async (a) => {
  if (a.name === ALARM_PAUSE) {
    await ready;
    if (cfg.settings.pauseJusqua && cfg.settings.pauseJusqua <= Date.now()) {
      cfg.settings.pauseJusqua = 0;
      await S.saveConfig(cfg);
    }
    await afficherEtat();
    return;
  }
  if (a.name !== ALARM) return;
  await ready;
  if (S.estActif(cfg.settings) && cfg.settings.periodic) await sweep(false);
});

// Real-time cleaning ------------------------------------------------------
browser.history.onVisited.addListener((item) => {
  if (!item || !item.url) return;
  withLock(async () => {
    await ready;
    if (!S.estActif(cfg.settings) || !cfg.settings.realtime) return;
    const block = S.decide(cfg.rules, item.url, cfg.settings.caseSensitive, "realtime");
    if (!block) return;
    if (cfg.settings.dryRun) {
      pushLog(item.url, block.id, true);
      scheduleStatsSave();
      return;
    }
    try {
      await browser.history.deleteUrl({ url: item.url });
    } catch (e) {
      console.error("deleteUrl", e);
      return;
    }
    stats.totalDeleted += 1;
    stats.lastRun = Date.now();
    pushLog(item.url, block.id, false);
    scheduleStatsSave();
    notifyRealtime(hostOf(item.url));
  });
});

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function pushLog(url, ruleId, dry) {
  const d = cfg.settings.logDetail;
  if (d === "off") return;
  const rec = d === "host" ? hostOf(url) : url;
  stats.log.push({ t: Date.now(), url: rec, ruleId, dry: !!dry });
  if (stats.log.length > S.LOG_MAX) stats.log = stats.log.slice(-S.LOG_MAX);
}

// Notifications (optional permission; realtime ones are coalesced) --------
function canNotify() {
  return cfg.settings.notifications && notifPerm;
}
function emitNotification(message) {
  if (!message) return;
  try {
    browser.notifications
      .create(NOTIF_ID, {
        type: "basic",
        title: S.t("notifTitle") || "No Noise",
        message,
        iconUrl: browser.runtime.getURL("icons/icone.svg"),
      })
      .catch(() => {});
  } catch (e) {
    /* a notification must never block the cleaning */
  }
}
let rt = { count: 0, host: null, timer: null };
function notifyRealtime(host) {
  if (!canNotify()) return;
  rt.count += 1;
  rt.host = rt.count === 1 ? host : null;
  // Coalesce bursts: one notification per quiet window instead of one per URL.
  if (!rt.timer) rt.timer = setTimeout(flushRealtimeNotif, 3000);
}
function flushRealtimeNotif() {
  const { count, host } = rt;
  rt = { count: 0, host: null, timer: null };
  if (!count || !canNotify()) return;
  const msg =
    count === 1 && cfg.settings.notificationDetail === "host" && host
      ? S.t("notifDeleted", [host])
      : S.t("notifDeletedCount", [String(count)]);
  emitNotification(msg);
}
function notifySweep(count) {
  if (canNotify()) emitNotification(S.t("notifDeletedCount", [String(count)]));
}

function postProgress(p) {
  // sendMessage rejects when no page is listening (popup closed): ignore.
  try {
    browser.runtime.sendMessage(Object.assign({ type: "mnnProgress" }, p)).catch(() => {});
  } catch (e) {
    /* */
  }
}

// Chunked history scan (T3): windowed, deduped, adaptive. -----------------
async function scanHistory(onItems) {
  const FLOOR = 0;
  let end = Date.now();
  let win = 90 * DAY;
  let scanned = 0;
  let truncated = false;
  const seen = new Set();
  while (end > FLOOR) {
    const start = Math.max(FLOOR, end - win);
    let items = [];
    try {
      items = await browser.history.search({ text: "", startTime: start, endTime: end, maxResults: SCAN_CAP });
    } catch (e) {
      console.error("history.search", e);
      break;
    }
    if (items.length >= SCAN_CAP && win > DAY) {
      win = Math.max(DAY, Math.floor(win / 2));
      continue;
    } // shrink & retry
    if (items.length >= SCAN_CAP) truncated = true; // even one day overflows the cap: partial data
    const fresh = [];
    for (const it of items) {
      if (it.url && !seen.has(it.url)) {
        seen.add(it.url);
        fresh.push(it);
      }
    }
    if (fresh.length) {
      scanned += fresh.length;
      if (onItems) await onItems(fresh);
    }
    if (start <= FLOOR) break;
    end = start;
    win = 90 * DAY;
  }
  return { scanned, truncated };
}

// Scan once, collect the URLs a sweep would delete. ------------------------
async function scanMatches() {
  const cs = cfg.settings.caseSensitive;
  const now = Date.now();
  const matches = [];
  let progress = 0;
  const res = await scanHistory(async (items) => {
    for (const it of items) {
      const block = S.decide(cfg.rules, it.url, cs, "sweep");
      if (!block) continue;
      if (block.olderThanDays > 0) {
        // Unknown visit time -> keep (conservative).
        if (!it.lastVisitTime || now - it.lastVisitTime <= block.olderThanDays * DAY) continue;
      }
      matches.push({ url: it.url, ruleId: block.id });
    }
    progress += items.length;
    postProgress({ phase: "scan", scanned: progress, found: matches.length });
  });
  return { matches, scanned: res.scanned, truncated: res.truncated };
}

function makeToken() {
  return "t_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Full sweep (manual / periodic / preview). A preview returns a token; the
// matching cleanNow reuses its match list instead of re-scanning everything.
async function sweep(dryRun, token) {
  await ready;
  if (dryRun) {
    const { matches, scanned, truncated } = await scanMatches();
    const tok = makeToken();
    previewCache = { token: tok, matches, at: Date.now() };
    postProgress({ phase: "done" });
    return { dryRun: true, count: matches.length, scanned, truncated, token: tok, sample: matches.slice(0, 200) };
  }

  let matches;
  let truncated = false;
  if (token && previewCache && previewCache.token === token && Date.now() - previewCache.at < PREVIEW_TTL) {
    matches = previewCache.matches; // no second full scan
  } else {
    const r = await scanMatches();
    matches = r.matches;
    truncated = r.truncated;
  }
  previewCache = null;

  let deleted = 0;
  const done = [];
  for (let i = 0; i < matches.length; i += DELETE_BATCH) {
    const slice = matches.slice(i, i + DELETE_BATCH);
    await Promise.all(
      slice.map((m) =>
        browser.history
          .deleteUrl({ url: m.url })
          .then(() => {
            deleted++;
            done.push(m);
          })
          .catch(() => {}),
      ),
    );
    postProgress({ phase: "delete", deleted, total: matches.length });
  }
  await withLock(async () => {
    for (const m of done) pushLog(m.url, m.ruleId, false);
    stats.totalDeleted += deleted;
    stats.lastRun = Date.now();
    stats.lastRunDeleted = deleted;
    await flushStatsNow();
  });
  notifySweep(deleted);
  postProgress({ phase: "done", deleted });
  return { dryRun: false, count: deleted, truncated };
}

// History noise analyzer (F1). --------------------------------------------
async function analyze() {
  await ready;
  const cs = cfg.settings.caseSensitive;
  const counts = new Map();
  const res = await scanHistory(async (items) => {
    for (const it of items) {
      const v = S.evaluateUrl(cfg.rules, it.url, cs);
      if (v.deleted || v.allows.length) continue; // already handled
      let host;
      try {
        host = new URL(it.url).hostname.replace(/^www\./, "");
      } catch (e) {
        continue;
      }
      if (!host) continue;
      counts.set(host, (counts.get(host) || 0) + 1);
    }
    postProgress({ phase: "analyze", scanned: counts.size });
  });
  const items = [...counts.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
  postProgress({ phase: "done" });
  return { items, scanned: res.scanned, truncated: res.truncated, hosts: counts.size };
}

// Per-rule preview against real history (F6). -----------------------------
async function previewRule(ruleId) {
  await ready;
  const cs = cfg.settings.caseSensitive;
  const r = cfg.rules.find((x) => x.id === ruleId);
  if (!r) return { count: 0 };
  let count = 0;
  const res = await scanHistory(async (items) => {
    for (const it of items) if (S.patternMatches(r, it.url, cs)) count++;
    postProgress({ phase: "previewRule", scanned: count });
  });
  postProgress({ phase: "done" });
  return { count, truncated: res.truncated };
}

// Context menu (F3). Firefox does not allow `contextMenus` as an optional
// permission, so least-privilege is approximated with a setting: the entry is
// only created when settings.contextMenu is on.
let menuClickRegistered = false;
async function onMenuClick(info, tab) {
  if (info.menuItemId !== "mnn-add-site") return;
  const target = info.linkUrl || info.pageUrl || (tab && tab.url);
  let host;
  try {
    host = new URL(target).hostname;
  } catch (e) {
    return;
  }
  const c = await S.loadConfig();
  if (!c.rules.some((r) => r.kind === "block" && r.type === "domain" && r.value === host)) {
    c.rules.push(S.rule("domain", host, S.t("noteImported") || ""));
    await S.saveConfig(c);
    if (canNotify()) emitNotification(S.t("ctxAdded", [host]));
  }
}
function registerMenuClick() {
  if (menuClickRegistered || !browser.contextMenus || !browser.contextMenus.onClicked) return;
  menuClickRegistered = true;
  browser.contextMenus.onClicked.addListener(onMenuClick);
}
async function setupMenu() {
  if (!browser.contextMenus) return;
  try {
    await browser.contextMenus.removeAll();
    if (cfg.settings.contextMenu) {
      browser.contextMenus.create(
        { id: "mnn-add-site", title: S.t("ctxAddSite") || "Add this site to No Noise", contexts: ["page", "link"] },
        () => browser.runtime.lastError, // read lastError to silence the warning
      );
    }
  } catch (e) {
    /* never block startup on menu errors */
  }
}

// Keyboard command (F3). --------------------------------------------------
if (browser.commands && browser.commands.onCommand) {
  browser.commands.onCommand.addListener(async (cmd) => {
    if (cmd === "clean-now") {
      await ready;
      await sweep(false);
    }
  });
}

// Messages from popup / options. ------------------------------------------
browser.runtime.onMessage.addListener((msg) => {
  switch (msg && msg.cmd) {
    case "cleanNow":
      return sweep(false, msg.token);
    case "preview":
      return sweep(true);
    case "previewRule":
      return previewRule(msg.ruleId);
    case "analyze":
      return analyze();
    case "ping":
      return Promise.resolve({ ok: true });
    default:
      return false;
  }
});
