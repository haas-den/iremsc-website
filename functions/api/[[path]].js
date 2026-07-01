// Cloudflare Pages Function - handles GET /api/file/<any path>
// Streams an object back out of the `UPLOADS` R2 bucket.
//
// File at functions/api/file/[[path]].js matches /api/file/* and Cloudflare
// gives us the matched segments as an array in context.params.path.

export async function onRequestGet(context) {
  const { env, params } = context;

  if (!env.UPLOADS) {
    return new Response("R2 bucket 'UPLOADS' is not bound to this Pages project yet.", {
      status: 500,
    });
  }

  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const key = segments.join("/");

  const obj = await env.UPLOADS.get(key);
  if (!obj) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(obj.body, { headers });
}
