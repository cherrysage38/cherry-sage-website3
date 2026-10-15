# Cherry Sage site: rules for Claude

Owner: Beverly Cherry. This is her live business site (cherrysage.com).
Brand: professional, warm, traditional. Never witchy, never fortune-telling language.
Writing: plain and warm.
- 1999 (or "since 1999", "27 years"): Bev, 2026-10-12, "there doesn't need to be a mention of 1999
  on every post. That's still too much." So:
  - Blog posts, guest articles and Readings pages: do not mention it. If Bev's own text includes it,
    point it out to her and ask before keeping it.
  - Only the homepage, Meet Cherry Sage and Psychic Reading pages may mention it, once each.
- Blog posts have one picture only, the featured image (front matter `image`). No pictures inside the post
  text (Bev, 2026-10-13).
- Pages and posts open with the reader's question in bold, then the plain answer right under it
  (not the answer alone). Question-style headings below follow the same pattern.

## How to work (always)
- Never change the live site directly. Work on a new branch, push it, and let Netlify build a
  preview link. Show Bev the preview. Merge into `main` only when she says "publish".
- Before any change, say in one plain sentence what you are about to do.
- After any change, say how to undo it (revert the commit, or in Netlify: Deploys, pick the
  previous deploy, Publish deploy).
- Talk to Bev in plain English. Explain any technical word right after you use it.

## Bev or RJ (Balay ni Bruno & Co.) may change (Bev, 2026-10-12)
- Anything in the database, and `netlify/functions/shop-admin.mjs`. Claude cannot reach the database:
  give Bev step-by-step instructions for the Supabase SQL Editor, look first (a read-only query) before
  changing anything, and give an undo step for each change. Save each change and its undo in `_migrations`.
- Some database commands set the final price, apply coupons and record paid orders. Before changing one,
  say so plainly and suggest a small test purchase on the preview before publishing.

## Do not touch. Ask Bev to contact RJ instead
- Everything else in `netlify/functions` (payments, checkout, email sending, other admin tools)
- Passwords, API keys, tokens, for anyone. Never print them and never put them in a file. This
  repository may be public, so anything committed here can be read by anyone.

## If RJ stops working with Bev (Bev, 2026-10-15)
- Bev owns every account (GitHub, Netlify, Supabase, Groq). RJ is a Developer on Supabase only.
- When she says RJ is gone: remove him from Supabase, then change the database master key
  (service_role / secret) and any other keys he may have seen, one at a time, keeping the site
  working. The site itself uses only SUPABASE_URL and SUPABASE_ANON_KEY. Bev pastes new keys into
  Netlify herself; never ask her to share them.

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
- The dashboard's "Changes we made" lists fill themselves: after every live deploy,
  `netlify/functions/deploy-succeeded.mjs` summarizes the new commits and files them. Write clear
  commit messages, because they are what those summaries are made from.
- Scheduled blog posts: a post dated after today (Eastern) is held off the site by `build-blog.js`.
  Each morning `.github/workflows/scheduled-posts.yml` runs `scripts/release-scheduled.js`, which notes any
  post that has come due in `content/.scheduled-log` and commits it; that commit makes Netlify rebuild.
- The shop and the report order pages read live product data from the database. Product
  names, prices, descriptions and report questions are edited in the Dashboard, not in files.
