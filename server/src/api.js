const express = require('express');
const store = require('./store');
const backup = require('./backup');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw Object.assign(new Error('Neplatné id'), { status: 400 });
  return n;
};

// ---------- Karty ----------
router.get('/cards', (req, res) => res.json(store.listCards()));
router.post('/cards', (req, res) => res.status(201).json(store.createCard(req.body)));
router.put('/cards/order', (req, res) => res.json(store.reorderCards((req.body.ids || []).map(id))));
router.patch('/cards/:id', (req, res) => res.json(store.updateCard(id(req.params.id), req.body)));
router.delete('/cards/:id', (req, res) => { store.deleteCard(id(req.params.id)); res.json({ ok: true }); });

// ---------- Položky ----------
router.get('/cards/:id/items', (req, res) => res.json(store.listItems(id(req.params.id))));
router.post('/cards/:id/items', (req, res) => res.status(201).json(store.createItem(id(req.params.id), req.body)));
router.post('/cards/:id/clear-done', (req, res) => res.json({ removed: store.clearDone(id(req.params.id)) }));
router.patch('/items/:id', (req, res) => res.json(store.updateItem(id(req.params.id), req.body)));
router.delete('/items/:id', (req, res) => { store.deleteItem(id(req.params.id)); res.json({ ok: true }); });

// ---------- Pro telefon ----------
router.get('/digest', (req, res) => res.json(store.digest(req.query.date || store.today())));
router.get('/changes', (req, res) => res.json(store.changes(req.query.since, String(req.query.exclude_device || ''))));

// ---------- Záloha ----------
router.get('/backup', (req, res) => res.json(backup.status()));
router.post('/backup/run', wrap(async (req, res) => { await backup.run(); res.json(backup.status()); }));

router.use((req, res) => res.status(404).json({ error: 'Neznámá adresa' }));

module.exports = router;
