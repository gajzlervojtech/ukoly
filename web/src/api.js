// Adresa serveru: ve webu stejná jako stránka, v Android aplikaci uložená v nastavení.
export function serverBase() {
  try { return (localStorage.getItem('ukoly.server') || '').replace(/\/+$/, ''); } catch { return ''; }
}

async function request(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${serverBase()}/api${url}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Chyba ${res.status}`);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  put: (url, body) => request('PUT', url, body ?? {}),
  patch: (url, body) => request('PATCH', url, body ?? {}),
  del: (url) => request('DELETE', url),
};

export function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

export const COLORS = [
  { hex: '#2FB386', name: 'zelená' },
  { hex: '#6C8CF5', name: 'modrá' },
  { hex: '#F2A33A', name: 'oranžová' },
  { hex: '#E8657A', name: 'růžová' },
  { hex: '#9B7BE0', name: 'fialová' },
  { hex: '#3BB4C9', name: 'tyrkysová' },
];
