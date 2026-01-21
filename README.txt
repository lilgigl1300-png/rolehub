ROLEHUB — новый современный стиль (конструктивизм) + авто TG + Google Sheets
==========================================================================

КАК ПРОВЕРИТЬ, ЧТО ОБРАТНАЯ СВЯЗЬ РАБОТАЕТ
1) Проверка на сайте
- Открой страницу Контакты (contacts.html) на опубликованном сайте
- Заполни форму любыми тестовыми данными и нажми "Отправить"
- В Telegram (туда, куда настроен chat_id) должна прийти заявка от бота в течение 1–2 сек.

2) Если не пришло
- Проверь, что в config.js задан:
  SUBMIT_API_URL = "https://damp-cloud-4956.lilgil1300.workers.dev/submit"
  (обязательно с /submit)
- Проверь, что в Cloudflare Worker добавлены Variables/Secrets:
  TG_BOT_TOKEN (текущий токен)
  TG_CHAT_ID (число)
- В Cloudflare Worker открой Metrics/Observability и посмотри, есть ли ошибки (5xx).

3) Проверка напрямую (быстрый тест Worker)
- Открой в браузере URL воркера без /submit — он может отвечать "Only POST" или 404, это нормально.
- Тест через curl (если есть):
  curl -X POST -H "Content-Type: application/json" -d '{"kind":"contact","payload":{"name":"test","contact":"@test","message":"ping"}}' https://<worker>.workers.dev/submit
  После этого сообщение должно прийти в TG.

КАК ОБНОВИТЬ ДИЗАЙН НА NETLIFY
- Заменить текущую папку сайта на новую (перетянуть папку в Production deploys)

ПРО КАРТИНКИ ИЗ GOOGLE SHEETS
- В колонке image должна быть ПРЯМАЯ ссылка на картинку (желательно заканчивается на .png/.jpg).
- Если используешь Google Drive, вставляй ссылку формата:
  https://drive.google.com/file/d/<ID>/view?usp=sharing
  — сайт сам преобразует её в прямую.
- Если видишь пустые картинки: проверь, что ссылка открывается как изображение в отдельной вкладке (без страницы-прослойки).

ПРО ОШИБКУ 400 В ОБРАТНОЙ СВЯЗИ
- Часто это из-за неправильного SUBMIT_API_URL или потому что Worker не принимает запрос (маршрут /submit).
- Проверь, что SUBMIT_API_URL заканчивается на /submit
- И что в Worker добавлены TG_BOT_TOKEN и TG_CHAT_ID.


=== ВАЖНО: Failed to fetch / ошибка 400 на формах ===
Если на Netlify при отправке формы видишь "Failed to fetch", это почти всегда CORS.
Решение: в Cloudflare Worker должен быть включен CORS и обработка OPTIONS.

Скопируй в Worker этот код (Edit code), он уже с CORS и маршрутом /submit:
(см. инструкцию в ответе ассистента)

=== ВАЖНО: ссылка на Google Sheets ===
Сайту нужна CSV-ссылка:
.../pub?output=csv
а не pubhtml.


=== Публикация на GitHub Pages (без Netlify) ===
1) Создай репозиторий на GitHub (Public).
2) Загрузить файлы:
   - В репозитории нажми Add file → Upload files
   - Перетащи СОДЕРЖИМОЕ папки сайта (index.html, app.js, config.js, style.css, assets/…)
3) Включить Pages:
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: main, Folder: / (root)
   - Save
4) GitHub выдаст ссылку вида:
   https://<username>.github.io/<repo>/

Важно:
- Пути относительные — работает без правок.
- Если меняешь assets или config.js — снова коммить/загружай изменения.


=== Новые поля в Google Sheets ===
Добавь колонки (в первой строке заголовки):
title, image, price, type, genre, system, level, duration, schedule

Примеры:
- system: D&D 5e / Call of Cthulhu 7e
- genre: хоррор / фэнтези / детектив
- level: новичкам / опытным / mixed
- duration: 3–4 часа
- schedule: Пт 19:00 МСК / 24.01 19:00 МСК / еженедельно

Фильтр "Новичкам" срабатывает, если в level есть "нович" (или beginner).
