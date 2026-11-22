'use strict';
(async () => {
  const S = self.MNN;
  const t = S.t;
  S.localizeDom();
  const ver = browser.runtime.getManifest().version;
  document.getElementById('titre').textContent = t('nouveautesTitre', [ver]) || ('No Noise ' + ver);

  const keys = ['nouveautesPoint1', 'nouveautesPoint2', 'nouveautesPoint3', 'nouveautesPoint4'];
  const ul = document.getElementById('points');
  for (const key of keys) {
    const msg = t(key);
    if (!msg) continue;
    const li = document.createElement('li');
    li.textContent = msg;
    ul.appendChild(li);
  }

  document.getElementById('ouvrir').addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
})();
