import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { serverBase } from './api';
import { useApp } from './store';
import { BUILD, apkUrl, isNative, latestApp, openExternal } from './native';
import CardPage from './pages/CardPage';
import CardEdit from './pages/CardEdit';
import Reminders from './pages/Reminders';
import Setup from './pages/Setup';

function Home() {
  const { cards, error } = useApp();
  if (error && !cards) {
    return (
      <div className="empty">
        Server neodpovídá: {error}
        {isNative && <div className="row-sub">Je zapnutý Tailscale?</div>}
      </div>
    );
  }
  if (!cards) return <div className="empty">Načítám…</div>;
  return <Navigate to={`/karta/${cards[0].id}`} replace />;
}

// V Android aplikaci: upozornění na novou verzi (APK leží na NASu).
function UpdateBar() {
  const [latest, setLatest] = useState(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { latestApp().then(setLatest); }, []);
  if (hidden || !latest || !(latest.versionCode > BUILD)) return null;
  return (
    <div className="update-bar" role="status">
      <span>Je tu nová verze aplikace</span>
      <button type="button" className="btn-small" onClick={() => openExternal(apkUrl())}>Stáhnout</button>
      <button type="button" className="update-x" onClick={() => setHidden(true)} aria-label="Skrýt">×</button>
    </div>
  );
}

export default function App() {
  if (isNative && !serverBase()) return <div className="app"><Setup /></div>;
  return (
    <div className="app">
      {isNative && <UpdateBar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/karta/:id" element={<CardPage />} />
        <Route path="/karta/:id/upravit" element={<CardEdit />} />
        <Route path="/nova-karta" element={<CardEdit />} />
        <Route path="/pripominky" element={<Reminders />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
