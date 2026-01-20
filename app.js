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
    if(iTitle === -1) throw new Error("CSV: не найден столбец title. Нужны заголовки: title,image,price,type");
    return rows.slice(1).map(r=>({
      title: (r[iTitle]||"").trim(),
      image: (r[iImage]||"").trim(),
      price: Number(String(r[iPrice]||"").replace(/[^\d]/g,"")) || 0,
      type: (r[iType]||"").trim()
    })).filter(g=>g.title);
  }
  const txt = await fetchText("data.json");
  return JSON.parse(txt);
}

function renderGames(list){
  const root = qs("[data-games]");
  if(!root) return;
  if(!list.length){
    root.innerHTML = `<div class="notice"><b>Нет игр для показа.</b> Проверь таблицу/CSV или data.json.</div>`;
    return;
  }
  root.innerHTML = list.map(g=>{
    const img = normalizeImageUrl(g.image);
    const price = Number(g.price||0) || 0;
    const type = (g.type||"").toLowerCase().includes("ван") ? "ваншот" : ((g.type||"").toLowerCase().includes("парт") ? "партия" : (g.type||"игра"));
    const href = `form.html?game=${encodeURIComponent(g.title)}`;
    return `
      <div class="card">
        <img src="${esc(img)}" alt="${esc(g.title)}" onerror="this.onerror=null;this.src='assets/library.png';">
        <div class="c-inner">
          <h3>${esc(g.title)}</h3>
          <div class="meta">
            <span class="pill ink">онлайн</span>
            <span class="pill red">${esc(type)}</span>
            <span class="pill cyan">${price.toLocaleString('ru-RU')} ₽</span>
          </div>
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
      if(status) status.innerHTML = '<span class="err">Failed to fetch</span><div class="small">Если не получается — напиши напрямую <a href="https://t.me/'+TG_USERNAME+'" target="_blank">@'+TG_USERNAME+'</a>.</div>';
    }finally{
      if(btn) btn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    const games = await loadGames();
    renderGames(games);
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

  document.querySelectorAll("[data-tg-link]").forEach(a=>{
    a.href = "https://t.me/" + TG_USERNAME;
    a.textContent = "@" + TG_USERNAME;
    a.target = "_blank";
    a.rel = "noopener";
  });
});
