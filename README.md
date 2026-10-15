# Naše úkoly

Sdílený seznam úkolů pro domácnost. Bez účtů – oba vidíme a upravujeme totéž. Běží v jednom Docker kontejneru na NASu, stejně jako kuchařka.

- **Karty podle témat:** výchozí jsou *Úkoly* a *Filmy a seriály*, další si přidáte sami (název, barva, typ).
- **Tři typy karet:**
  - *Úkoly s termínem* – „do kdy“ (datum, volitelně čas), řazení do skupin Po termínu / Dnes / Tento týden / Později / Bez termínu.
  - *Jednoduchý seznam* – jen položky k odškrtnutí.
  - *Seznam s označením* – položka zůstává, jen se přepne (u filmů „Na NASu“).
- **Připomínky:** server umí denní přehled (`/api/digest`) a seznam novinek (`/api/changes`). Upozornění na telefonu bude zobrazovat Android aplikace (další krok); nastavení času je pro každý telefon zvlášť.

## Co je na NASu

```
/volume2/docker/ukoly/
├── compose.yaml
└── data/
    └── ukoly.db      ← karty a položky (SQLite)
```

Jednou za 30 dní se databáze zkopíruje do `/volume1/Zalohy/ukoly` (RAID 1) a drží se posledních 6 záloh.

## Nasazení

### 1. Kód na GitHub
1. Na GitHubu založte repozitář `ukoly` (soukromý) a pushněte do větve `main`.
2. GitHub Action **Build image** spustí testy a sestaví `ghcr.io/gajzlervojtech/ukoly:latest`.
3. NAS je už k ghcr.io přihlášený tokenem s `read:packages` (z kuchařky), soukromý image tedy stáhne i tak.

### 2. Spuštění na NASu (SSH)
```bash
sudo mkdir -p /volume2/docker/ukoly /volume1/Zalohy/ukoly
cd /volume2/docker/ukoly
# sem nahrát compose.yaml
sudo docker compose up -d
```
Aplikace běží na `http://IP-NASu:3200`.

### 3. HTTPS přes Tailscale
Port 443 už má kuchařka, úkoly proto pojedou na 8443:
```bash
sudo docker exec tailscale tailscale serve --bg --https=8443 3200
```
→ `https://nas-doma.tailabba48.ts.net:8443` (jen v tailnetu). V telefonu otevřít v Chrome a dát **Přidat na plochu**. Zrušení: `sudo docker exec tailscale tailscale serve --https=8443 off`.

> Aplikace nemá přihlašování, proto ji **nevystavujte do internetu**. Přístup jen doma a přes Tailscale.

### 4. Aktualizace
```bash
cd /volume2/docker/ukoly
sudo docker compose pull && sudo docker compose up -d
```

## Obnova ze zálohy
```bash
cd /volume2/docker/ukoly
sudo docker compose down
cp data/ukoly.db data/ukoly-stara.db                       # pro jistotu
cp /volume1/Zalohy/ukoly/ukoly-2026-11-15.db data/ukoly.db
rm -f data/ukoly.db-wal data/ukoly.db-shm
sudo docker compose up -d
```

## Vývoj
```bash
cd server && npm install && npm run dev     # API na :3000
cd web && npm install && npm run dev        # UI na :5173 (proxy na API)
cd server && npm test
```

## API (pro Android aplikaci)
| Metoda | Adresa | Co dělá |
|---|---|---|
| GET | `/api/cards` | karty s počty |
| POST / PATCH / DELETE | `/api/cards`, `/api/cards/:id` | nová / úprava / smazání karty |
| GET / POST | `/api/cards/:id/items` | položky karty / nová položka |
| PATCH / DELETE | `/api/items/:id` | úprava (i `done`) / smazání |
| GET | `/api/digest?date=YYYY-MM-DD` | dnešní a prošlé úkoly pro denní přehled |
| GET | `/api/changes?since=ISO` | položky přidané od daného okamžiku |

## Nastavení (proměnné prostředí)
| Proměnná | Výchozí | Význam |
|---|---|---|
| `PORT` | 3000 | port uvnitř kontejneru |
| `DATA_DIR` | /data | databáze |
| `BACKUP_DIR` | – | kam zálohovat (bez něj se nezálohuje) |
| `BACKUP_EVERY_DAYS` | 30 | jak často |
| `BACKUP_KEEP` | 6 | kolik záloh držet |
