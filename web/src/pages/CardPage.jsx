import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, plural } from '../api';
import { Icon } from '../icons';
import { usePolling, useApp } from '../store';
import { GROUPS, dueGroup, dueLabel, longToday, todayStr } from '../dates';
import { CardTabs, Check } from '../components/ui';
import ItemSheet from '../components/ItemSheet';
import { deviceId } from '../native';

const TILES = ['tile-blue', 'tile-orange', 'tile-green', 'tile-pink'];

function TaskRow({ item, today, showDue, onToggle, onOpen }) {
  const g = dueGroup(item.due_date, today);
  return (
    <div className="item" onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <Check done={item.done} overdue={!item.done && g === 'over'} onClick={onToggle} />
      <div className="item-main">
        <div className={`item-title ${item.done ? 'is-done' : ''}`}>{item.title}</div>
        {item.note && <div className="item-note">{item.note}</div>}
        {showDue && item.due_date && !item.done && (
          <span className={`due due-${g}`}><Icon name="calendar" size={14} stroke={2} />{dueLabel(item.due_date, item.due_time, today)}</span>
        )}
      </div>
    </div>
  );
}

function MarkRow({ item, card, index, onToggle, onOpen }) {
  const media = card.preset === 'media';
  const meta = media
    ? [item.variant === 'serial' ? 'Seriál' : 'Film', item.note].filter(Boolean).join(' · ')
    : item.note;
  return (
    <div className="item item-mark" onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      {media && (
        <div className={`tile ${TILES[index % TILES.length]}`}>
          <Icon name={item.variant === 'serial' ? 'tv' : 'film'} size={22} />
        </div>
      )}
      <div className="item-main">
        <div className="item-title strong">{item.title}</div>
        {meta && <div className="item-note">{meta}</div>}
      </div>
      {item.done
        ? (
          <button type="button" className="mark-btn on" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            <Icon name="check" size={14} stroke={2.6} />{card.mark_label}
          </button>
        )
        : (
          <button type="button" className="mark-btn" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {media ? 'Mám na NASu' : card.mark_label}
          </button>
        )}
    </div>
  );
}

export default function CardPage() {
  const { id } = useParams();
  const { notify, refreshCards, cards } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [sheet, setSheet] = useState(null); // { item, initial }
  const [text, setText] = useState('');
  const [variant, setVariant] = useState('film');
  const today = todayStr();

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/cards/${id}/items`);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { setData(null); setShowDone(false); }, [id]);
  usePolling(load, [id]);

  const reload = useCallback(() => { load(); refreshCards(); }, [load, refreshCards]);

  const card = data?.card || cards?.find((c) => String(c.id) === id);

  async function toggle(item) {
    // hned přepnout, server potom
    setData((d) => {
      const it = { ...item, done: !item.done };
      const open = d.open.filter((x) => x.id !== item.id);
      const done = d.done.filter((x) => x.id !== item.id);
      if (d.card.kind === 'mark') {
        return it.done ? { ...d, open, done: [it, ...done] } : { ...d, open: [it, ...open], done };
      }
      // u úkolů nechat chvilku přeškrtnuté na místě
      return { ...d, open: d.open.map((x) => (x.id === item.id ? it : x)), done: d.done.map((x) => (x.id === item.id ? it : x)) };
    });
    try {
      await api.patch(`/items/${item.id}`, { done: !item.done });
      setTimeout(reload, data?.card.kind === 'mark' ? 0 : 900);
    } catch (e) {
      notify(e.message, 'err');
      load();
    }
  }

  async function quickAdd(e) {
    e.preventDefault();
    const title = text.trim();
    if (!title) { setSheet({ item: null, initial: { variant } }); return; }
    try {
      await api.post(`/cards/${id}/items`, card.preset === 'media' ? { title, variant, device: deviceId() } : { title, device: deviceId() });
      setText('');
      reload();
    } catch (err) {
      notify(err.message, 'err');
    }
  }

  async function clearDone() {
    if (!window.confirm('Smazat všechny hotové položky?')) return;
    await api.post(`/cards/${id}/clear-done`);
    setShowDone(false);
    reload();
  }

  const groups = useMemo(() => {
    if (!data || data.card.kind !== 'deadline') return [];
    return GROUPS.map((g) => ({ ...g, items: data.open.filter((i) => dueGroup(i.due_date, today) === g.key) }))
      .filter((g) => g.items.length);
  }, [data, today]);

  let subtitle = '';
  if (data) {
    const { open, done } = data;
    if (data.card.kind === 'deadline') {
      const t = open.filter((i) => !i.done && i.due_date === today).length;
      const o = open.filter((i) => !i.done && i.due_date && i.due_date < today).length;
      subtitle = (
        <>
          {t} na dnes
          {o > 0 && <> · <span className="txt-over">{o} po termínu</span></>}
        </>
      );
    } else if (data.card.kind === 'mark') {
      subtitle = data.card.preset === 'media'
        ? `${open.length} čeká na stažení · ${done.length} na NASu`
        : `${open.length} ${plural(open.length, 'otevřená', 'otevřené', 'otevřených')} · ${done.length} ${data.card.mark_label.toLowerCase()}`;
    } else {
      subtitle = `${open.length} ${plural(open.length, 'položka', 'položky', 'položek')}`;
    }
  }

  const isDeadline = card?.kind === 'deadline';
  const isMark = card?.kind === 'mark';
  const isMedia = card?.preset === 'media';
  const markItems = data ? [...data.open, ...data.done] : [];

  return (
    <div className="page">
      <header className="top">
        <div className="top-text">
          <div className="top-kicker">{isMedia ? 'Co chceme vidět' : longToday(today)}</div>
          <h1>{card?.name || ' '}</h1>
          <div className="top-sub">{subtitle}</div>
        </div>
        <div className="top-actions">
          <Link to="/pripominky" className="round-btn" aria-label="Připomínky"><Icon name="bell" /></Link>
          <Link to={`/karta/${id}/upravit`} className="round-btn" aria-label="Upravit kartu"><Icon name="sliders" /></Link>
        </div>
      </header>

      <CardTabs />

      <main className="list">
        {error && !data && <div className="empty">Nejde načíst: {error}</div>}
        {!data && !error && <div className="empty">Načítám…</div>}

        {data && isDeadline && groups.map((g) => (
          <section key={g.key} className="group">
            <h2 className={`group-title ${g.key === 'over' ? 'txt-over' : ''} ${g.key === 'today' ? 'strong' : ''}`}>{g.label}</h2>
            {g.items.map((it) => (
              <TaskRow key={it.id} item={it} today={today} showDue={g.key !== 'none'}
                onToggle={() => toggle(it)} onOpen={() => setSheet({ item: it })} />
            ))}
          </section>
        ))}

        {data && card.kind === 'simple' && (
          <section className="group">
            {data.open.map((it) => (
              <TaskRow key={it.id} item={it} today={today} showDue={false}
                onToggle={() => toggle(it)} onOpen={() => setSheet({ item: it })} />
            ))}
          </section>
        )}

        {data && isMark && (
          <section className="group">
            {markItems.map((it, i) => (
              <MarkRow key={it.id} item={it} card={data.card} index={i}
                onToggle={() => toggle(it)} onOpen={() => setSheet({ item: it })} />
            ))}
          </section>
        )}

        {data && data.open.length === 0 && (!isMark || data.done.length === 0) && (
          <div className="empty">
            {isMedia ? 'Zatím tu nic není. Napište dolů název filmu nebo seriálu.' : 'Hotovo, nic tu nečeká.'}
          </div>
        )}

        {data && !isMark && data.done.length > 0 && (
          <section className="group">
            <button className="done-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
              <Icon name={showDone ? 'up' : 'down'} size={16} stroke={2} />Hotovo · {data.done.length}
            </button>
            {showDone && (
              <>
                {data.done.map((it) => (
                  <TaskRow key={it.id} item={it} today={today} showDue={false}
                    onToggle={() => toggle(it)} onOpen={() => setSheet({ item: it })} />
                ))}
                <button className="link-btn" onClick={clearDone}>Smazat hotové</button>
              </>
            )}
          </section>
        )}
      </main>

      {card && (
        <form className="quick" onSubmit={quickAdd}>
          <div className="quick-input">
            {isMedia && (
              <button type="button" className="quick-variant" onClick={() => setVariant((v) => (v === 'film' ? 'serial' : 'film'))}
                aria-label={`Druh: ${variant === 'film' ? 'film' : 'seriál'} (přepnout)`} title={variant === 'film' ? 'Film' : 'Seriál'}>
                <Icon name={variant === 'film' ? 'film' : 'tv'} size={20} />
              </button>
            )}
            <label className="sr-only" htmlFor="quick-text">Nová položka</label>
            <input id="quick-text" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
              placeholder={isMedia ? 'Přidat film nebo seriál…' : (isDeadline ? 'Přidat úkol…' : 'Přidat položku…')} />
            {isDeadline && (
              <button type="button" className="quick-cal" aria-label="Přidat s termínem"
                onClick={() => { setSheet({ item: null, initial: { title: text } }); setText(''); }}>
                <Icon name="calendar" />
              </button>
            )}
          </div>
          <button type="submit" className="fab" aria-label="Přidat"><Icon name="plus" size={24} stroke={2.2} /></button>
        </form>
      )}

      <ItemSheet open={!!sheet} card={card} item={sheet?.item || null} initial={sheet?.initial}
        onClose={() => setSheet(null)} onSaved={reload} />
    </div>
  );
}
