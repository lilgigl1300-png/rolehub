/**
 * Cloudflare Worker (auto-send to Telegram)
 * Deploy: https://developers.cloudflare.com/workers/
 *
 * Set secrets:
 * - TG_BOT_TOKEN
 * - TG_CHAT_ID
 *
 * Route:
 * POST /submit
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return corsOk();
    if (request.method !== "POST" || url.pathname !== "/submit") {
      return new Response("Not Found", { status: 404 });
    }

    let body;
    try { body = await request.json(); } catch { return cors(new Response("Bad JSON", {status: 400})); }

    const kind = body.kind || "unknown";
    const p = body.payload || {};
    const lines = [];
    if(kind === "signup"){
      lines.push("🎲 Заявка на игру");
      lines.push("Игра: " + (p.game || ""));
      lines.push("Имя: " + (p.name || ""));
      lines.push("Контакт: " + (p.contact || ""));
      lines.push("Комментарий: " + (p.comment || ""));
    }else if(kind === "custom_party"){
      lines.push("🧩 Заявка на свою партию (онлайн)");
      lines.push("Имя: " + (p.name || ""));
      lines.push("Контакт: " + (p.contact || ""));
      lines.push("Система/жанр: " + (p.system || ""));
      lines.push("Когда удобно: " + (p.time || ""));
      lines.push("Сколько игроков: " + (p.players || ""));
      lines.push("Бюджет: " + (p.budget || ""));
      lines.push("Описание: " + (p.details || ""));
    }else if(kind === "contact"){
      lines.push("💬 Обратная связь");
      lines.push("Имя: " + (p.name || ""));
      lines.push("Контакт: " + (p.contact || ""));
      lines.push("Сообщение: " + (p.message || ""));
    }else{
      lines.push("📩 Заявка (" + kind + ")");
      for(const [k,v] of Object.entries(p)) lines.push(k + ": " + v);
    }

    const text = lines.join("\n");

    const tgRes = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        chat_id: env.TG_CHAT_ID,
        text,
        disable_web_page_preview: true
      })
    });

    if(!tgRes.ok){
      const t = await tgRes.text();
      return cors(new Response(t || "Telegram error", {status: 500}));
    }

    return cors(new Response(JSON.stringify({ok:true}), {
      headers: {"Content-Type":"application/json"}
    }));
  }
};

function cors(resp){
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  resp.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return resp;
}
function corsOk(){ return cors(new Response("", {status: 204})); }