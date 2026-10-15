import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  const refreshCards = useCallback(async () => {
    try {
      setCards(await api.get('/cards'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    refreshCards();
    // druhý telefon mohl něco přidat → občas obnovit
    const t = setInterval(() => { if (document.visibilityState === 'visible') refreshCards(); }, 15000);
    const onVis = () => { if (document.visibilityState === 'visible') refreshCards(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [refreshCards]);

  return (
    <Ctx.Provider value={{ cards, setCards, refreshCards, error, notify }}>
      {children}
      {toast && <div className={`toast toast-${toast.kind}`} role="status">{toast.text}</div>}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);

// Obnovuje data, když je stránka vidět (a každých 15 s).
export function usePolling(fn, deps) {
  useEffect(() => {
    fn();
    const t = setInterval(() => { if (document.visibilityState === 'visible') fn(); }, 15000);
    const onVis = () => { if (document.visibilityState === 'visible') fn(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
