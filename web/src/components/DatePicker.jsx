import { useState } from 'react';
import { Icon } from '../icons';
import { MONTHS, WD_SHORT, fromStr, toStr, todayStr } from '../dates';

// Měsíční kalendář; value = 'YYYY-MM-DD' nebo null.
export default function DatePicker({ value, onChange }) {
  const today = todayStr();
  const start = fromStr(value || today);
  const [ym, setYm] = useState({ y: start.getFullYear(), m: start.getMonth() });

  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(toStr(new Date(ym.y, ym.m, d)));
  while (cells.length % 7) cells.push(null);

  const move = (n) => setYm(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div className="cal">
      <div className="cal-head">
        <div className="cal-title">{MONTHS[ym.m]} {ym.y}</div>
        <div className="cal-nav">
          <button type="button" onClick={() => move(-1)} aria-label="Předchozí měsíc"><Icon name="left" size={16} stroke={2} /></button>
          <button type="button" onClick={() => move(1)} aria-label="Další měsíc"><Icon name="right" size={16} stroke={2} /></button>
        </div>
      </div>
      <div className="cal-grid cal-wd">{WD_SHORT.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="cal-grid">
        {cells.map((s, i) => (s
          ? (
            <button key={s} type="button"
              className={`cal-day ${s === value ? 'sel' : ''} ${s === today ? 'today' : ''} ${s < today ? 'past' : ''}`}
              aria-pressed={s === value}
              aria-label={`${Number(s.slice(8))}. ${Number(s.slice(5, 7))}.`}
              onClick={() => onChange(s)}>
              {Number(s.slice(8))}
            </button>
          )
          : <span key={`e${i}`} />))}
      </div>
    </div>
  );
}
