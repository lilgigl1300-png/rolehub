/**
 * Netlify Function (auto-send to Telegram)
 * Put this file at: netlify/functions/submit.js
 * In Netlify dashboard set env vars:
 * - TG_BOT_TOKEN
 * - TG_CHAT_ID
 *
 * Endpoint will be:
 * https://<site>.netlify.app/.netlify/functions/submit
 */
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders()
    };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed", headers: corsHeaders() };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON", headers: corsHeaders() }; }

  const kind = body.kind || "unknown";
  const p = body.payload || {};
  const lines = [];

  if(kind === "signup"){
    lines.push("🎲 Заявка на игру");
    lines.push("Игра: " + (p.game || ""));
    lines.push("Имя: " + (p.name || ""));
    lines.push("Контакт: " + (p.contact || ""));
    lines.push("Комментарий: " + (p.comment || ""));
  } else if(kind === "custom_party"){
    lines.push("🧩 Заявка на свою партию (онлайн)");
    lines.push("Имя: " + (p.name || ""));
    lines.push("Контакт: " + (p.contact || ""));
    lines.push("Система/жанр: " + (p.system || ""));
    lines.push("Когда удобно: " + (p.time || ""));
    lines.push("Сколько игроков: " + (p.players || ""));
    lines.push("Бюджет: " + (p.budget || ""));
    lines.push("Описание: " + (p.details || ""));
  } else if(kind === "contact"){
    lines.push("💬 Обратная связь");
    lines.push("Имя: " + (p.name || ""));
    lines.push("Контакт: " + (p.contact || ""));
    lines.push("Сообщение: " + (p.message || ""));
  } else {
    lines.push("📩 Заявка (" + kind + ")");
    Object.entries(p).forEach(([k,v])=>lines.push(k + ": " + v));
  }

  const text = lines.join("\n");
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });

  if(!resp.ok){
    const t = await resp.text();
    return { statusCode: 500, body: t || "Telegram error", headers: corsHeaders() };
  }

  return { statusCode: 200, body: JSON.stringify({ok:true}), headers: {...corsHeaders(), "Content-Type":"application/json"} };
};

function corsHeaders(){
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}