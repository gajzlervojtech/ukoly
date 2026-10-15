// Práce s daty jako text YYYY-MM-DD v místním čase telefonu.
const pad = (n) => String(n).padStart(2, '0');

export function toStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayStr() {
  return toStr(new Date());
}
export function addDays(s, n) {
  const d = fromStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
}
// 0 = pondělí … 6 = neděle
export function weekday(s) {
  return (fromStr(s).getDay() + 6) % 7;
}

export const WD_SHORT = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];
export const WD_LONG = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
export const MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
const MONTHS_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

export function longToday(s = todayStr()) {
  const d = fromStr(s);
  return `${WD_LONG[weekday(s)]} ${d.getDate()}. ${MONTHS_GEN[d.getMonth()]}`;
}

export function shortDate(s, withYear = false) {
  const d = fromStr(s);
  const base = `${WD_SHORT[weekday(s)]} ${d.getDate()}. ${d.getMonth() + 1}.`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

// Neděle tohoto týdne
export function endOfWeek(today = todayStr()) {
  return addDays(today, 6 - weekday(today));
}

// Do které skupiny patří úkol s termínem.
export function dueGroup(due, today = todayStr()) {
  if (!due) return 'none';
  if (due < today) return 'over';
  if (due === today) return 'today';
  if (due <= endOfWeek(today)) return 'week';
  return 'later';
}

export const GROUPS = [
  { key: 'over', label: 'Po termínu' },
  { key: 'today', label: 'Dnes' },
  { key: 'week', label: 'Tento týden' },
  { key: 'later', label: 'Později' },
  { key: 'none', label: 'Bez termínu' },
];

// Text štítku s termínem: „Dnes 20:00“, „Zítra“, „so 17. 10.“
export function dueLabel(due, time, today = todayStr()) {
  if (!due) return '';
  let t;
  if (due === today) t = 'Dnes';
  else if (due === addDays(today, 1)) t = 'Zítra';
  else if (due === addDays(today, -1)) t = 'Včera';
  else t = shortDate(due, due.slice(0, 4) !== today.slice(0, 4));
  return time ? `${t} ${time}` : t;
}

// Rychlé volby termínu
export function quickDates(today = todayStr()) {
  const wd = weekday(today);
  const saturday = wd >= 5 ? today : addDays(today, 5 - wd);
  return [
    { label: 'Dnes', value: today },
    { label: 'Zítra', value: addDays(today, 1) },
    { label: 'Tento víkend', value: saturday },
    { label: 'Příští týden', value: addDays(today, 7 - wd) },
    { label: 'Bez termínu', value: null },
  ];
}
