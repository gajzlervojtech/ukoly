// Napojení na Android aplikaci (Capacitor). Ve webu se nic z toho nespouští.
import { Capacitor } from '@capacitor/core';
import { BackgroundRunner } from '@capacitor/background-runner';
import { serverBase } from './api';

export const isNative = Capacitor.isNativePlatform();
export const BUILD = Number(import.meta.env.VITE_BUILD || 0);
export const DEFAULT_SERVER = 'https://nas-doma.tailabba48.ts.net:8443';
const LABEL = 'cz.gajzler.ukoly.check';

// Náhodné id zařízení – server podle něj pozná, kdo položku přidal (bez účtů).
export function deviceId() {
  try {
    let id = localStorage.getItem('ukoly.device');
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).slice(0, 36);
      localStorage.setItem('ukoly.device', id);
    }
    return id;
  } catch {
    return '';
  }
}

// ---------- nastavení připomínek (jen v tomto telefonu) ----------
const KEY = 'ukoly.reminders';
export const REMINDER_DEFAULTS = { on: true, mins: 450, days: [true, true, true, true, true, true, true], today: true, overdue: true, added: true };

export function loadReminders() {
  try { return { ...REMINDER_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return REMINDER_DEFAULTS; }
}
export function saveReminders(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bez úložiště */ }
  syncReminders(s);
}

// Pošle nastavení běhu na pozadí a nechá hned přeplánovat upozornění.
// (Na výsledek nečekáme – v popředí se nemusí vrátit.)
export function syncReminders(s = loadReminders()) {
  if (!isNative || !serverBase()) return;
  BackgroundRunner.dispatchEvent({
    label: LABEL,
    event: 'configure',
    details: { ...s, server: serverBase(), device: deviceId() },
  }).catch(() => {});
}

export async function notifPermission() {
  if (!isNative) return 'unsupported';
  try { return (await BackgroundRunner.checkPermissions()).notifications; } catch { return 'unknown'; }
}
export async function askNotifPermission() {
  try { return (await BackgroundRunner.requestPermissions({ apis: ['notifications'] })).notifications; } catch { return 'unknown'; }
}

// ---------- aktualizace aplikace ----------
export async function latestApp() {
  try {
    const res = await fetch(`${serverBase()}/apk/version.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
export function apkUrl() {
  return `${serverBase()}/apk/ukoly.apk`;
}
// Otevře odkaz mimo aplikaci (Chrome stáhne APK a nabídne instalaci).
export function openExternal(url) {
  window.location.href = url;
}

// Při startu a při odchodu z aplikace přeplánovat (změny úkolů se projeví v upozornění).
export function initNative() {
  if (!isNative) return;
  syncReminders();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncReminders();
  });
}
