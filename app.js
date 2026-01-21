// config.js:
// const SHEET_CSV_URL = "...";
// const SUBMIT_API_URL = "...";
// const TG_USERNAME = "...";

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c])); }
function lower(s){ return String(s||"").trim().toLowerCase(); }

function normalizeImageUrl(raw){
  let u = String(raw||"").trim();
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

    if(iTitle === -1) throw new Error("CSV: нет столбца title. Заголовки: title,image,price,type,genre,system,level,duration,schedule");

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
  // fallback
  try{
    const txt = await fetchText("data.json");
    const data = JSON.parse(txt);
    return (Array.isArray(data) ? data : []);
  }catch{
    return [];
  }
}

function applyQueryToFilters(){
  const params = new URLSearchParams(location.search);
  const beg = params.get("beginner");
  const begEl = qs("#games_beginner");
  if(begEl && (beg === "1" || beg === "true")) begEl.checked = true;
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
    const signupHref = `form.html?game=${encodeURIComponent(g.title)}`;
    const detailHref = `game.html?game=${encodeURIComponent(g.title)}`;

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
        <a class="cardOverlay" href="${detailHref}" aria-label="${esc(g.title)}"></a>
        <img src="${esc(img)}" alt="${esc(g.title)}" onerror="this.onerror=null;this.src='assets/library.png';">
        <div class="c-inner">
          <h3>${esc(g.title)}</h3>
          <div class="meta">${meta}</div>
          <div class="cardActions">
            <a class="btn btn-red" href="${signupHref}">Записаться на игру</a>
          </div>
        </div>
      </div>
    `;
  }).join("");
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

function renderNewbies(list){
  const box = qs("[data-newbies]");
  if(!box) return;
  const picks = list.filter(g=>isBeginnerFriendly(g.level)).slice(0,3);
  if(!picks.length){
    box.innerHTML = `<div class="small">Пока нет игр с пометкой “новичкам”. Добавь слово <b>новичкам</b> в поле <b>level</b> в таблице.</div>`;
    return;
  }
  box.innerHTML = picks.map(g=>{
    const href = `game.html?game=${encodeURIComponent(g.title)}`;
    return `<a class="miniCard" href="${href}">${esc(g.title)}</a>`;
  }).join("");
}

const MASTERS = [
  {
    name: "Kenzo",
    photo: "assets/masters/kenzo.jpg",
    systems: "D&D 5e • CoC • PF2e",
    style: "Атмосфера • Ролеплей • Драйв",
    verified: true,
    about: "Провожу игры онлайн, люблю яркие сцены и бережную атмосферу. Подходит новичкам."
  }
];

function renderMasters(){
  const root = qs("[data-masters]");
  if(!root) return;
  root.innerHTML = MASTERS.map(m=>`
    <div class="mcard">
      <div class="mphoto">
        <img src="${esc(m.photo)}" alt="${esc(m.name)}" onerror="this.onerror=null;this.src='assets/library.png';">
      </div>
      <div class="mbody">
        <div class="mhead">
          <div>
            <div class="mname">${esc(m.name)}</div>
            <div class="small">${esc(m.systems || "")}</div>
          </div>
          ${m.verified ? '<div class="mflag">Проверен</div>' : ''}
        </div>
        <div class="small" style="margin-top:10px">${esc(m.about || "")}</div>
        <div class="mmeta" style="margin-top:10px">${pill("cyan", m.style || "")}</div>
        <div class="actions" style="margin-top:12px">
          <a class="btn btn-red" href="contacts.html">Написать</a>
          <a class="btn btn-outline" href="custom.html">Собрать партию</a>
        </div>
      </div>
    </div>
  `).join("");
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

function renderGameDetail(list){
  const root = qs("[data-game-detail]");
  if(!root) return;

  const params = new URLSearchParams(location.search);
  const gameName = params.get("game") || "";
  const g = list.find(x => x.title === gameName) || list[0];

  if(!g){
    root.innerHTML = `<div class="notice">Игра не найдена.</div>`;
    return;
  }

  const img = normalizeImageUrl(g.image);
  const price = Number(g.price||0) || 0;
  const t = typeLabel(g.type);
  const signupHref = `form.html?game=${encodeURIComponent(g.title)}`;

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

  root.innerHTML = `
    <div class="detailHero">
      <div class="detailImg">
        <img src="${esc(img)}" alt="${esc(g.title)}" onerror="this.onerror=null;this.src='assets/library.png';">
      </div>
      <div class="detailBody">
        <h1 class="detailTitle">${esc(g.title)}</h1>
        <div class="meta">${meta}</div>
        <div class="notice small" style="margin-top:12px">
          Оставь заявку — мы получим её в Telegram и подтвердим участие.
        </div>
        <div class="detailActions">
          <a class="btn btn-red" href="${signupHref}">Записаться</a>
          <a class="btn btn-outline" href="games.html">Каталог</a>
        </div>
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", async ()=>{
  qsa("[data-tg-link]").forEach(a=>{
    a.href = "https://t.me/" + TG_USERNAME;
    a.textContent = "@" + TG_USERNAME;
    a.target = "_blank";
    a.rel = "noopener";
  });

  let games = [];
  try{
    games = await loadGames();

    if(qs("[data-games]")){
      applyQueryToFilters();
      renderGames(games);
      wireFilters(games);
    }

    renderNewbies(games);
    renderGameDetail(games);
    renderMasters();
  }catch(e){
    console.error(e);
    const root = qs("[data-games]") || qs("[data-game-detail]") || qs("[data-newbies]");
    if(root) root.innerHTML = `<div class="notice"><b>Ошибка:</b> ${esc(e.message || e)}</div>`;
  }

  const params = new URLSearchParams(location.search);
  const game = params.get("game");
  const gf = document.getElementById("gameField");
  if(gf && game) gf.value = game;

  bindForm("signupForm","signup");
  bindForm("customPartyForm","custom_party");
  bindForm("contactForm","contact");
  bindForm("gmApplyForm","gm_apply");
});
