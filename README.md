# IREMSC Content Triage - deploy instructions

A static review tool (`index.html`) backed by Cloudflare KV (page-level
decisions) and Cloudflare R2 (uploaded replacement/new files), both wired up
through Pages Functions. No login required for your team; anyone with the
link sees the same shared board.

## What's in here

```
index.html                       the tool itself
functions/api/decisions.js       GET/POST - reads & writes page decisions (KV)
functions/api/contributors.js    GET/POST/DELETE - the shared name/email list (KV)
functions/api/upload.js          POST - accepts a file upload (R2)
functions/api/file/[[path]].js   GET - serves an uploaded file back out (R2)
README.md                        this file
```

## 1. Push this folder to GitHub

```
git init
git add .
git commit -m "IREMSC content triage tool"
git branch -M main
git remote add origin <your-new-repo-url>
git push -u origin main
```

Or just create a new repo on GitHub and upload these files through the web UI
- no build step, so there's nothing to configure beyond the files themselves.

## 2. Create the Cloudflare Pages project

1. Cloudflare dashboard -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. Pick the repo you just pushed.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: `/`
4. Click **Save and Deploy**. You'll get a `https://<project-name>.pages.dev`
   URL - that's your shareable link. Saving and uploading won't work yet -
   that's steps 3 and 4.

## 3. Create the KV namespace (page decisions) and bind it

1. Cloudflare dashboard -> **Workers & Pages** -> **KV** -> **Create a namespace**.
   Name it something like `iremsc-decisions`.
2. Pages project -> **Settings** -> **Functions** -> **KV namespace bindings** -> **Add binding**.
   - Variable name: `DECISIONS` (must match exactly - the code looks for `env.DECISIONS`)
   - KV namespace: the one you just created

## 4. Create the R2 bucket (uploaded files) and bind it

1. Cloudflare dashboard -> **R2** -> **Create bucket**. Name it something like
   `iremsc-uploads`. Default settings are fine - the bucket does not need to
   be public, since `/api/file/[[path]].js` streams files through your own
   site instead.
2. Pages project -> **Settings** -> **Functions** -> **R2 bucket bindings** -> **Add binding**.
   - Variable name: `UPLOADS` (must match exactly - the code looks for `env.UPLOADS`)
   - R2 bucket: the one you just created

## 5. Redeploy

Bindings only take effect on the *next* deployment after you add them.
Settings -> Deployments -> Retry on the latest one, or push an empty commit:

```
git commit --allow-empty -m "trigger redeploy after bindings"
git push
```

Visit your `.pages.dev` URL. Click Keep/Merge/Cut on a page, on an individual
link, try uploading a replacement file - check the KV namespace and R2 bucket
in the dashboard and you should see data appearing as people use the tool.

## 6. (Optional) Custom domain

Pages project -> **Custom domains** -> add a subdomain on any zone you already
manage in this Cloudflare account (e.g. `triage.yourdomain.org`).

## 7. (Optional) Restrict access

This is unauthenticated by default - anyone with the link can view and edit.
For an internal-only tool, put it behind **Cloudflare Access** (Zero Trust ->
Access -> Applications -> add this domain, restrict to your team's email
addresses/domain). Takes about 5 minutes and requires no code changes here.

## How the pieces fit together

- **Page-level decisions** (Cut/Keep, destination, notes, decision maker) ->
  one KV key per page: `decision:<pageId>`.
- **Per-link and per-file decisions** (the little C/K buttons next to each
  external link or file resource) -> stored inside that same KV record, under
  an `items` map, e.g. `items["file-3"] = "cut"`.
- **Replacement file uploads** (swapping in a new PDF for an existing one) ->
  stored in R2, with the resulting URL saved into that page's `uploads` map,
  e.g. `uploads["file-3"] = {name, url, uploadedAt}`.
- **Standalone uploads** (brand-new files not tied to anything that existed
  on the old site) -> same R2 bucket, appended to `uploads.standalone`.
- **Information Contributors** (the name/email list at the top of the page)
  -> one KV key, `contributors:list`, holding a JSON array. This is what
  populates the "Decision maker" dropdown on every page card. Adding a
  contributor is visible to the whole team within ~15 seconds (same polling
  loop as decisions).
- **The "Logins & access needed" checklist** is intentionally separate from
  all of the above - it never touches KV, R2, or any API. Checking boxes and
  clicking "Email me this checklist" just opens a `mailto:` link in your own
  email client, addressed to whatever email you typed in. Nothing about it is
  visible to your team or stored anywhere on the server.

## A note on file size

R2 storage and Workers/Pages requests both handle large files fine, but this
endpoint caps uploads at 50MB (see `upload.js`) as a sane default for PDFs,
images, and the occasional video. Raise that constant if you need to.
