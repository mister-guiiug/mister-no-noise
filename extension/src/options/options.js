'use strict';
const S = self.MNN;
const t = S.t;
const $ = (id) => document.getElementById(id);
const send = (m) => browser.runtime.sendMessage(m);
let cfg = null;

/* ------------------------- loading & rendering ------------------------ */
async function load() {
  S.localizeDom();
  cfg = await S.loadConfig();
  renderSettings();
  renderRules();
  await renderStats();
  runTest();
  await checkWelcome();
}

function renderSettings() {
  const s = cfg.settings;
  $('enabled').checked = s.enabled;
  $('realtime').checked = s.realtime;
  $('periodic').checked = s.periodic;
  $('intervalMinutes').value = s.intervalMinutes;
  $('dryRun').checked = s.dryRun;
  $('caseSensitive').checked = s.caseSensitive;
  $('confirmManual').checked = s.confirmManual;
  $('massThreshold').value = s.massThreshold;
  $('notifications').checked = s.notifications;
  $('notificationDetail').value = s.notificationDetail;
  $('logDetail').value = s.logDetail;
  $('ctxMenu').checked = s.contextMenu;
  $('syncSettings').checked = s.syncSettings;
}

async function saveCfg() { cfg = await S.saveConfig(cfg); }
function trunc(r) { return r && r.truncated ? ' ' + t('scanTruncated') : ''; }

/* ------------------------------ settings ------------------------------ */
function bindSetting(id, prop, kind) {
  const el = $(id);
  el.addEventListener('change', async () => {
    let v;
    if (kind === 'num') { const min = parseInt(el.min, 10) || 0; v = Math.max(min, parseInt(el.value, 10) || min); }
    else if (kind === 'select') v = el.value;
    else v = el.checked;
    cfg.settings[prop] = v;
    await saveCfg();
    if (kind === 'num') el.value = cfg.settings[prop];
    if (prop === 'caseSensitive') renderRules();
    runTest();
  });
}
bindSetting('enabled', 'enabled');
bindSetting('realtime', 'realtime');
bindSetting('periodic', 'periodic');
bindSetting('dryRun', 'dryRun');
bindSetting('caseSensitive', 'caseSensitive');
bindSetting('confirmManual', 'confirmManual');
bindSetting('intervalMinutes', 'intervalMinutes', 'num');
bindSetting('massThreshold', 'massThreshold', 'num');
bindSetting('notificationDetail', 'notificationDetail', 'select');
bindSetting('logDetail', 'logDetail', 'select');

// Notifications are an optional permission (S4): request on enable, drop on disable.
$('notifications').addEventListener('change', async (e) => {
  if (e.target.checked) {
    let granted = false;
    try { granted = await browser.permissions.request({ permissions: ['notifications'] }); } catch (err) { granted = false; }
    if (!granted) { e.target.checked = false; return; }
    cfg.settings.notifications = true; await saveCfg();
  } else {
    cfg.settings.notifications = false; await saveCfg();
    try { await browser.permissions.remove({ permissions: ['notifications'] }); } catch (err) { /* */ }
  }
});

// Firefox does not allow `contextMenus` as an optional permission, so the
// right-click entry is controlled by a plain setting (the background reacts).
bindSetting('ctxMenu', 'contextMenu');
bindSetting('syncSettings', 'syncSettings');

document.querySelectorAll('[data-pack]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const added = S.rulesFromPack(btn.dataset.pack, cfg.rules);
    if (!added.length) {
      $('packsMsg').textContent = t('packsAlready');
      return;
    }
    cfg.rules = cfg.rules.concat(added);
    await saveCfg();
    renderRules();
    runTest();
    $('packsMsg').textContent = t('packsAdded', [String(added.length)]);
  });
});

/* -------------------------------- rules ------------------------------- */
function renderRules() {
  const body = $('rulesBody');
  body.textContent = '';
  $('noRules').classList.toggle('hidden', cfg.rules.length > 0);
  cfg.rules.forEach((r, i) => body.appendChild(ruleCard(r, i)));
  applyFilter();
}

function ruleCard(r, index) {
  const cs = cfg.settings.caseSensitive;
  const card = document.createElement('div');
  card.className = 'rule' + (r.enabled ? '' : ' disabled');
  card.dataset.hay = (r.value + ' ' + r.note + ' ' + r.type + ' ' + r.kind).toLowerCase();

  const main = div('rule-main');
  const en = input('checkbox'); en.checked = r.enabled;
  en.setAttribute('aria-label', t('optEnabled'));
  en.addEventListener('change', async () => { r.enabled = en.checked; card.classList.toggle('disabled', !en.checked); await saveCfg(); runTest(); });
  main.appendChild(en);

  const kind = select(S.RULE_KINDS, r.kind, (v) => v === 'allow' ? (t('ruleKindAllow') || 'Keep') : (t('ruleKindBlock') || 'Delete'));
  kind.classList.add('sel-kind');
  kind.addEventListener('change', async () => { r.kind = kind.value; card.classList.toggle('allow', r.kind === 'allow'); await saveCfg(); runTest(); });
  card.classList.toggle('allow', r.kind === 'allow');
  main.appendChild(kind);

  const type = select(S.RULE_TYPE_KEYS, r.type, (v) => S.ruleTypeLabel(v));
  type.addEventListener('change', async () => { r.type = type.value; await saveCfg(); updateWarn(); runTest(); });
  main.appendChild(type);

  const val = input('text', 'in'); val.value = r.value; val.placeholder = t('ruleValuePlaceholder');
  val.addEventListener('input', debounce(async () => { r.value = val.value; card.dataset.hay = (r.value + ' ' + r.note + ' ' + r.type + ' ' + r.kind).toLowerCase(); await saveCfg(); updateWarn(); runTest(); }, 300));
  main.appendChild(val);

  const note = input('text', 'in'); note.value = r.note; note.placeholder = t('notePlaceholder');
  note.addEventListener('input', debounce(async () => { r.note = note.value; await saveCfg(); }, 300));
  main.appendChild(note);
  card.appendChild(main);

  const meta = div('rule-meta');
  // scheduling (F4/F5)
  const whenWrap = span('meta-item');
  whenWrap.appendChild(labelText(t('ruleModeLabel')));
  const mode = select(S.RULE_MODES, r.mode, (v) => t('mode_' + v) || v);
  mode.addEventListener('change', async () => { r.mode = mode.value; await saveCfg(); });
  whenWrap.appendChild(mode);
  meta.appendChild(whenWrap);

  const ageWrap = span('meta-item');
  ageWrap.appendChild(labelText(t('ruleAgeLabel')));
  const age = input('number', 'in num sm'); age.min = '0'; age.value = r.olderThanDays;
  age.setAttribute('aria-label', t('ruleAgeLabel') + ' (' + t('unitDays') + ')');
  age.addEventListener('change', async () => { r.olderThanDays = Math.max(0, parseInt(age.value, 10) || 0); age.value = r.olderThanDays; await saveCfg(); });
  ageWrap.appendChild(age);
  ageWrap.appendChild(labelText(t('unitDays')));
  meta.appendChild(ageWrap);

  const warn = span('rule-warn hidden');
  meta.appendChild(warn);

  const testSpan = span('rule-test');
  meta.appendChild(testSpan);

  const spacer = div('spacer'); meta.appendChild(spacer);

  const prev = iconBtn('🔎', t('testRuleBtn'));
  prev.addEventListener('click', async () => {
    testSpan.textContent = '…';
    try { const res = await send({ cmd: 'previewRule', ruleId: r.id }); testSpan.textContent = t('testRuleResult', [String(res.count)]) + trunc(res); }
    catch (e) { testSpan.textContent = ''; }
  });
  meta.appendChild(prev);

  const up = iconBtn('↑', t('moveUp')); up.addEventListener('click', () => move(index, -1)); meta.appendChild(up);
  const down = iconBtn('↓', t('moveDown')); down.addEventListener('click', () => move(index, 1)); meta.appendChild(down);
  const del = iconBtn('✕', t('deleteRuleTitle')); del.classList.add('del');
  del.addEventListener('click', async () => { cfg.rules = cfg.rules.filter((x) => x.id !== r.id); await saveCfg(); renderRules(); runTest(); });
  meta.appendChild(del);

  card.appendChild(meta);

  function updateWarn() {
    if (S.ruleInvalid(r, cs)) { warn.textContent = t('ruleInvalid'); warn.className = 'rule-warn err'; }
    else if (S.ruleUnsafe(r, cs)) { warn.textContent = t('ruleUnsafe'); warn.className = 'rule-warn warn'; }
    else { warn.textContent = ''; warn.className = 'rule-warn hidden'; }
  }
  updateWarn();
  return card;
}

function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= cfg.rules.length) return;
  const a = cfg.rules; const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  saveCfg().then(renderRules);
}

$('addRule').addEventListener('click', async () => {
  cfg.rules.push(S.rule('contains', '', ''));
  await saveCfg();
  // Vider le filtre sinon la nouvelle règle (valeur vide) peut rester cachée.
  $('filter').value = '';
  renderRules();
  const last = $('rulesBody').lastElementChild;
  if (!last) return;
  last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const champ = last.querySelector('.rule-main input.in');
  if (champ) { champ.focus(); champ.select(); }
});

$('filter').addEventListener('input', applyFilter);
function applyFilter() {
  const q = $('filter').value.trim().toLowerCase();
  for (const el of $('rulesBody').children) el.style.display = (!q || (el.dataset.hay || '').includes(q)) ? '' : 'none';
}

$('enableAll').addEventListener('click', () => bulk(true));
$('disableAll').addEventListener('click', () => bulk(false));
async function bulk(v) { cfg.rules.forEach((r) => { r.enabled = v; }); await saveCfg(); renderRules(); runTest(); }

/* ------------------------------ URL test ------------------------------ */
function runTest() {
  const url = $('testUrl').value.trim();
  const box = $('testResult');
  if (!url) { box.textContent = ''; box.className = 'test-res'; return; }
  const v = S.evaluateUrl(cfg.rules, url, cfg.settings.caseSensitive);
  if (v.allows.length) { box.className = 'test-res kept'; box.textContent = t('testKept') + ' '; appendCodes(box, v.allows); }
  else if (v.blocks.length) { box.className = 'test-res hit'; box.textContent = t('testMatch'); appendCodes(box, v.blocks); }
  else { box.className = 'test-res miss'; box.textContent = t('testNoMatch'); }
}
function appendCodes(box, rules) {
  rules.forEach((m, i) => {
    if (i) box.appendChild(document.createTextNode(', '));
    const c = document.createElement('code'); c.textContent = S.ruleTypeLabel(m.type) + ' « ' + m.value + ' »'; box.appendChild(c);
  });
}
$('testUrl').addEventListener('input', debounce(runTest, 200));

/* --------------------------- history analyzer (F1) -------------------- */
$('analyzeBtn').addEventListener('click', runAnalyze);
async function runAnalyze() {
  const body = $('suggestBody'); const prog = $('suggestProgress'); const empty = $('suggestEmpty');
  body.textContent = ''; empty.classList.add('hidden'); prog.textContent = t('analyzing');
  let r;
  try { r = await send({ cmd: 'analyze' }); } catch (e) { prog.textContent = t('err', [String(e)]); return; }
  prog.textContent = t('suggestScanned', [String(r.scanned)]) + trunc(r);
  if (!r.items.length) { empty.textContent = t('suggestNone'); empty.classList.remove('hidden'); return; }
  for (const it of r.items) body.appendChild(suggestRow(it));
}
function suggestRow(it) {
  const row = div('suggest-row');
  const host = span('sg-host'); host.textContent = it.host;
  const cnt = span('sg-count'); cnt.textContent = t('suggestEntries', [String(it.count)]);
  const add = document.createElement('button'); add.className = 'btn'; add.textContent = t('suggestAdd');
  add.addEventListener('click', async () => {
    cfg.rules.push(S.rule('domain', it.host, ''));
    await saveCfg(); renderRules(); row.remove();
  });
  row.append(host, cnt, add);
  return row;
}

/* ---------------------------- cleaning actions ------------------------ */
let runToken = null; // preview token, lets cleanNow reuse the scan
$('cleanNow').addEventListener('click', runClean);
$('preview').addEventListener('click', runPreview);

async function runPreview() {
  hideRunConfirm();
  const box = $('runResult'); box.className = 'run-res'; box.textContent = t('analyzing');
  try { const r = await send({ cmd: 'preview' }); box.textContent = (r.count ? t('resPreview', [String(r.count)]) : t('resNoMatch')) + trunc(r); box.classList.add('ok'); }
  catch (e) { box.textContent = t('err', [String(e)]); box.classList.add('err'); }
}

async function runClean() {
  hideRunConfirm();
  const box = $('runResult'); box.className = 'run-res'; box.textContent = t('analyzing');
  let r;
  try { r = await send({ cmd: 'preview' }); } catch (e) { box.textContent = t('err', [String(e)]); box.classList.add('err'); return; }
  if (!r.count) { box.textContent = t('resNoMatch') + trunc(r); box.classList.add('ok'); return; }
  runToken = r.token || null;
  const needsConfirm = cfg.settings.confirmManual || (cfg.settings.massThreshold > 0 && r.count >= cfg.settings.massThreshold);
  if (needsConfirm) {
    $('runConfirmMsg').textContent = t('confirmMass', [String(r.count)]) + trunc(r);
    $('runConfirm').classList.remove('hidden');
    box.textContent = '';
  } else {
    doClean();
  }
}

async function doClean() {
  const box = $('runResult'); box.className = 'run-res'; box.textContent = t('cleaning');
  try { const d = await send({ cmd: 'cleanNow', token: runToken }); box.textContent = (d.count ? t('resDeleted', [String(d.count)]) : t('resNoMatch')) + trunc(d); box.classList.add('ok'); }
  catch (e) { box.textContent = t('err', [String(e)]); box.classList.add('err'); }
  runToken = null;
  renderStats();
}

function hideRunConfirm() { $('runConfirm').classList.add('hidden'); }
$('runConfirmYes').addEventListener('click', () => { hideRunConfirm(); doClean(); });
$('runConfirmNo').addEventListener('click', () => { hideRunConfirm(); runToken = null; $('runResult').className = 'run-res'; $('runResult').textContent = t('cancelled'); });

/* --------------------------- log & statistics ------------------------- */
async function renderStats() {
  const stats = await S.loadStats();
  $('stTotal').textContent = stats.totalDeleted;
  $('stLast').textContent = stats.lastRun ? t('lastPrefix', [S.formatDate(stats.lastRun)]) : '';
  const body = $('logBody'); body.textContent = '';
  const rows = stats.log.slice().reverse();
  $('noLog').classList.toggle('hidden', rows.length > 0);
  for (const e of rows.slice(0, 200)) {
    const tr = document.createElement('tr');
    if (e.dry) tr.classList.add('dry');
    tr.appendChild(td(S.formatDate(e.t)));
    tr.appendChild(td(e.url, 'url'));
    const ruleName = (cfg.rules.find((r) => r.id === e.ruleId) || {}).value || '—';
    tr.appendChild(td((e.dry ? t('dryTag') : '') + ruleName));
    body.appendChild(tr);
  }
}
$('clearStats').addEventListener('click', async () => { await S.saveStats(S.normalizeStats(null)); renderStats(); });

/* ----------------------------- import / export ------------------------ */
$('exportBtn').addEventListener('click', () => {
  const data = JSON.stringify({ version: 2, settings: cfg.settings, rules: cfg.rules }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'no-noise-config.json'; a.click();
  URL.revokeObjectURL(a.href);
});

// JSON import shows a preview and asks Merge / Replace / Cancel (n°8);
// invalid or dangerously slow patterns are counted before anything is saved.
let pendingImport = null;
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const obj = JSON.parse(await file.text());
    const norm = S.normalizeConfig(obj);
    const cs = norm.settings.caseSensitive;
    let blocks = 0, allows = 0, bad = 0;
    for (const r of norm.rules) {
      if (r.kind === 'allow') allows++; else blocks++;
      if (S.ruleInvalid(r, cs) || S.ruleUnsafe(r, cs)) bad++; // bounded by the self-test budget
    }
    pendingImport = norm;
    $('importPreviewText').textContent = t('importPreviewMsg', [String(blocks), String(allows), String(bad)]);
    $('importConfirm').classList.remove('hidden');
    ieMsg('', true);
  } catch (err) {
    ieMsg(t('invalidFile', [String(err)]), false);
  }
  e.target.value = '';
});
function closeImportConfirm() { pendingImport = null; $('importConfirm').classList.add('hidden'); }
$('impCancel').addEventListener('click', () => { closeImportConfirm(); ieMsg(t('cancelled'), true); });
$('impReplace').addEventListener('click', async () => {
  if (!pendingImport) return;
  cfg = pendingImport;
  await saveCfg(); closeImportConfirm();
  renderSettings(); renderRules(); runTest();
  ieMsg(t('cfgImported'), true);
});
$('impMerge').addEventListener('click', async () => {
  if (!pendingImport) return;
  const wanted = cfg.rules.length + pendingImport.rules.length;
  cfg.rules = cfg.rules.concat(pendingImport.rules);
  await saveCfg(); closeImportConfirm(); // saveCfg normalizes (caps at MAX_RULES)
  renderRules(); runTest();
  const dropped = Math.max(0, wanted - cfg.rules.length);
  ieMsg(dropped ? t('importCapped', [String(cfg.rules.length), String(dropped)]) : t('cfgImported'), true);
});

$('legacyBtn').addEventListener('click', async () => {
  const rules = S.parseLegacy($('legacy').value);
  if (!rules.length) { ieMsg(t('noPattern'), false); return; }
  cfg.rules = $('legacyReplace').checked ? rules : cfg.rules.concat(rules);
  await saveCfg(); renderRules(); runTest();
  $('legacy').value = '';
  ieMsg(t('patternsImported', [String(rules.length)]), true);
});
function ieMsg(text, ok) { const el = $('ieMsg'); el.textContent = text; el.className = 'ie-msg ' + (ok ? 'ok' : 'err'); }

/* ------------------------------- welcome (F7) ------------------------- */
async function checkWelcome() {
  try {
    const f = await browser.storage.local.get(['mnn.firstRun', 'shc.firstRun']);
    if (f['shc.firstRun'] && !f['mnn.firstRun']) {
      await browser.storage.local.set({ 'mnn.firstRun': true });
      await browser.storage.local.remove('shc.firstRun');
      f['mnn.firstRun'] = true;
    }
    if (f['mnn.firstRun']) $('welcome').classList.remove('hidden');
  } catch (e) { /* */ }
}
$('welcomeDismiss').addEventListener('click', async () => { $('welcome').classList.add('hidden'); try { await browser.storage.local.remove(['mnn.firstRun', 'shc.firstRun']); } catch (e) { /* */ } });
$('welcomeAnalyze').addEventListener('click', async () => {
  $('welcome').classList.add('hidden');
  try { await browser.storage.local.remove(['mnn.firstRun', 'shc.firstRun']); } catch (e) { /* */ }
  $('analyzeBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
  runAnalyze();
});

/* -------------------------------- progress ---------------------------- */
browser.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'mnnProgress') return;
  if (msg.phase === 'analyze') $('suggestProgress').textContent = t('suggestScan', [String(msg.scanned)]);
  else if (msg.phase === 'scan') $('runResult').textContent = t('progressScan', [String(msg.scanned)]);
  else if (msg.phase === 'delete') $('runResult').textContent = t('progressDelete', [String(msg.deleted), String(msg.total)]);
});
browser.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[S.STATS_KEY]) renderStats(); });

/* --------------------------------- utils ------------------------------ */
function div(cls) { const d = document.createElement('div'); if (cls) d.className = cls; return d; }
function span(cls) { const s = document.createElement('span'); if (cls) s.className = cls; return s; }
function labelText(text) { const s = document.createElement('span'); s.className = 'lbl'; s.textContent = text; return s; }
function input(type, cls) { const i = document.createElement('input'); i.type = type; if (cls) i.className = cls; return i; }
function iconBtn(txt, title) {
  const b = document.createElement('button');
  b.className = 'btn ghost ico'; b.textContent = txt;
  if (title) { b.title = title; b.setAttribute('aria-label', title); }
  return b;
}
function select(values, current, labelFn) {
  const s = document.createElement('select'); s.className = 'sel';
  for (const v of values) { const o = document.createElement('option'); o.value = v; o.textContent = labelFn(v); if (v === current) o.selected = true; s.appendChild(o); }
  return s;
}
function td(text, cls) { const d = document.createElement('td'); d.textContent = text; if (cls) d.className = cls; return d; }
function debounce(fn, ms) { let timer; return (...a) => { clearTimeout(timer); timer = setTimeout(() => fn(...a), ms); }; }

load();
