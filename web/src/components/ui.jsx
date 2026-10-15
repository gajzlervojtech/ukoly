import { useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '../icons';
import { useApp } from '../store';

export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="round-btn soft" onClick={onClose} aria-label="Zavřít"><Icon name="close" size={18} stroke={2} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={16} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function BackHead({ title, to = -1 }) {
  const nav = useNavigate();
  return (
    <header className="back-head">
      <button className="round-btn ghost" onClick={() => nav(to)} aria-label="Zpět"><Icon name="left" size={22} stroke={2} /></button>
      <h1>{title}</h1>
    </header>
  );
}

// Přepínač karet nahoře
export function CardTabs() {
  const { cards } = useApp();
  if (!cards) return null;
  return (
    <nav className="tabs" aria-label="Karty">
      {cards.map((c) => (
        <NavLink key={c.id} to={`/karta/${c.id}`} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          <span className="dot" style={{ background: c.color }} />
          {c.name}
          {c.open_count > 0 && <span className="tab-count">{c.open_count}</span>}
        </NavLink>
      ))}
      <Link to="/nova-karta" className="tab tab-add" aria-label="Nová karta"><Icon name="plus" size={18} stroke={2} /></Link>
    </nav>
  );
}

export function Check({ done, overdue, onClick, label = 'Označit jako hotové' }) {
  return (
    <button type="button" className={`check ${done ? 'done' : ''} ${overdue ? 'over' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} aria-pressed={done}>
      {done && <Icon name="check" size={14} stroke={3} />}
    </button>
  );
}
