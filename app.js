// Robust front-end for RoleHub (v12 fix)

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

function detectDelimiter(line){
  const candidates = [",",";","\t","|"];
  let best = ",";
  let bestCount = -1;
  for(const d of candidates){
    const c = (line||"").split(d).length - 1;
    if(c > bestCount){ bestCount = c; best = d; }
  }
  return best;
}

function parseCSV(text){
  const t = String(text||"").replace(/^\uFEFF/,"");
  const headerLine = (t.split("\n")[0]||"").replace(/\r/g,"");
  const delim = detectDelimiter(headerLine);
  const rows = [];
  let cur = [], field = "", inQuotes = false;
  for(let i=0;i<t.length;i++){
    const c = t[i];
    if(inQuotes){
      if(c === '"' && t[i+1] === '"'){ field += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === delim){ cur.push(field.trim()); field=""; }
      else if(c === "\n"){ cur.push(field.trim()); rows.push(cur); cur=[]; field=""; }
      else if(c === "\r"){} else field += c;
    }
  }
  if(field.length || cur.length){ cur.push(field.trim()); rows.push(cur); }
  return { rows, delim };
}

async function fetchText(url){
  const r = await fetch(url, {cache:"no-store"});
  if(!r.ok) throw new Error(`HTTP ${r.status} для ${url}`);
  return await r.text();
}
async function fetchJson(url){ return JSON.parse(await fetchText(url)); }

function pill(cls, text){ return text ? `<span class="pill ${cls||""}">${esc(text)}</span>` : ""; }
function typeLabel(t){
  const v = lower(t);
  if(v.includes("ван")) return "ваншот";
  if(v.includes("парт") || v.includes("камп")) return "партия";
  return (t||"игра").toString();
}
function isBeginnerFriendly(levelValue){
  const v = lower(levelValue);
  return v.includes("нович") || v.includes("beginner") || v.includes("0");
}
function splitSystems(raw){
  const s = String(raw||"").trim();
  if(!s) return [];
  return s.split(/[\|\;\u2022]/g).map(x=>x.trim()).filter(Boolean);
}

async function loadGames(){
  if(typeof SHEET_CSV_URL !== "undefined" && SHEET_CSV_URL){
    const csv = await fetchText(SHEET_CSV_URL);
    const { rows } = parseCSV(csv);
    const clean = rows.filter(r=>r.some(x=>String(x||"").trim()));
    if(clean.length < 2) return [];
    const header = clean[0].map(h=>lower(h));
    const idx = (name)=>header.indexOf(name);

    const iTitle = idx("title");
    const iImage = idx("image");
    const iPrice = idx("price");
    const iType  = idx("type");
    const iLevel = idx("level");
    const iGm = idx("gm");
    if(iTitle === -1) throw new Error("CSV игр: нет столбца title");

    return clean.slice(1).map(r=>({
      title: (r[iTitle]||"").trim(),
      image: (r[iImage]||"").trim(),
      price: Number(String(r[iPrice]||"").replace(/[^\d]/g,"")) || 0,
      type: (r[iType]||"").trim(),
      level: iLevel>=0 ? (r[iLevel]||"").trim() : "",
      gm: iGm>=0 ? (r[iGm]||"").trim() : "",
    })).filter(g=>g.title);
  }
  try{ return await fetchJson("data.json"); }catch{ return []; }
}

async function loadMasters(){
  if(typeof MASTERS_CSV_URL !== "undefined" && MASTERS_CSV_URL){
    const csv = await fetchText(MASTERS_CSV_URL);
    const { rows } = parseCSV(csv);
    const clean = rows.filter(r=>r.some(x=>String(x||"").trim()));
    if(clean.length < 2) return [];
    const header = clean[0].map(h=>lower(h));
    const idx = (name)=>header.indexOf(name);

    const iId = idx("id");
    const iName = idx("name");
    const iPhoto = idx("photo");
    const iSystems = idx("systems");
    const iStyle = idx("style");
    const iAbout = idx("about");
    const iVerified = idx("verified");
    if(iId === -1 || iName === -1) throw new Error("CSV мастеров: нужны id и name");

    return clean.slice(1).map(r=>({
      id: (r[iId]||"").trim(),
      name: (r[iName]||"").trim(),
      photo: (r[iPhoto]||"").trim(),
      systems: splitSystems(r[iSystems]||""),
      style: (r[iStyle]||"").trim(),
      about: (r[iAbout]||"").trim(),
      verified: lower(r[iVerified]).includes("true") || lower(r[iVerified]).includes("да") || lower(r[iVerified]).includes("1")
    })).filter(m=>m.id && m.name);
  }
  try{ return await fetchJson("masters.json"); }catch{ return []; }
}

function renderMasters(masters){
  const root = qs("[data-masters]");
  if(!root) return;

  const qEl = qs("#masters_q");
  const sysEl = qs("#masters_system");

  // IMPORTANT: do not auto-fill search
  if(qEl && qEl.value) qEl.value = "";

  // populate systems list
  if(sysEl && sysEl.options.length <= 1){
    const systems = Array.from(new Set(masters.flatMap(m=>m.systems||[]))).sort((a,b)=>a.localeCompare(b,'ru'));
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

  if(q){ list = list.filter(m=>[m.name,(m.systems||[]).join(" "),m.style,m.about].join(" ").toLowerCase().includes(q)); }
  if(sys && sys !== "all"){ list = list.filter(m=>(m.systems||[]).includes(sys)); }

  const countEl = qs("[data-masters-count]");
  if(countEl) countEl.textContent = String(list.length);

  if(!list.length){
    root.innerHTML = `<div class="notice"><b>Мастеров не найдено.</b><br><span class="small">Проверь CSV мастеров или отключи MASTERS_CSV_URL для fallback.</span></div>`;
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
        </div>
      </div>
    `;
  }).join("");
}

function wireMasterFilters(masters){
  const qEl = qs("#masters_q");
  const sysEl = qs("#masters_system");
  const handler = ()=>renderMasters(masters);
  if(qEl) qEl.addEventListener("input", handler);
  if(sysEl) sysEl.addEventListener("change", handler);
}

document.addEventListener("DOMContentLoaded", async ()=>{
  qsa("[data-tg-link]").forEach(a=>{
    a.href = "https://t.me/" + TG_USERNAME;
    a.textContent = "@" + TG_USERNAME;
    a.target = "_blank";
    a.rel = "noopener";
  });

  const masters = await loadMasters().catch(e=>{ console.error(e); return []; });
  if(qs("[data-masters]")){
    renderMasters(masters);
    wireMasterFilters(masters);
  }
});
