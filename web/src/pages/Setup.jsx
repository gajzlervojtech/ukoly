import { useState } from 'react';
import { DEFAULT_SERVER, askNotifPermission, syncReminders } from '../native';

// První spuštění Android aplikace: kde běží server.
export default function Setup() {
  const [url, setUrl] = useState(DEFAULT_SERVER);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function connect(e) {
    e.preventDefault();
    const base = url.trim().replace(/\/+$/, '');
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/api/cards`);
      if (!res.ok) throw new Error(`server odpověděl ${res.status}`);
      await res.json();
      localStorage.setItem('ukoly.server', base);
      await askNotifPermission();
      syncReminders();
      window.location.replace('/');
    } catch (ex) {
      setErr(`Nepodařilo se připojit (${ex.message}). Je zapnutý Tailscale?`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-form setup">
      <div className="setup-logo" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h1 className="setup-title">Naše úkoly</h1>
      <p className="setup-text">Zadejte adresu serveru na NASu. Telefon musí mít zapnutý Tailscale.</p>
      <form className="form" onSubmit={connect}>
        <label className="field">
          <span className="field-label">Adresa serveru</span>
          <input className="input input-main" value={url} onChange={(e) => setUrl(e.target.value)}
            inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </label>
        {err && <div className="info-note warn">{err}</div>}
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Připojuji…' : 'Připojit'}</button>
      </form>
    </div>
  );
}
