// Běh na pozadí (Capacitor Background Runner) – Android ho spouští zhruba každých 15 minut.
// 1) naplánuje denní přehled na nastavený čas s čerstvými daty ze serveru,
// 2) ohlásí nové položky ve Filmech a seriálech, které přidal někdo jiný.
//
// Nastavení posílá aplikace událostí „configure“ a ukládá se do CapacitorKV.
// Prostředí nemá moduly ani DOM – jen fetch, CapacitorKV a CapacitorNotifications.

var DAILY_ID = 1001;
var NEWS_ID = 2001;
var ICON = 'ic_stat_ukoly';

function kvGet(key) {
  try {
    var r = CapacitorKV.get(key);
    return r && r.value ? r.value : null;
  } catch (e) {
    return null;
  }
}

function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

// Datum „YYYY-MM-DD“ + n dní (počítá v UTC, nezávisle na časové zóně prostředí).
function addDays(date, n) {
  var p = date.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return d.toISOString().slice(0, 10);
}
// 0 = pondělí … 6 = neděle
function weekday(date) {
  var p = date.split('-');
  return (new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() + 6) % 7;
}
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// Stejný text jako náhled v aplikaci (Připomínky).
function digestText(d, s) {
  var parts = [];
  if (s.overdue && d.overdue.length) parts.push('Po termínu: ' + d.overdue.map(function (i) { return i.title; }).join(', ') + '.');
  if (s.today && d.today.length) {
    parts.push('Dnes: ' + d.today.map(function (i) { return i.due_time ? i.title + ' (' + i.due_time + ')' : i.title; }).join(', ') + '.');
  }
  var n = (s.today ? d.today.length : 0) + (s.overdue ? d.overdue.length : 0);
  var title;
  if (!n) title = 'Dobré ráno! Dnes nic nehoří';
  else if (s.today && d.today.length) title = 'Dobré ráno! Dnes ' + d.today.length + ' ' + plural(d.today.length, 'úkol', 'úkoly', 'úkolů');
  else title = 'Dobré ráno! ' + n + ' ' + plural(n, 'úkol', 'úkoly', 'úkolů') + ' po termínu';
  return { title: title, body: parts.join(' ') || 'Žádné úkoly s termínem na dnes.' };
}

async function getJSON(url) {
  var res = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Pozor: plugin čte scheduleAt jako místní čas telefonu, i když končí na „Z“.
// Posíláme proto místní čas domácnosti (z NASu) v tomto tvaru.
function localStamp(date, mins) {
  return date + 'T' + pad(Math.floor(mins / 60)) + ':' + pad(mins % 60) + ':00.000Z';
}

async function planDaily(s) {
  var d0 = await getJSON(s.server + '/api/digest');
  var nowDate = d0.now.slice(0, 10);
  var nowMins = (+d0.now.slice(11, 13)) * 60 + (+d0.now.slice(14, 16));

  var target = null;
  if (s.on) {
    for (var i = 0; i <= 7; i++) {
      var date = addDays(nowDate, i);
      if (s.days[weekday(date)] && (i > 0 || s.mins > nowMins)) { target = date; break; }
    }
  }

  if (!target) {
    // Vypnuto: zrušit nejde, tak připomínku odsuneme daleko do budoucnosti.
    CapacitorNotifications.schedule([{ id: DAILY_ID, title: 'Naše úkoly', body: '', scheduleAt: '2099-01-01T00:00:00.000Z', smallIcon: ICON }]);
    return;
  }

  var d = target === nowDate ? d0 : await getJSON(s.server + '/api/digest?date=' + target);
  var t = digestText(d, s);
  // Stejné id = předchozí naplánované upozornění se nahradí čerstvým obsahem.
  CapacitorNotifications.schedule([{
    id: DAILY_ID,
    title: t.title,
    body: t.body,
    largeBody: t.body,
    scheduleAt: localStamp(target, s.mins),
    smallIcon: ICON,
    autoCancel: true,
  }]);
}

async function checkNews(s) {
  var last = kvGet('lastChange');
  var url = s.server + '/api/changes?since=' + encodeURIComponent(last || '') + '&exclude_device=' + encodeURIComponent(s.device || '');
  var ch = await getJSON(url);
  CapacitorKV.set('lastChange', ch.now);
  if (!last || !s.added) return; // poprvé jen zapamatovat čas

  var media = ch.added.filter(function (i) { return i.card_preset === 'media'; });
  if (!media.length) return;
  var names = media.map(function (i) { return i.title; }).join(', ');
  CapacitorNotifications.schedule([{
    id: NEWS_ID,
    title: media.length === 1 ? 'Nový film nebo seriál' : media.length + ' ' + plural(media.length, 'nová položka', 'nové položky', 'nových položek') + ' ve Filmech a seriálech',
    body: names,
    largeBody: names,
    smallIcon: ICON,
    autoCancel: true,
  }]);
}

async function run() {
  var raw = kvGet('settings');
  if (!raw) return;
  var s = JSON.parse(raw);
  if (!s.server) return;
  try { await planDaily(s); } catch (e) { console.log('Denní přehled: ' + e); }
  try { await checkNews(s); } catch (e) { console.log('Novinky: ' + e); }
}

addEventListener('check', async function (resolve, reject) {
  try {
    await run();
    resolve();
  } catch (e) {
    console.log('Chyba: ' + e);
    reject(e);
  }
});

// Aplikace posílá nastavení (adresa serveru, čas, dny, co hlásit) a hned přeplánuje.
addEventListener('configure', async function (resolve, reject, args) {
  try {
    if (args) CapacitorKV.set('settings', JSON.stringify(args));
    await run();
    resolve();
  } catch (e) {
    console.log('Chyba: ' + e);
    reject(e);
  }
});
