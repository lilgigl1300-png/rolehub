// config.js должен объявлять:
// const SHEET_CSV_URL = "...";
// const SUBMIT_API_URL = "...";
// const TG_USERNAME = "...";

function qs(sel){ return document.querySelector(sel); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c])); }

function normalizeImageUrl(raw){
  let u = String(raw||'').trim();
  if(!u) return "assets/library.png";
  if(!u.includes("://") && !u.startsWith("assets/") && !u.startsWith("/")) u = "assets/" + u;
  return u;
}

function parseCSV(text){
  const rows = [];
  let cur = [], field = "", inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"' && text[i+1] === '"'){ field += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ","){ cur.push(field.trim()); field=""; }
      else if(c === "\n"){ cur.push(field.trim()); rows.push(cur); cur=[]; field=""; }
      else if(c === "\r"){}
      else field += c;
    }
  }
  if(field.length || cur.length){ cur.push(field.trim()); rows.push(cur); }
  return rows;
}

async function fetchText(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`HTTP ${r.status} для ${url}`);
  return await r.text();
}

function lower(s){ return String(s||"").trim().toLowerCase(); }
function isBeginnerFriendly(levelValue){
  const v = lower(levelValue);
  return v.includes("нович") || v.includes("beginner") || v.includes("0");
}
function typeLabel(t){
  const v = lower(t);
  if(v.includes("ван")) return "ваншот";
  if(v.includes("парт")) return "партия";
  return (t||"игра").toString();
}
function pill(cls, text){
  if(!text) return "";
  return `<span class="pill ${cls||""}">${esc(text)}</span>`;
}

async function loadGames(){
  if(typeof SHEET_CSV_URL !== "undefined" && SHEET_CSV_URL){
    const csv = await fetchText(SHEET_CSV_URL);
    const rows = parseCSV(csv).filter(r=>r.some(x=>String(x||"").trim().length));
    if(rows.length < 2) return [];
    const header = rows[0].map(h => (h||"").trim().toLowerCase());
    const idx = (name)=>header.indexOf(name);

    const iTitle = idx("title");
    const iImage = idx("image");
    const iPrice = idx("price");
    const iType  = idx("type");

    const iGenre = idx("genre");
    const iSystem = idx("system");
    const iLevel = idx("level");
    const iDuration = idx("duration");
    const iSchedule = idx("schedule");

    if(iTitle === -1) throw new Error("CSV: не найден столбец title. Нужны заголовки: title,image,price,type (+ genre/system/level/duration/schedule).");

    return rows.slice(1).map(r=>({
      title: (r[iTitle]||"").trim(),
      image: (r[iImage]||"").trim(),
      price: Number(String(r[iPrice]||"").replace(/[^\d]/g,"")) || 0,
      type: (r[iType]||"").trim(),
      genre: iGenre>=0 ? (r[iGenre]||"").trim() : "",
      system: iSystem>=0 ? (r[iSystem]||"").trim() : "",
      level: iLevel>=0 ? (r[iLevel]||"").trim() : "",
      duration: iDuration>=0 ? (r[iDuration]||"").trim() : "",
      schedule: iSchedule>=0 ? (r[iSchedule]||"").trim() : "",
    })).filter(g=>g.title);
  }
  const txt = await fetchText("data.json");
  const data = JSON.parse(txt);
  return (Array.isArray(data) ? data : []).map(g=>({
    ...g,
    genre: g.genre || "",
    system: g.system || "",
    level: g.level || "",
    duration: g.duration || "",
    schedule: g.schedule || ""
  }));
}

function renderGames(list){
  const root = qs("[data-games]");
  if(!root) return;

  const qEl = qs("#games_q");
  const typeEl = qs("#games_type");
  const begEl = qs("#games_beginner");

  let filtered = list.slice();

  const q = qEl ? lower(qEl.value) : "";
  if(q){
    filtered = filtered.filter(g=>{
      const hay = [g.title,g.type,g.genre,g.system,g.level,g.duration,g.schedule,String(g.price)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  const tVal = typeEl ? lower(typeEl.value) : "";
  if(tVal && tVal !== "all"){
    filtered = filtered.filter(g=> lower(g.type).includes(tVal));
  }

  if(begEl && begEl.checked){
    filtered = filtered.filter(g=> isBeginnerFriendly(g.level));
  }

  const countEl = qs("[data-games-count]");
  if(countEl) countEl.textContent = String(filtered.length);

  if(!filtered.length){
    root.innerHTML = `<div class="notice"><b>Ничего не найдено.</b> Попробуй изменить фильтры.</div>`;
    return;
  }

  root.innerHTML = filtered.map(g=>{
    const img = normalizeImageUrl(g.image);
    const price = Number(g.price||0) || 0;
    const t = typeLabel(g.type);
    const href = `form.html?game=${encodeURIComponent(g.title)}`;

    const meta = [
      pill("ink","онлайн"),
      pill("red", t),
      pill("cyan", price ? `${price.toLocaleString('ru-RU')} ₽` : "бесплатно"),
      pill("", g.system),
      pill("", g.genre),
      pill("", g.level),
      pill("", g.duration ? `⏱ ${g.duration}` : ""),
      pill("", g.schedule ? `🗓 ${g.schedule}` : ""),
    ].filter(Boolean).join("");

    return `
      <div class="card">
        <img src="${esc(img)}" alt="${esc(g.title)}" onerror="this.onerror=null;this.src='assets/library.png';">
        <div class="c-inner">
          <h3>${esc(g.title)}</h3>
          <div class="meta">${meta}</div>
          <a class="btn btn-red" href="${href}">Записаться на игру</a>
        </div>
      </div>
    `;
  }).join("");
}

async function submitToApi(kind, payload){
  if(!SUBMIT_API_URL) throw new Error("SUBMIT_API_URL не настроен (см. config.js)");
  const r = await fetch(SUBMIT_API_URL, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({kind, payload, ts: new Date().toISOString()})
  });
  if(!r.ok) throw new Error("Ошибка отправки: HTTP " + r.status);
  return await r.json().catch(()=>({ok:true}));
}

function bindForm(formId, kind){
  const form = document.getElementById(formId);
  if(!form) return;
  const status = document.getElementById(formId + "_status");
  const btn = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(status) status.textContent = "Отправляем...";
    if(btn) btn.disabled = true;
    try{
      const fd = new FormData(form);
      const obj = {};
      fd.forEach((v,k)=>obj[k]=String(v||"").trim());
      await submitToApi(kind, obj);
      if(status) status.innerHTML = '<span class="ok">Готово!</span> Мы получили заявку и напишем в Telegram.';
      form.reset();
      const params = new URLSearchParams(location.search);
      const game = params.get("game");
      const gf = document.getElementById("gameField");
      if(gf && game) gf.value = game;
    }catch(err){
      console.error(err);
      if(status) status.innerHTML = '<span class="err">Ошибка отправки</span><div class="small">Если не получается — напиши напрямую <a href="https://t.me/'+TG_USERNAME+'" target="_blank">@'+TG_USERNAME+'</a>.</div>';
    }finally{
      if(btn) btn.disabled = false;
    }
  });
}

function wireFilters(list){
  const qEl = qs("#games_q");
  const typeEl = qs("#games_type");
  const begEl = qs("#games_beginner");
  if(!qEl && !typeEl && !begEl) return;
  const handler = ()=>renderGames(list);
  if(qEl) qEl.addEventListener("input", handler);
  if(typeEl) typeEl.addEventListener("change", handler);
  if(begEl) begEl.addEventListener("change", handler);
}

document.addEventListener("DOMContentLoaded", async ()=>{
  let games = [];
  try{
    games = await loadGames();
    renderGames(games);
    wireFilters(games);
  }catch(e){
    console.error(e);
    const root = qs("[data-games]");
    if(root) root.innerHTML = `<div class="notice"><b>Ошибка загрузки игр:</b> ${esc(e.message || e)}</div>`;
  }

  const params = new URLSearchParams(location.search);
  const game = params.get("game");
  const gf = document.getElementById("gameField");
  if(gf && game) gf.value = game;

  bindForm("signupForm","signup");
  bindForm("customPartyForm","custom_party");
  bindForm("contactForm","contact");
  bindForm("gmApplyForm","gm_apply");

  document.querySelectorAll("[data-tg-link]").forEach(a=>{
    a.href = "https://t.me/" + TG_USERNAME;
    a.textContent = "@" + TG_USERNAME;
    a.target = "_blank";
    a.rel = "noopener";
  });
});
