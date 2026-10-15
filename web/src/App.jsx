import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './store';
import CardPage from './pages/CardPage';
import CardEdit from './pages/CardEdit';
import Reminders from './pages/Reminders';

function Home() {
  const { cards, error } = useApp();
  if (error && !cards) return <div className="empty">Server neodpovídá: {error}</div>;
  if (!cards) return <div className="empty">Načítám…</div>;
  return <Navigate to={`/karta/${cards[0].id}`} replace />;
}

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/karta/:id" element={<CardPage />} />
        <Route path="/karta/:id/upravit" element={<CardEdit />} />
        <Route path="/nova-karta" element={<CardEdit />} />
        <Route path="/pripominky" element={<Reminders />} />
        <Route path="*" element={<div className="empty">Stránka neexistuje.</div>} />
      </Routes>
    </div>
  );
}
