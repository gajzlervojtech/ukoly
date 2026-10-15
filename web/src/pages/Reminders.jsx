import { useEffect, useState } from 'react';
import { api, plural, serverBase } from '../api';
import { Icon } from '../icons';
import { useApp } from '../store';
import { BackHead, Switch } from '../components/ui';
import {
  BUILD, apkUrl, askNotifPermission, isNative, latestApp, loadReminders, notifPermission, openExternal, saveReminders,
} from '../native';

const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

// Text upozornění – stejný sestavuje běh na pozadí v Android aplikaci (public/runners/check.js).
export function digestText(d, s) {
  const parts = [];
  if (s.overdue && d.overdue.length) parts.push(`Po termínu: ${d.overdue.map((i) => i.title).join(', ')}.`);
  if (s.today && d.today.length) parts.push(`Dnes: ${d.today.map((i) => (i.due_time ? `${i.title} (${i.due_time})` : i.title)).join(', ')}.`);
  const n = (s.today ? d.today.length : 0) + (s.overdue ? d.overdue.length : 0);
  let title;
  if (!n) title = 'Dobré ráno! Dnes nic nehoří';
  else if (s.today && d.today.length) title = `Dobré ráno! Dnes ${d.today.length} ${plural(d.today.length, 'úkol', 'úkoly', 'úkolů')}`;
  else title = `Dobré ráno! ${n} ${plural(n, 'úkol', 'úkoly', 'úkolů')} po termínu`;
  return { title, body: parts.join(' ') || 'Žádné úkoly s termínem na dnes.' };
}

export default function Reminders() {
  const { notify } = useApp();
  const [s, setS] = useState(loadReminders);
  const [digest, setDigest] = useState(null);
  const [backup, setBackup] = useState(null);
  const [perm, setPerm] = useState(null);
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    api.get('/digest').then(setDigest).catch(() => {});
    api.get('/backup').then(setBackup).catch(() => {});
    if (isNative) {
      notifPermission().then(setPerm);
      latestApp().then(setLatest);
    }
  }, []);

  const set = (patch) => setS((x) => {
    const n = { ...x, ...patch };
    saveReminders(n);
    return n;
  });

  async function allow() {
    setPerm(await askNotifPermission());
    saveReminders(s);
  }

  async function runBackup() {
    try {
      setBackup(await api.post('/backup/run'));
      notify('Záloha hotová');
    } catch (e) {
      notify(e.message, 'err');
    }
  }

  function changeServer() {
    const v = window.prompt('Adresa serveru', serverBase());
    if (v == null) return;
    try { localStorage.setItem('ukoly.server', v.trim().replace(/\/+$/, '')); } catch { /* */ }
    window.location.reload();
  }

  const preview = digest ? digestText(digest, s) : null;
  const include = [
    { key: 'today', label: 'Úkoly s termínem na dnes' },
    { key: 'overdue', label: 'Úkoly po termínu' },
    { key: 'added', label: 'Nové položky ve Filmech a seriálech' },
  ];
  const hasUpdate = isNative && latest && latest.versionCode > BUILD;

  return (
    <div className="page page-form">
      <BackHead title="Připomínky" />
      <div className="form form-page">
        <div className="notif-preview">
          <div className="notif-kicker">Takhle přijde na telefon</div>
          <div className="notif">
            <div className="notif-ico"><Icon name="check" size={20} stroke={2.6} /></div>
            <div className="notif-main">
              <div className="notif-meta"><span>Naše úkoly</span><span>{fmt(s.mins)}</span></div>
              <div className="notif-title">{preview ? preview.title : 'Načítám…'}</div>
              {preview && <div className="notif-body">{preview.body}</div>}
            </div>
          </div>
        </div>

        {!isNative && (
          <div className="info-note">
            Upozornění zobrazuje Android aplikace. Stáhnout ji můžete na <a className="txt-link" href="/apk/ukoly.apk">/apk/ukoly.apk</a>.
          </div>
        )}
        {isNative && perm && perm !== 'granted' && (
          <div className="info-note warn">
            <div>Aplikace zatím nesmí posílat upozornění.</div>
            <button type="button" className="btn-small" onClick={allow}>Povolit upozornění</button>
          </div>
        )}

        <div className="row-between">
          <div className="row-text">
            <div className="row-title strong">Denní přehled</div>
            <div className="row-sub">Jedno upozornění každý den · nastavení jen pro tento telefon</div>
          </div>
          <Switch checked={s.on} onChange={(v) => set({ on: v })} label="Denní přehled" />
        </div>

        <div className={`time-card ${s.on ? '' : 'off'}`}>
          <button type="button" className="round-btn soft big" onClick={() => set({ mins: (s.mins + 1425) % 1440 })} aria-label="O 15 minut dříve"><Icon name="minus" /></button>
          <div className="time-big">
            <div className="time-val">{fmt(s.mins)}</div>
            <div className="row-sub">čas upozornění</div>
          </div>
          <button type="button" className="round-btn soft big" onClick={() => set({ mins: (s.mins + 15) % 1440 })} aria-label="O 15 minut později"><Icon name="plus" /></button>
        </div>

        <div className="block">
          <h3>Ve které dny</h3>
          <div className="days">
            {DAY_LABELS.map((d, i) => (
              <button key={d} type="button" aria-pressed={s.days[i]} className={`day ${s.days[i] ? 'on' : ''}`}
                onClick={() => { const days = s.days.slice(); days[i] = !days[i]; set({ days }); }}>{d}</button>
            ))}
          </div>
        </div>

        <div className="block">
          <h3>Co hlásit</h3>
          <div className="checklist">
            {include.map((o) => (
              <button key={o.key} type="button" role="checkbox" aria-checked={s[o.key]} className="check-row"
                onClick={() => set({ [o.key]: !s[o.key] })}>
                <span>{o.label}</span>
                <span className={`box ${s[o.key] ? 'on' : ''}`}>{s[o.key] && <Icon name="check" size={14} stroke={3} />}</span>
              </button>
            ))}
          </div>
          {isNative && (
            <div className="row-sub">
              Nové filmy se kontrolují zhruba každých 15 minut, když je zapnutý Tailscale. Aby přehled chodil přesně na minutu,
              povolte v Nastavení Androidu → Aplikace → Úkoly → „Alarmy a připomenutí“.
            </div>
          )}
        </div>

        {isNative && (
          <div className="block">
            <h3>Aplikace</h3>
            <div className="row-between">
              <div className="row-text">
                <div className="row-title">Verze {BUILD || 'vývojová'}</div>
                <div className="row-sub">
                  {hasUpdate ? `K dispozici je verze ${latest.versionCode}` : (latest ? 'Máte nejnovější verzi' : 'Nepodařilo se zjistit novou verzi')}
                </div>
              </div>
              {hasUpdate && <button type="button" className="btn-small" onClick={() => openExternal(apkUrl())}>Stáhnout</button>}
            </div>
            <div className="row-between">
              <div className="row-text">
                <div className="row-title">Server</div>
                <div className="row-sub break">{serverBase()}</div>
              </div>
              <button type="button" className="link-btn" onClick={changeServer}>Změnit</button>
            </div>
          </div>
        )}

        {backup && (
          <div className="block">
            <h3>Záloha</h3>
            <div className="row-sub">
              {backup.enabled
                ? (backup.last
                  ? `Poslední záloha ${new Date(backup.last).toLocaleDateString('cs-CZ')}, další zhruba ${new Date(backup.next).toLocaleDateString('cs-CZ')}.`
                  : 'Zatím žádná záloha.')
                : 'Záloha není nastavená (v compose.yaml chybí BACKUP_DIR).'}
            </div>
            {backup.enabled && <button type="button" className="link-btn" onClick={runBackup}>Zálohovat teď</button>}
          </div>
        )}
      </div>
    </div>
  );
}
