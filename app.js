// config.js:
// const SHEET_CSV_URL = "...";
// const MASTERS_CSV_URL = "...";
// const SUBMIT_API_URL = "...";
// const TG_USERNAME = "...";


const ROLEHUB_STATUS = (window.__ROLEHUB_STATUS = window.__ROLEHUB_STATUS || { gamesError:"", mastersError:"", gamesSource:"", mastersSource:"" });
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

function detectDelimiterFromHeaderLine(line){
  // Pick the delimiter that appears most in the first non-empty line.
  const counts = {
    ",": (line.split(",").length - 1),
    ";": (line.split(";").length - 1),
    "\t": (line.split("\t").length - 1),
    "|": (line.split("|").length - 1),
  };
  let best = ",";
  for(const d of [";", "\t", "|"]){
    if(counts[d] > counts[best]) best = d;
  }
  return best;
}

function parseCSV(text){
  // Robust CSV parser with auto-delimiter (comma/semicolon/tab/pipe) + quotes.
  const clean = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = (clean.split(/\r?\n/).find(l => l.trim().length) || "");
  const delim = detectDelimiterFromHeaderLine(firstLine);

  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;

  for(let i=0; i<clean.length; i++){
    const c = clean[i];

    if(inQuotes){
      if(c === '"' && clean[i+1] === '"'){
        field += '"';
        i++;
      } else if(c === '"'){
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if(c === '"'){
        inQuotes = true;
      } else if(c === delim){
        cur.push(field.trim());
        field = "";
      } else if(c === "\n"){
        cur.push(field.trim());
        rows.push(cur);
        cur = [];
        field = "";
      } else if(c === "\r"){
        // ignore
      } else {
        field += c;
      }
    }
  }
  if(field.length || cur.length){
    cur.push(field.trim());
    rows.push(cur);
  }
  return rows;
}

async function fetchText(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`HTTP ${r.status} для ${url}`);
  return await r.text();
}

async function fetchJson(url){
  const t = await fetchText(url);
  return JSON.parse(t);
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

function splitSystems(raw){
  const s = String(raw||"").trim();
  if(!s) return [];
  // allow separators: | ; • ,
  return s.split(/[\|\;\u2022,]/g).map(x=>x.trim()).filter(Boolean);
}

/* ---------------- Games (from CSV) ---------------- */

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
    const iGm = idx("gm"); // NEW: master id, e.g. kenzo

    if(iTitle === -1) throw new Error("CSV игр: нет столбца title. Минимум: title,image,price,type (+ genre/system/level/duration/schedule/gm).");

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
      gm: iGm>=0 ? (r[iGm]||"").trim() : ""
    })).filter(g=>g.title);
  }

  // fallback (optional)
  try{
    const data = await fetchJson("data.json");
    return (Array.isArray(data) ? data : []).map(g=>({
      ...g,
      genre: g.genre || "",
      system: g.system || "",
      level: g.level || "",
      duration: g.duration || "",
      schedule: g.schedule || "",
      gm: g.gm || ""
    }));
  }catch{
    return [];
  }
}

/* ---------------- Masters (from CSV or JSON) ---------------- */

async function loadMasters(){
  // From CSV if provided
  if(typeof MASTERS_CSV_URL !== "undefined" && MASTERS_CSV_URL){
    const csv = await fetchText(MASTERS_CSV_URL);
    const rows = parseCSV(csv).filter(r=>r.some(x=>String(x||"").trim().length));
    if(rows.length < 2) return [];

    const header = rows[0].map(h => (h||"").trim().toLowerCase());
    const idx = (name)=>header.indexOf(name);

    const iId = idx("id");
    const iName = idx("name");
    const iPhoto = idx("photo");
    const iSystems = idx("systems");
    const iStyle = idx("style");
    const iAbout = idx("about");
    const iVerified = idx("verified");

    if(iId === -1 || iName === -1) throw new Error("CSV мастеров: нужны заголовки минимум id,name (+ photo,systems,style,about,verified).");

    return rows.slice(1).map(r=>({
      id: (r[iId]||"").trim(),
      name: (r[iName]||"").trim(),
      photo: (r[iPhoto]||"").trim() || "assets/library.png",
      systems: iSystems>=0 ? splitSystems(r[iSystems]||"") : [],
      style: iStyle>=0 ? (r[iStyle]||"").trim() : "",
      about: iAbout>=0 ? (r[iAbout]||"").trim() : "",
      verified: iVerified>=0 ? lower(r[iVerified]).includes("true") || lower(r[iVerified]).includes("да") || lower(r[iVerified]).includes("1") : true
    })).filter(m=>m.id && m.name);
  }

  // Fallback JSON (no-code friendly)
  try{
    const data = await fetchJson("masters.json");
    return (Array.isArray(data) ? data : []);
  }catch{
    return [];
  }
}

/* ---------------- UI: Games list ---------------- */

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
    const err = ROLEHUB_STATUS.gamesError;
    if(err){
      root.innerHTML = `<div class="notice"><b>Данные не загрузились.</b> Проверь ссылку SHEET_CSV_URL и формат CSV (заголовки: title,image,price,type).<br><span class="muted">Ошибка: ${escapeHtml(err)}</span></div>`;
    } else {
      root.innerHTML = `<div class="notice"><b>Ничего не найдено.</b> Попробуй изменить фильтры.</div>`;
    }
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

function wireGameFilters(list){
  const qEl = qs("#games_q");
  const typeEl = qs("#games_type");
  const begEl = qs("#games_beginner");
  if(!qEl && !typeEl && !begEl) return;
  const handler = ()=>renderGames(list);
  if(qEl) qEl.addEventListener("input", handler);
  if(typeEl) typeEl.addEventListener("change", handler);
  if(begEl) begEl.addEventListener("change", handler);
}

/* ---------------- UI: Newbies section ---------------- */

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

/* ---------------- UI: Masters list + filters ---------------- */

function renderMasters(masters){
  const root = qs("[data-masters]");
  if(!root) return;

  const qEl = qs("#masters_q");
  const sysEl = qs("#masters_system");

  // populate systems dropdown once
  if(sysEl && sysEl.options.length <= 1){
    const systems = Array.from(new Set(masters.flatMap(m=>m.systems || []))).sort((a,b)=>a.localeCompare(b,'ru'));
    systems.forEach(s=>{
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sysEl.appendChild(opt);
    });
  }

  let list = masters.slice();
  const q = qEl ? lower(qEl.value) : "";
  const sys = sysEl ? sysEl.value : "all";

  if(q){
    list = list.filter(m=>{
      const hay = [m.name, (m.systems||[]).join(" "), m.style, m.about].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  if(sys && sys !== "all"){
    list = list.filter(m => (m.systems||[]).includes(sys));
  }

  const countEl = qs("[data-masters-count]");
  if(countEl) countEl.textContent = String(list.length);

  if(!list.length){
    root.innerHTML = `<div class="notice"><b>Ничего не найдено.</b> Попробуй изменить фильтры.</div>`;
    return;
  }

  root.innerHTML = list.map(m=>{
    const href = `master.html?name=${encodeURIComponent(m.id)}`;
    const photo = normalizeImageUrl(m.photo);
    return `
      <div class="mcard">
        <a class="mOverlay" href="${href}" aria-label="Профиль мастера ${esc(m.name)}"></a>
        <div class="mphoto">
          <img src="${esc(photo)}" alt="${esc(m.name)}" onerror="this.onerror=null;this.src='assets/library.png';">
        </div>
        <div class="mbody">
          <div class="mhead">
            <div>
              <div class="mname">${esc(m.name)}</div>
              <div class="small">${esc((m.systems||[]).join(" • "))}</div>
            </div>
            ${m.verified ? '<div class="mflag">Проверен</div>' : ''}
          </div>
          <div class="small" style="margin-top:10px">${esc(m.about || "")}</div>
          <div class="mmeta" style="margin-top:10px">${pill("cyan", m.style || "")}</div>
          <div class="actions mActions" style="margin-top:12px">
            <a class="btn btn-red" href="contacts.html">Написать</a>
            <a class="btn btn-outline" href="custom.html">Собрать партию</a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function wireMasterFilters(masters){
  const qEl = qs("#masters_q");
  const sysEl = qs("#masters_system");
  if(!qEl && !sysEl) return;
  const handler = ()=>renderMasters(masters);
  if(qEl) qEl.addEventListener("input", handler);
  if(sysEl) sysEl.addEventListener("change", handler);
}

/* ---------------- Pages: detail views ---------------- */

function renderGameDetail(games){
  const root = qs("[data-game-detail]");
  if(!root) return;

  const params = new URLSearchParams(location.search);
  const gameName = params.get("game") || "";
  const g = games.find(x => x.title === gameName) || games[0];

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

function renderMasterDetail(masters, games){
  const root = qs("[data-master-detail]");
  if(!root) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("name") || "";
  const m = masters.find(x=>x.id === id) || masters[0];

  if(!m){
    root.innerHTML = `<div class="notice">Мастер не найден.</div>`;
    return;
  }

  document.title = `Мастер ${m.name} — RoleHub`;

  const photo = normalizeImageUrl(m.photo);
  const meta = [
    pill("ink", "онлайн"),
    m.verified ? pill("red", "проверен") : "",
    pill("", (m.systems||[]).join(" • ")),
    pill("cyan", m.style || "")
  ].filter(Boolean).join("");

  // games by master (gm column)
  const myGames = (games || []).filter(g => lower(g.gm) === lower(m.id));
  const gamesHtml = myGames.length ? `
    <div class="section-title" style="margin-top:18px">
      <h2>Игры мастера</h2>
      <div class="hint">из каталога</div>
    </div>
    <div class="grid">
      ${myGames.map(g=>{
        const href = `game.html?game=${encodeURIComponent(g.title)}`;
        return `<a class="miniCard" href="${href}">${esc(g.title)}</a>`;
      }).join("")}
    </div>
  ` : `
    <div class="notice small" style="margin-top:12px">
      Игры мастера пока не привязаны. Добавь в таблицу игр колонку <b>gm</b> и укажи для нужных игр значение <b>${esc(m.id)}</b>.
    </div>
  `;

  root.innerHTML = `
    <div class="masterHero">
      <div>
        <img src="${esc(photo)}" alt="${esc(m.name)}" onerror="this.onerror=null;this.src='assets/library.png';">
      </div>
      <div>
        <h1 class="masterName">${esc(m.name)}</h1>
        <div class="meta">${meta}</div>
        <div class="notice small" style="margin-top:12px">
          Чтобы записаться на игру с мастером или подобрать партию — оставь заявку, мы свяжемся в Telegram.
        </div>
        <div class="masterAbout small">${esc(m.about || "")}</div>
        <div class="detailActions" style="margin-top:14px">
          <a class="btn btn-red" href="contacts.html">Написать</a>
          <a class="btn btn-ink" href="custom.html">Собрать партию</a>
          <a class="btn btn-outline" href="games.html">Каталог игр</a>
        </div>
      </div>
    </div>
    ${gamesHtml}
  `;
}

/* ---------------- Forms ---------------- */

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

/* ---------------- Boot ---------------- */

document.addEventListener("DOMContentLoaded", async ()=>{
  qsa("[data-tg-link]").forEach(a=>{
    a.href = "https://t.me/" + TG_USERNAME;
    a.textContent = "@" + TG_USERNAME;
    a.target = "_blank";
    a.rel = "noopener";
  });

  // Forms
  bindForm("signupForm","signup");
  bindForm("customPartyForm","custom_party");
  bindForm("contactForm","contact");
  bindForm("gmApplyForm","gm_apply");

  // Load data
  let games = [];
  let masters = [];
  try{
    [games, masters] = await Promise.all([loadGames(), loadMasters()]);
  }catch(e){
    console.error(e);
  }

  // Games pages
  if(qs("[data-games]")){
    applyQueryToFilters();
    renderGames(games);
    wireGameFilters(games);
  }

  // Newbies section on index
  renderNewbies(games);

  // Detail pages
  renderGameDetail(games);
  renderMasterDetail(masters, games);

  // Masters pages
  if(qs("[data-masters]")){
    renderMasters(masters);
    wireMasterFilters(masters);
  }
});
