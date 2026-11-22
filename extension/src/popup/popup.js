'use strict';
const S = self.MNN;
const t = S.t;
const $ = (id) => document.getElementById(id);
let pendingToken = null; // preview token, lets cleanNow reuse the scan

async function refresh() {
  const cfg = await S.loadConfig();
  const stats = await S.loadStats();
  const pause = S.enPause(cfg.settings);
  $('enabled').checked = cfg.settings.enabled;
  $('realtime').checked = cfg.settings.realtime;
  $('periodic').checked = cfg.settings.periodic;
  $('dryRun').checked = cfg.settings.dryRun;
  $('dry').classList.toggle('hidden', !cfg.settings.dryRun);
  document.body.classList.toggle('off', !S.estActif(cfg.settings));
  const banner = $('pauseBanner');
  if (pause) {
    const heure = new Date(cfg.settings.pauseJusqua).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    banner.textContent = t('pauseJusqua', [heure]);
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
  $('reprendre').hidden = !pause;
  $('stTotal').textContent = stats.totalDeleted;
  $('stRules').textContent = cfg.rules.filter((r) => r.enabled).length;
  $('stLast').textContent = stats.lastRun
    ? t('lastRun', [S.formatDate(stats.lastRun)]) + (stats.lastRunDeleted ? ' (' + stats.lastRunDeleted + ')' : '')
    : t('noRun');
}

document.querySelectorAll('.pause [data-minutes]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const cfg = await S.loadConfig();
    cfg.settings.pauseJusqua = Date.now() + Number(btn.dataset.minutes) * 60_000;
    await S.saveConfig(cfg);
    refresh();
  });
});
$('reprendre').addEventListener('click', async () => {
  const cfg = await S.loadConfig();
  cfg.settings.pauseJusqua = 0;
  await S.saveConfig(cfg);
  refresh();
});

async function patch(key, value) {
  const cfg = await S.loadConfig();
  cfg.settings[key] = value;
  await S.saveConfig(cfg);
}

['enabled', 'realtime', 'periodic', 'dryRun'].forEach((id) => {
  $(id).addEventListener('change', (e) => patch(id, e.target.checked).then(refresh));
});

function showResult(text, cls) { const el = $('result'); el.className = 'result ' + (cls || ''); el.textContent = text; }
function hideConfirm() { $('confirm').classList.add('hidden'); }
function trunc(r) { return r && r.truncated ? ' ' + t('scanTruncated') : ''; }

// Clean now: preview first, then confirm before deleting (S2 / S3).
// The preview token lets the actual clean reuse the scan (no double scan).
$('cleanNow').addEventListener('click', async () => {
  hideConfirm();
  showResult(t('analyzing'), '');
  let r;
  try { r = await browser.runtime.sendMessage({ cmd: 'preview' }); }
  catch (e) { showResult(t('err', [String(e)]), 'err'); return; }
  if (!r.count) { showResult(t('resNoMatch') + trunc(r), 'ok'); return; }
  pendingToken = r.token || null;

  const cfg = await S.loadConfig();
  const needsConfirm = cfg.settings.confirmManual || (cfg.settings.massThreshold > 0 && r.count >= cfg.settings.massThreshold);
  if (needsConfirm) {
    $('confirmMsg').textContent = t('confirmMass', [String(r.count)]) + trunc(r);
    $('confirm').classList.remove('hidden');
    showResult('', '');
  } else {
    doClean();
  }
});

$('confirmNo').addEventListener('click', () => { hideConfirm(); pendingToken = null; showResult(t('cancelled'), ''); });
$('confirmYes').addEventListener('click', () => { hideConfirm(); doClean(); });

async function doClean() {
  showResult(t('cleaning'), '');
  try {
    const r = await browser.runtime.sendMessage({ cmd: 'cleanNow', token: pendingToken });
    showResult((r.count ? t('resDeleted', [String(r.count)]) : t('resNoMatch')) + trunc(r), 'ok');
  } catch (e) { showResult(t('err', [String(e)]), 'err'); }
  pendingToken = null;
  refresh();
}

$('preview').addEventListener('click', async () => {
  hideConfirm();
  showResult(t('analyzing'), '');
  try {
    const r = await browser.runtime.sendMessage({ cmd: 'preview' });
    showResult((r.count ? t('resPreview', [String(r.count)]) : t('resNoMatch')) + trunc(r), 'ok');
  } catch (e) { showResult(t('err', [String(e)]), 'err'); }
});

$('openOptions').addEventListener('click', (e) => {
  e.preventDefault(); browser.runtime.openOptionsPage(); window.close();
});

// Live progress during long operations (T3).
browser.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== 'mnnProgress') return;
  if (msg.phase === 'scan') showResult(t('progressScan', [String(msg.scanned)]), '');
  else if (msg.phase === 'delete') showResult(t('progressDelete', [String(msg.deleted), String(msg.total)]), '');
});

browser.storage.onChanged.addListener(() => refresh());

S.localizeDom();
refresh();
