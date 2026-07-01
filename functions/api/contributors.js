// Cloudflare Pages Function - handles GET/POST/DELETE for /api/contributors
//
// Uses the same KV namespace as decisions.js (bound as `DECISIONS`), but under
// its own key so it never collides with "decision:<pageId>" records.
//
// Data model: one KV key, "contributors:list" -> JSON array of
//   { name, position, email, addedAt }

const KEY = "contributors:list";

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DECISIONS) {
    return jsonResponse(
      { error: "KV namespace 'DECISIONS' is not bound to this Pages project yet." },
      500
    );
  }
  const raw = await env.DECISIONS.get(KEY);
  const list = raw ? JSON.parse(raw) : [];
  return jsonResponse(list, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DECISIONS) {
    return jsonResponse(
      { error: "KV namespace 'DECISIONS' is not bound to this Pages project yet." },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const name = String((body && body.name) || "").trim().slice(0, 120);
  const position = String((body && body.position) || "").trim().slice(0, 120);
  const email = String((body && body.email) || "").trim().slice(0, 200);
  if (!name || !email || !email.includes("@")) {
    return jsonResponse({ error: "A valid name and email are required" }, 400);
  }

  const raw = await env.DECISIONS.get(KEY);
  const list = raw ? JSON.parse(raw) : [];

  // avoid piling up exact duplicates if someone double-clicks "Add"
  const alreadyExists = list.some((c) => c.email.toLowerCase() === email.toLowerCase());
  if (!alreadyExists) {
    list.push({ name, position, email, addedAt: Date.now() });
    await env.DECISIONS.put(KEY, JSON.stringify(list));
  }

  return jsonResponse(list, 200);
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.DECISIONS) {
    return jsonResponse(
      { error: "KV namespace 'DECISIONS' is not bound to this Pages project yet." },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const idx = Number.isInteger(body && body.index) ? body.index : -1;

  const raw = await env.DECISIONS.get(KEY);
  let list = raw ? JSON.parse(raw) : [];
  if (idx >= 0 && idx < list.length) {
    list.splice(idx, 1);
    await env.DECISIONS.put(KEY, JSON.stringify(list));
  }

  return jsonResponse(list, 200);
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
