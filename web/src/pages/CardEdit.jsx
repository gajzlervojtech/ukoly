import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, COLORS } from '../api';
import { useApp } from '../store';
import { BackHead, Switch } from '../components/ui';

const KINDS = [
  { value: 'deadline', title: 'Úkoly s termínem', desc: 'Každá položka může mít „do kdy“ a připomínku.' },
  { value: 'simple', title: 'Jednoduchý seznam', desc: 'Jen položky k odškrtnutí – dárky, nákup, nápady.' },
  { value: 'mark', title: 'Seznam s označením', desc: 'Položku jde označit jedním tlačítkem, jako „Na NASu“ u filmů.' },
];

export default function CardEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { cards, refreshCards, notify } = useApp();
  const existing = id ? cards?.find((c) => String(c.id) === id) : null;
  const [f, setF] = useState({ name: '', color: COLORS[3].hex, kind: 'simple', mark_label: 'Hotovo', in_digest: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setF({ name: existing.name, color: existing.color, kind: existing.kind, mark_label: existing.mark_label, in_digest: existing.in_digest });
    }
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  async function save(e) {
    e.preventDefault();
    if (!f.name.trim()) { notify('Napište název karty', 'err'); return; }
    setBusy(true);
    try {
      const card = existing
        ? await api.patch(`/cards/${existing.id}`, f)
        : await api.post('/cards', f);
      await refreshCards();
      nav(`/karta/${card.id}`, { replace: true });
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const n = existing.open_count + existing.done_count;
    const msg = n ? `Smazat kartu „${existing.name}“ i s ${n} položkami?` : `Smazat kartu „${existing.name}“?`;
    if (!window.confirm(msg)) return;
    try {
      await api.del(`/cards/${existing.id}`);
      await refreshCards();
      nav('/', { replace: true });
    } catch (err) {
      notify(err.message, 'err');
    }
  }

  if (id && cards && !existing) return <div className="empty">Karta neexistuje.</div>;

  return (
    <div className="page page-form">
      <BackHead title={existing ? 'Upravit kartu' : 'Nová karta'} />
      <form className="form form-page" onSubmit={save}>
        <div className="preview-box">
          <div className="preview-label">Náhled</div>
          <div className="tab active preview-tab">
            <span className="dot" style={{ background: f.color }} />{f.name.trim() || 'Nová karta'}
          </div>
        </div>

        <label className="field">
          <span className="field-label">Název</span>
          <input className="input input-main" value={f.name} maxLength={60} autoFocus={!existing}
            placeholder="Např. Dárky, Dovolená, Na zahradu" onChange={(e) => set({ name: e.target.value })} />
        </label>

        <div className="block">
          <h3>Barva</h3>
          <div className="swatches" role="radiogroup" aria-label="Barva">
            {COLORS.map((c) => (
              <button key={c.hex} type="button" role="radio" aria-checked={f.color === c.hex} aria-label={c.name}
                className={`swatch ${f.color === c.hex ? 'sel' : ''}`} style={{ background: c.hex }}
                onClick={() => set({ color: c.hex })} />
            ))}
          </div>
        </div>

        <div className="block">
          <h3>Jak bude karta fungovat</h3>
          <div className="kinds" role="radiogroup" aria-label="Typ karty">
            {KINDS.map((k) => (
              <button key={k.value} type="button" role="radio" aria-checked={f.kind === k.value}
                className={`kind ${f.kind === k.value ? 'sel' : ''}`}
                onClick={() => set({ kind: k.value, in_digest: k.value === 'deadline' ? (existing?.in_digest ?? true) : false })}>
                <span className="kind-dot" />
                <span className="kind-text"><span className="kind-title">{k.title}</span><span className="kind-desc">{k.desc}</span></span>
              </button>
            ))}
          </div>
        </div>

        {f.kind === 'mark' && (
          <label className="field">
            <span className="field-label">Text označení</span>
            <input className="input" value={f.mark_label} maxLength={30} placeholder="Hotovo"
              onChange={(e) => set({ mark_label: e.target.value })} />
          </label>
        )}

        {f.kind === 'deadline' && (
          <div className="row-between">
            <div className="row-text">
              <div className="row-title">V denní připomínce</div>
              <div className="row-sub">Ukázat termíny z této karty</div>
            </div>
            <Switch checked={f.in_digest} onChange={(v) => set({ in_digest: v })} label="V denní připomínce" />
          </div>
        )}

        <div className="form-foot">
          <button type="submit" className="btn-primary" disabled={busy}>{existing ? 'Uložit' : 'Vytvořit kartu'}</button>
          {existing && cards.length > 1 && (
            <button type="button" className="link-btn danger" onClick={remove}>Smazat kartu</button>
          )}
        </div>
      </form>
    </div>
  );
}
