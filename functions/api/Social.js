// Cloudflare Pages Function - handles GET/POST for /api/social
//
// Uses the same KV namespace as decisions.js and contributors.js (bound as
// `DECISIONS`), but under its own key so it never collides with either.
//
// This is shared, non-sensitive information (public social media URLs), so
// unlike the "Logins & access needed" checklist, it saves to the shared
// board rather than being emailed privately.
//
// Data model: one KV key, "social:links" -> JSON object of
//   { youtube, instagram, facebook, linkedin, x, updatedAt }

const KEY = "social:links";
const FIELDS = ["youtube", "instagram", "facebook", "linkedin", "x"];

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DECISIONS) {
    return jsonResponse(
      { error: "KV namespace 'DECISIONS' is not bound to this Pages project yet." },
      500
    );
  }
  const raw = await env.DECISIONS.get(KEY);
  const stored = raw ? JSON.parse(raw) : {};
  const result = {};
  FIELDS.forEach((f) => { result[f] = stored[f] || ""; });
  return jsonResponse(result, 200);
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

  const record = { updatedAt: Date.now() };
  FIELDS.forEach((f) => {
    let val = String((body && body[f]) || "").trim().slice(0, 300);
    // be forgiving - if someone pastes a bare URL without a scheme, add one
    if (val && !/^https?:\/\//i.test(val)) {
      val = "https://" + val;
    }
    record[f] = val;
  });

  await env.DECISIONS.put(KEY, JSON.stringify(record));

  return jsonResponse(record, 200);
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
