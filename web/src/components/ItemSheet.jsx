import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { useApp } from '../store';
import { deviceId } from '../native';
import { dueLabel, quickDates, todayStr } from '../dates';
import DatePicker from './DatePicker';
import { Segmented, Sheet, Switch } from './ui';

const empty = { title: '', note: '', variant: 'film', due_date: null, due_time: null, remind: true, done: false };

// Přidání / úprava položky. item = null → nová položka (initial = předvyplnění).
export default function ItemSheet({ open, card, item, initial, onClose, onSaved }) {
  const { notify } = useApp();
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const isMedia = card?.preset === 'media';
  const isDeadline = card?.kind === 'deadline';
  const isMark = card?.kind === 'mark';

  useEffect(() => {
    if (!open) return;
    if (item) setF({ ...empty, ...item, variant: item.variant || 'film' });
    else setF({ ...empty, ...initial });
  }, [open, item, initial]);

  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  async function save(e) {
    e?.preventDefault();
    if (!f.title.trim()) { notify('Napište název', 'err'); return; }
    const body = { title: f.title, note: f.note };
    if (isMedia) body.variant = f.variant;
    if (isDeadline) Object.assign(body, { due_date: f.due_date, due_time: f.due_date ? f.due_time : null, remind: f.remind });
    if (isMark) body.done = f.done;
    setBusy(true);
    try {
      if (item) await api.patch(`/items/${item.id}`, body);
      else await api.post(`/cards/${card.id}/items`, { ...body, device: deviceId() });
      onSaved();
      onClose();
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Smazat „${item.title}“?`)) return;
    try {
      await api.del(`/items/${item.id}`);
      onSaved();
      onClose();
    } catch (err) {
      notify(err.message, 'err');
    }
  }

  const today = todayStr();
  const title = item ? 'Upravit' : (isMedia ? 'Nový film nebo seriál' : (isDeadline ? 'Nový úkol' : 'Nová položka'));

  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={(
        <div className="sheet-actions">
          {item && (
            <button type="button" className="round-btn soft danger" onClick={remove} aria-label="Smazat"><Icon name="trash" size={20} /></button>
          )}
          <button type="submit" form="item-form" className="btn-primary" disabled={busy}>
            {item ? 'Uložit' : (isDeadline ? 'Uložit úkol' : 'Přidat')}
          </button>
        </div>
      )}>
      <form id="item-form" className="form" onSubmit={save}>
        <label className="field">
          <span className="sr-only">Název</span>
          <input className="input input-main" value={f.title} autoFocus={!item}
            placeholder={isMedia ? 'Název filmu nebo seriálu' : 'Co je potřeba udělat?'}
            onChange={(e) => set({ title: e.target.value })} />
        </label>

        {isMedia && (
          <Segmented label="Druh" value={f.variant} onChange={(v) => set({ variant: v })}
            options={[{ value: 'film', label: 'Film', icon: 'film' }, { value: 'serial', label: 'Seriál', icon: 'tv' }]} />
        )}

        <label className="field">
          <span className="sr-only">Poznámka</span>
          <input className="input input-soft" value={f.note}
            placeholder={isMedia ? 'Poznámka, třeba „1. řada“ (nepovinné)' : 'Poznámka (nepovinné)'}
            onChange={(e) => set({ note: e.target.value })} />
        </label>

        {isDeadline && (
          <>
            <div className="block">
              <div className="block-head">
                <h3>Do kdy?</h3>
                <span className="block-note">{f.due_date ? dueLabel(f.due_date, f.due_time, today) : 'Bez termínu'}</span>
              </div>
              <div className="chips">
                {quickDates(today).map((q) => (
                  <button key={q.label} type="button" className={`chip ${f.due_date === q.value ? 'active' : ''}`}
                    onClick={() => set({ due_date: q.value })}>{q.label}</button>
                ))}
              </div>
            </div>
            <DatePicker value={f.due_date} onChange={(d) => set({ due_date: d })} />
            {f.due_date && (
              <div className="row-between">
                <div className="row-text">
                  <div className="row-title">Čas</div>
                  <div className="row-sub">Nepovinné – třeba „do 20:00“</div>
                </div>
                <div className="time-wrap">
                  <input type="time" className="input time-input" value={f.due_time || ''}
                    aria-label="Čas termínu" onChange={(e) => set({ due_time: e.target.value || null })} />
                  {f.due_time && (
                    <button type="button" className="round-btn ghost small" onClick={() => set({ due_time: null })} aria-label="Zrušit čas">
                      <Icon name="close" size={16} stroke={2} />
                    </button>
                  )}
                </div>
              </div>
            )}
            {f.due_date && f.due_time && (
              <div className="row-between">
                <div className="row-text">
                  <div className="row-title">Upozornit v {f.due_time}</div>
                  <div className="row-sub">V den termínu přijde i v denním přehledu</div>
                </div>
                <Switch checked={f.remind} onChange={(v) => set({ remind: v })} label={`Upozornit v ${f.due_time}`} />
              </div>
            )}
          </>
        )}

        {isMark && (
          <div className="row-between">
            <div className="row-title">{card.mark_label}</div>
            <Switch checked={f.done} onChange={(v) => set({ done: v })} label={card.mark_label} />
          </div>
        )}
      </form>
    </Sheet>
  );
}
