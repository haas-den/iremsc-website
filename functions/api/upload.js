// Cloudflare Pages Function - handles POST /api/upload
//
// Requires an R2 bucket bound to this Pages project as `UPLOADS`.
// (Pages dashboard -> your project -> Settings -> Bindings -> Add -> R2 bucket)
//
// Accepts multipart/form-data:
//   file    - the file being uploaded (required)
//   pageId  - which page card it belongs to (required)
//   key     - "ext-2" / "file-5" for a replacement, or omitted for a standalone upload
//   label   - display name to show in the tool (optional, defaults to file name)
//
// Stores the object in R2 and returns a URL served by /api/file/[[path]].js

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.UPLOADS) {
    return jsonResponse(
      { error: "R2 bucket 'UPLOADS' is not bound to this Pages project yet." },
      500
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return jsonResponse({ error: "Expected multipart/form-data" }, 400);
  }

  const file = form.get("file");
  const pageId = (form.get("pageId") || "unknown").toString().replace(/[^a-zA-Z0-9_-]/g, "_");
  const key = (form.get("key") || "").toString().replace(/[^a-zA-Z0-9_-]/g, "_");
  const label = (form.get("label") || "").toString().slice(0, 200);

  if (!file || typeof file === "string") {
    return jsonResponse({ error: "No file provided" }, 400);
  }
  if (file.size > 50 * 1024 * 1024) {
    return jsonResponse({ error: "File too large (50MB limit)" }, 400);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const folder = key ? key : "standalone/" + Date.now();
  const objectKey = pageId + "/" + folder + "/" + Date.now() + "-" + safeName;

  await env.UPLOADS.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  return jsonResponse(
    {
      ok: true,
      key: objectKey,
      url: "/api/file/" + objectKey,
      name: label || file.name,
      size: file.size,
    },
    200
  );
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
