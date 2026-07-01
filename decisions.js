// Cloudflare Pages Function - handles GET/POST for /api/decisions
//
// Requires a KV namespace bound to this Pages project as `DECISIONS`.
// (Pages dashboard -> your project -> Settings -> Functions -> KV namespace bindings)
//
// Data model: one KV key per reviewed page, "decision:<pageId>" ->
//   JSON.stringify({
//     status: "keep" | "cut" | "undecided",
//     parent, notes, updatedAt,
//     decisionMaker: { name, email } | null,
//     items: { "ext-0": "keep"|"cut", "file-3": "cut", "standalone-0": "keep", ... },
//     uploads: {
//       "file-3": { name, url, uploadedAt },          // replacement for an existing file
//       standalone: [ { name, url, uploadedAt }, ... ] // brand new files added on their own
//     }
//   })
//
// Note: contributor records (name/email list) live under a different key
// ("contributors:list") in this same namespace - see functions/api/contributors.js.
// The prefix scan below only matches "decision:" keys, so the two never collide.

const PREFIX = "decision:";

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DECISIONS) {
    return jsonResponse(
      { error: "KV namespace 'DECISIONS' is not bound to this Pages project yet." },
      500
    );
  }

  const result = {};
  let cursor;
  do {
    const list = await env.DECISIONS.list({ prefix: PREFIX, cursor });
    await Promise.all(
      list.keys.map(async (k) => {
        const value = await env.DECISIONS.get(k.name);
        if (value) {
          const id = k.name.slice(PREFIX.length);
          try {
            result[id] = JSON.parse(value);
          } catch (e) {
            // skip corrupt record rather than failing the whole response
          }
        }
      })
    );
    cursor = list.cursor;
  } while (cursor);

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

  const { id, status, parent, notes, decisionMaker, items, uploads } = body || {};
  if (!id || typeof id !== "string") {
    return jsonResponse({ error: "Missing or invalid 'id'" }, 400);
  }

  const safeStatus = status === "keep" || status === "cut" ? status : "undecided";

  let safeDecisionMaker = null;
  if (decisionMaker && typeof decisionMaker === "object" && decisionMaker.email) {
    safeDecisionMaker = {
      name: String(decisionMaker.name || "").slice(0, 120),
      email: String(decisionMaker.email || "").slice(0, 200),
    };
  }

  const record = {
    status: safeStatus,
    parent: typeof parent === "string" ? parent : "",
    notes: typeof notes === "string" ? notes.slice(0, 4000) : "",
    decisionMaker: safeDecisionMaker,
    items: items && typeof items === "object" ? items : {},
    uploads: uploads && typeof uploads === "object" ? uploads : {},
    updatedAt: Date.now(),
  };

  await env.DECISIONS.put(PREFIX + id, JSON.stringify(record));

  return jsonResponse({ ok: true, id, record }, 200);
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
