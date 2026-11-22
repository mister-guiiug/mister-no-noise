'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const localesDir = path.join(__dirname, '..', '_locales');
const attendues = [
  'ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'zh_CN',
];

describe('traductions', () => {
  const dossiers = fs.readdirSync(localesDir).filter((n) =>
    fs.statSync(path.join(localesDir, n)).isDirectory(),
  );
  const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en', 'messages.json'), 'utf8'));
  const clesEn = Object.keys(en);

  it('couvre les quinze langues', () => {
    assert.deepEqual([...dossiers].sort(), [...attendues].sort());
  });

  for (const langue of dossiers) {
    it(`${langue} a les mêmes clés que en`, () => {
      const messages = JSON.parse(
        fs.readFileSync(path.join(localesDir, langue, 'messages.json'), 'utf8'),
      );
      assert.deepEqual(Object.keys(messages).sort(), [...clesEn].sort());
      for (const cle of clesEn) {
        assert.equal(typeof messages[cle]?.message, 'string');
        assert.ok(messages[cle].message.length > 0, `${langue}.${cle} vide`);
      }
    });
  }

  it('les placeholders de en sont présents partout', () => {
    const ph = (s) => [...s.matchAll(/\$[A-Za-z]+\$/g)].map((m) => m[0]).sort();
    for (const langue of dossiers) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(localesDir, langue, 'messages.json'), 'utf8'),
      );
      for (const cle of clesEn) {
        assert.deepEqual(ph(messages[cle].message), ph(en[cle].message), `${langue}.${cle}`);
      }
    }
  });

  it('badgeOff tient sur la pastille (≤ 4 caractères)', () => {
    for (const langue of dossiers) {
      const messages = JSON.parse(
        fs.readFileSync(path.join(localesDir, langue, 'messages.json'), 'utf8'),
      );
      assert.ok([...messages.badgeOff.message].length <= 4, `badgeOff : ${langue}`);
    }
  });
});

