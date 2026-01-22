// === НАСТРОЙКИ (поменяй под себя) ===
//
// 1) Игры (CSV). Рекомендуемый вариант: прокси через ваш Cloudflare Worker:
//    https://<worker>.workers.dev/games.csv
const SHEET_CSV_URL = "https://long-sound-b57c.lilgigl1300.workers.dev/games.csv";
//
// 2) Мастера (CSV). Если оставить пустым — сайт возьмёт мастеров из masters.json.
//    Рекомендуемый вариант: прокси через Worker (чтобы не было CORS):
//    https://<worker>.workers.dev/masters.csv
const MASTERS_CSV_URL = "";
//
// 3) Endpoint для заявок (POST) — ваш Cloudflare Worker
const SUBMIT_API_URL = "https://long-sound-b57c.lilgigl1300.workers.dev";
//
// 4) Telegram username для ссылок
const TG_USERNAME = "iwwitich";
