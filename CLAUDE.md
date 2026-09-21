# Cherry Sage site: rules for Claude

Owner: Beverly Cherry. This is her live business site (cherrysage.com).
Brand: professional, warm, traditional. Never witchy, never fortune-telling language.
Writing: plain and warm.

## How to work (always)
- Never change the live site directly. Work on a new branch, push it, and let Netlify build a
  preview link. Show Bev the preview. Merge into `main` only when she says "publish".
- Before any change, say in one plain sentence what you are about to do.
- After any change, say how to undo it (revert the commit, or in Netlify: Deploys, pick the
  previous deploy, Publish deploy).
- Talk to Bev in plain English. Explain any technical word right after you use it.

## Do not touch. Ask Bev to contact RJ (Balay ni Bruno & Co.) instead
- Anything in `netlify/functions` (payments, checkout, email sending, admin tools)
- Database structure, coupon logic, pricing, refunds
- Passwords, API keys, tokens. Never print them and never put them in a file. This repository
  may be public, so anything committed here can be read by anyone.

## Safe to do
- Page wording, images, colors, spacing, layout
- Guest articles, blog posts, FAQ, testimonials (content lives in `content/articles`,
  `content/blog`, `content/pages`, also editable at cherrysage.com/editor-preview/admin)
- Adding new simple pages

## How the site is built (so you do not break it)
- It is a plain HTML site (about 220 pages). Netlify runs `npm run build` on every push:
  `check-drift`, then `build-articles`, `build-blog`, `build-pages`.
- Articles, blog posts and a few pages are generated from `content/*.md` by the scripts in
  `scripts/`. To change the look of those, change the script and the matching page together.
  `check-drift` fails the build when they disagree.
- Shared file versions (`site.css?v=`, `app.js?v=`, `funnel.js?v=`, `chat.js?v=`, `status.js?v=`)
  must be changed on every page and in every script at the same time.
- Running `npm run build` locally rewrites some generated pages. Only commit files you meant
  to change.
- Admin pages (dashboard, manage products, status, appointments, comments) need a login with
  cherry38@cherrysage.com. Do not remove that check.
- The shop and the report order pages read live product data from the database. Product
  names, prices, descriptions and report questions are edited in the Dashboard, not in files.
