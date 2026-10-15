const path = require('path');
const fs = require('fs');
const express = require('express');
require('./db');
const api = require('./api');
const backup = require('./backup');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// Android aplikace běží na vlastní adrese (https://localhost), proto povolit CORS.
// Server je dosažitelný jen doma a přes Tailscale.
app.use(['/api', '/apk'], (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use('/api', api);

// Android aplikace ke stažení (APK přibalí do image GitHub Action), vždy čerstvá.
app.use('/apk', express.static(path.join(PUBLIC_DIR, 'apk'), { maxAge: 0 }));

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api|apk).*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
}

// chyby
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Chyba serveru' : err.message });
});

app.listen(PORT, () => {
  console.log(`Naše úkoly běží na portu ${PORT}`);
  backup.schedule();
});
