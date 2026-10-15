// Karty a položky – veškerá logika nad databází (API ji jen volá).
const { db, KINDS, now } = require('./db');

const TZ = process.env.TZ || 'Europe/Prague';

function bad(msg) {
  return Object.assign(new Error(msg), { status: 400 });
}
function notFound(msg = 'Nenalezeno') {
  return Object.assign(new Error(msg), { status: 404 });
}

// Dnešní datum (YYYY-MM-DD) v časové zóně domácnosti.
function today(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Místní čas domácnosti jako „YYYY-MM-DDTHH:MM“ (telefon podle něj plánuje upozornění).
function localNow(date = new Date()) {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
  return s.replace(' ', 'T');
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isColor = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);

function text(v, max, field, required = false) {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (required && !s) throw bad(`Chybí ${field}`);
  if (s.length > max) throw bad(`${field} je moc dlouhý`);
  return s;
}

// ---------- Karty ----------

function cardRow(c) {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    kind: c.kind,
    mark_label: c.mark_label,
    preset: c.preset,
    in_digest: !!c.in_digest,
    sort: c.sort,
    open_count: c.open_count ?? 0,
    done_count: c.done_count ?? 0,
    updated_at: c.updated_at,
  };
}

function listCards() {
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM items i WHERE i.card_id = c.id AND i.done = 0) AS open_count,
      (SELECT COUNT(*) FROM items i WHERE i.card_id = c.id AND i.done = 1) AS done_count
    FROM cards c ORDER BY c.sort, c.id`).all().map(cardRow);
}

function getCard(id) {
  const c = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM items i WHERE i.card_id = c.id AND i.done = 0) AS open_count,
      (SELECT COUNT(*) FROM items i WHERE i.card_id = c.id AND i.done = 1) AS done_count
    FROM cards c WHERE c.id = ?`).get(id);
  if (!c) throw notFound('Karta neexistuje');
  return cardRow(c);
}

function cardFields(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) out.name = text(body.name, 60, 'Název', true);
  if (body.color !== undefined) {
    if (!isColor(body.color)) throw bad('Neplatná barva');
    out.color = body.color.toUpperCase();
  }
  if (body.kind !== undefined) {
    if (!KINDS.includes(body.kind)) throw bad('Neplatný typ karty');
    out.kind = body.kind;
  }
  if (body.mark_label !== undefined) out.mark_label = text(body.mark_label, 30, 'Označení') || 'Hotovo';
  if (body.in_digest !== undefined) out.in_digest = body.in_digest ? 1 : 0;
  return out;
}

function createCard(body) {
  const f = cardFields(body, false);
  const sort = db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM cards').get().s;
  const t = now();
  const info = db.prepare(`INSERT INTO cards (name, color, kind, mark_label, in_digest, sort, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    f.name, f.color || '#2FB386', f.kind || 'deadline', f.mark_label || 'Hotovo',
    f.in_digest ?? ((f.kind || 'deadline') === 'deadline' ? 1 : 0), sort, t, t,
  );
  return getCard(info.lastInsertRowid);
}

function updateCard(id, body) {
  getCard(id);
  const f = cardFields(body, true);
  const keys = Object.keys(f);
  if (keys.length) {
    db.prepare(`UPDATE cards SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = @t WHERE id = @id`)
      .run({ ...f, t: now(), id });
  }
  return getCard(id);
}

function deleteCard(id) {
  getCard(id);
  if (db.prepare('SELECT COUNT(*) AS n FROM cards').get().n <= 1) throw bad('Poslední kartu nejde smazat');
  db.prepare('DELETE FROM cards WHERE id = ?').run(id);
}

function reorderCards(ids) {
  if (!Array.isArray(ids)) throw bad('Chybí pořadí');
  const upd = db.prepare('UPDATE cards SET sort = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => upd.run(i, id)))();
  return listCards();
}

// ---------- Položky ----------

function itemRow(i) {
  return {
    id: i.id,
    card_id: i.card_id,
    title: i.title,
    note: i.note,
    variant: i.variant,
    due_date: i.due_date,
    due_time: i.due_time,
    remind: !!i.remind,
    done: !!i.done,
    done_at: i.done_at,
    created_at: i.created_at,
    updated_at: i.updated_at,
  };
}

function getItem(id) {
  const i = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!i) throw notFound('Položka neexistuje');
  return itemRow(i);
}

// Otevřené: s termínem podle data (bez termínu na konec), jinak nejnovější nahoře.
// U karty s označením zůstávají označené položky v seznamu, jen jdou za neoznačené.
function listItems(cardId) {
  const card = getCard(cardId);
  const rows = db.prepare('SELECT * FROM items WHERE card_id = ?').all(cardId).map(itemRow);
  const byDue = (a, b) => (a.due_date == null) - (b.due_date == null)
    || String(a.due_date || '').localeCompare(String(b.due_date || ''))
    || String(a.due_time || '99').localeCompare(String(b.due_time || '99'))
    || a.created_at.localeCompare(b.created_at);
  const newest = (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id;
  const open = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));
  open.sort(card.kind === 'deadline' ? byDue : (card.kind === 'mark' ? newest : (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id));
  if (card.kind === 'mark') done.sort(newest);
  return { card, open, done };
}

function itemFields(body, partial) {
  const out = {};
  if (!partial || body.title !== undefined) out.title = text(body.title, 200, 'Název', true);
  if (body.note !== undefined) out.note = String(body.note ?? '').trim().slice(0, 2000);
  if (body.variant !== undefined) {
    if (!['', 'film', 'serial'].includes(body.variant)) throw bad('Neplatný druh');
    out.variant = body.variant;
  }
  if (body.due_date !== undefined) {
    if (body.due_date !== null && body.due_date !== '' && !isDate(body.due_date)) throw bad('Neplatné datum');
    out.due_date = body.due_date || null;
    if (!out.due_date) out.due_time = null;
  }
  if (body.due_time !== undefined && out.due_time === undefined) {
    if (body.due_time !== null && body.due_time !== '' && !isTime(body.due_time)) throw bad('Neplatný čas');
    out.due_time = body.due_time || null;
  }
  if (body.remind !== undefined) out.remind = body.remind ? 1 : 0;
  if (body.done !== undefined) {
    out.done = body.done ? 1 : 0;
    out.done_at = body.done ? now() : null;
  }
  if (body.card_id !== undefined) {
    getCard(body.card_id);
    out.card_id = Number(body.card_id);
  }
  return out;
}

function createItem(cardId, body) {
  getCard(cardId);
  const f = itemFields(body, false);
  const t = now();
  const info = db.prepare(`INSERT INTO items (card_id, title, note, variant, due_date, due_time, remind, done, done_at, device, created_at, updated_at)
    VALUES (@card_id, @title, @note, @variant, @due_date, @due_time, @remind, @done, @done_at, @device, @t, @t)`).run({
    card_id: cardId,
    device: String(body.device || '').slice(0, 64),
    title: f.title,
    note: f.note ?? '',
    variant: f.variant ?? '',
    due_date: f.due_date ?? null,
    due_time: f.due_date ? (f.due_time ?? null) : null,
    remind: f.remind ?? 1,
    done: f.done ?? 0,
    done_at: f.done ? t : null,
    t,
  });
  return getItem(info.lastInsertRowid);
}

function updateItem(id, body) {
  const before = getItem(id);
  const f = itemFields(body, true);
  if (f.due_time && !(f.due_date ?? before.due_date)) f.due_time = null;
  const keys = Object.keys(f);
  if (keys.length) {
    db.prepare(`UPDATE items SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = @t WHERE id = @id`)
      .run({ ...f, t: now(), id });
  }
  return getItem(id);
}

function deleteItem(id) {
  getItem(id);
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
}

function clearDone(cardId) {
  getCard(cardId);
  return db.prepare('DELETE FROM items WHERE card_id = ? AND done = 1').run(cardId).changes;
}

// ---------- Pro telefon: denní přehled a novinky ----------

// Úkoly s termínem dnes a po termínu z karet, které patří do denního přehledu.
function digest(date = today()) {
  if (!isDate(date)) throw bad('Neplatné datum');
  const rows = db.prepare(`
    SELECT i.*, c.name AS card_name, c.color AS card_color
    FROM items i JOIN cards c ON c.id = i.card_id
    WHERE i.done = 0 AND i.due_date IS NOT NULL AND i.due_date <= ? AND c.in_digest = 1
    ORDER BY i.due_date, COALESCE(i.due_time, '99'), i.created_at`).all(date);
  const map = (r) => ({ ...itemRow(r), card_name: r.card_name, card_color: r.card_color });
  const overdue = rows.filter((r) => r.due_date < date).map(map);
  const todayItems = rows.filter((r) => r.due_date === date).map(map);
  return { date, now: localNow(), overdue, today: todayItems };
}

// Položky přidané po daném okamžiku (telefon podle toho ukáže „přibylo…“).
// excludeDevice = vlastní položky telefonu se nevrací.
function changes(since, excludeDevice = '') {
  const t = now();
  if (!since || Number.isNaN(Date.parse(since))) return { now: t, added: [] };
  const added = db.prepare(`
    SELECT i.*, c.name AS card_name, c.preset AS card_preset FROM items i JOIN cards c ON c.id = i.card_id
    WHERE i.created_at > ? AND (? = '' OR i.device != ?) ORDER BY i.created_at`)
    .all(new Date(since).toISOString(), excludeDevice, excludeDevice)
    .map((r) => ({ ...itemRow(r), card_name: r.card_name, card_preset: r.card_preset }));
  return { now: t, added };
}

module.exports = {
  today, localNow, isDate, isTime,
  listCards, getCard, createCard, updateCard, deleteCard, reorderCards,
  listItems, getItem, createItem, updateItem, deleteItem, clearDone,
  digest, changes,
};
