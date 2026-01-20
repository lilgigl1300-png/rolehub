// === НАСТРОЙКИ (поменяй под себя) ===

// 1) URL на CSV из Google Sheets (опционально).
// Если оставить пустым — сайт возьмёт игры из локального data.json
//
// Как получить CSV:
// Google Sheets → Файл → Поделиться → Опубликовать в интернете → Лист → CSV
// Получишь ссылку вида:
// https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv
//
const SHEET_CSV_URL = "https://long-sound-b57c.lilgigl1300.workers.dev/games.csv";

// 2) Endpoint бэкенда, который отправляет заявки в Telegram (обязательно для авто-отправки).
// Ты создашь его как Cloudflare Worker / Netlify Function (инструкции в README).
// Пример для Cloudflare Worker:
// https://rolehub-submit.yourname.workers.dev/submit
const SUBMIT_API_URL = "https://long-sound-b57c.lilgigl1300.workers.dev";

// 3) Твой Telegram @username (для ссылки на контакт)
const TG_USERNAME = "iwwitich";