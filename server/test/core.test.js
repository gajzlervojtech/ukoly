const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ukoly-test-'));
process.env.TZ = 'Europe/Prague';

const store = require('../src/store');

test('výchozí karty se založí', () => {
  const cards = store.listCards();
  assert.deepStrictEqual(cards.map((c) => c.name), ['Úkoly', 'Filmy a seriály']);
  assert.strictEqual(cards[0].kind, 'deadline');
  assert.strictEqual(cards[1].kind, 'mark');
  assert.strictEqual(cards[1].mark_label, 'Na NASu');
  assert.strictEqual(cards[1].in_digest, false);
});

test('dnešní datum v pražské zóně', () => {
  // 22:30 UTC 15. 10. je v Praze už 16. 10.
  assert.strictEqual(store.today(new Date('2026-10-15T22:30:00Z')), '2026-10-16');
  assert.strictEqual(store.today(new Date('2026-10-15T10:00:00Z')), '2026-10-15');
});

test('úkoly se řadí podle termínu, bez termínu na konec', () => {
  const card = store.createCard({ name: 'Test řazení', kind: 'deadline', in_digest: false });
  store.createItem(card.id, { title: 'bez termínu' });
  store.createItem(card.id, { title: 'pozdě', due_date: '2026-11-02' });
  store.createItem(card.id, { title: 'brzy', due_date: '2026-10-13' });
  store.createItem(card.id, { title: 'brzy ráno', due_date: '2026-10-13', due_time: '07:00' });
  const { open } = store.listItems(card.id);
  assert.deepStrictEqual(open.map((i) => i.title), ['brzy ráno', 'brzy', 'pozdě', 'bez termínu']);
});

test('denní přehled: po termínu a dnes, jen z karet v přehledu', () => {
  const tasks = store.listCards().find((c) => c.name === 'Úkoly');
  const hidden = store.createCard({ name: 'Mimo přehled', kind: 'deadline', in_digest: false });
  store.createItem(tasks.id, { title: 'Zaplatit zálohu', due_date: '2026-10-13' });
  store.createItem(tasks.id, { title: 'Vyzvednout balík', due_date: '2026-10-15' });
  store.createItem(tasks.id, { title: 'Filtr', due_date: '2026-10-17' });
  const done = store.createItem(tasks.id, { title: 'Hotové', due_date: '2026-10-15' });
  store.updateItem(done.id, { done: true });
  store.createItem(hidden.id, { title: 'Skryté', due_date: '2026-10-15' });

  const d = store.digest('2026-10-15');
  assert.deepStrictEqual(d.overdue.map((i) => i.title), ['Zaplatit zálohu']);
  assert.deepStrictEqual(d.today.map((i) => i.title), ['Vyzvednout balík']);
});

test('označení u filmů: položka zůstává, jen se přepne', () => {
  const media = store.listCards().find((c) => c.preset === 'media');
  const a = store.createItem(media.id, { title: 'Dune: Část druhá', variant: 'film' });
  store.createItem(media.id, { title: 'Shōgun', variant: 'serial', note: '1. řada' });
  store.updateItem(a.id, { done: true });
  const { open, done } = store.listItems(media.id);
  assert.deepStrictEqual(open.map((i) => i.title), ['Shōgun']);
  assert.deepStrictEqual(done.map((i) => i.title), ['Dune: Část druhá']);
  assert.strictEqual(store.getCard(media.id).open_count, 1);
});

test('novinky od daného okamžiku', () => {
  const media = store.listCards().find((c) => c.preset === 'media');
  const since = new Date(Date.now() - 1000).toISOString();
  store.createItem(media.id, { title: 'Pelíšky', variant: 'film' });
  const ch = store.changes(since);
  assert.ok(ch.added.some((i) => i.title === 'Pelíšky' && i.card_name === 'Filmy a seriály' && i.card_preset === 'media'));
  assert.deepStrictEqual(store.changes(null).added, []);
});

test('novinky bez vlastních položek telefonu', () => {
  const media = store.listCards().find((c) => c.preset === 'media');
  const since = new Date(Date.now() - 1000).toISOString();
  store.createItem(media.id, { title: 'Od Káti', device: 'telefon-k' });
  store.createItem(media.id, { title: 'Od Vojty', device: 'telefon-v' });
  const titles = store.changes(since, 'telefon-v').added.map((i) => i.title);
  assert.ok(titles.includes('Od Káti'));
  assert.ok(!titles.includes('Od Vojty'));
});

test('místní čas pro plánování upozornění', () => {
  assert.strictEqual(store.localNow(new Date('2026-10-15T05:30:00Z')), '2026-10-15T07:30');
  assert.strictEqual(store.localNow(new Date('2026-12-31T23:10:00Z')), '2027-01-01T00:10');
  assert.match(store.digest('2026-10-15').now, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test('kontrola vstupů', () => {
  const tasks = store.listCards()[0];
  assert.throws(() => store.createItem(tasks.id, { title: '   ' }), /Chybí Název/);
  assert.throws(() => store.createItem(tasks.id, { title: 'x', due_date: '15. 10.' }), /Neplatné datum/);
  assert.throws(() => store.createCard({ name: 'x', kind: 'nic' }), /Neplatný typ/);
  // čas bez data se zahodí
  const i = store.createItem(tasks.id, { title: 'jen čas', due_time: '10:00' });
  assert.strictEqual(i.due_time, null);
  // zrušení termínu zruší i čas
  const j = store.createItem(tasks.id, { title: 's časem', due_date: '2026-10-20', due_time: '18:00' });
  assert.strictEqual(store.updateItem(j.id, { due_date: null }).due_time, null);
});

test('smazání karty smaže i položky, poslední kartu smazat nejde', () => {
  const c = store.createCard({ name: 'Dočasná', kind: 'simple' });
  const it = store.createItem(c.id, { title: 'něco' });
  store.deleteCard(c.id);
  assert.throws(() => store.getItem(it.id), /neexistuje/);
});
