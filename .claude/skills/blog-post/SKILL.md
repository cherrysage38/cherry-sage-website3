---
name: blog-post
description: Publish a blog post Bev sends (text plus links), especially posts for a guide (pillar) page such as Love & Relationships. Use whenever Bev pastes a post, says "new blog post", "add this post", or gives a title and content for the blog.
---

# Adding a blog post for Bev

Bev sends the words and the links. You turn them into a post file, preview it, and publish
only when she says "publish". Follow CLAUDE.md for tone and for how to talk to her.

## 1. Collect (ask only for what is missing)
- Post text. Keep her wording; fix only typos and obvious formatting.
- Title. If she gives none, use her first heading.
- Links she wants in the post, and where each goes.
- Guide page. Love, dating, exes, soul mates, marriage, breakups → `love-and-relationships`.
- Picture. If she sends none, ask, or offer an existing one from `assets/blog/`. A post with no
  picture is skipped by the build.

## 2. Write `content/blog/<slug>.md`
Slug: the title in lowercase, words joined by hyphens, no punctuation. Check the slug is not
already used by a `.md` in `content/blog` or an `.html` in the site root.

```yaml
---
title: Can a Psychic Tell If Your Ex Will Come Back?
seo_title: Can a Psychic Tell If Your Ex Will Come Back? | Cherry Sage   # under 60 characters if possible
description: One or two plain sentences, 140 to 160 characters, that answer the title.
date: YYYY-MM-DD        # today unless Bev gives a date; a future date schedules it (held back until ~6 AM Eastern that day)
category: Psychic Readings   # must be one of content/blog-topics.yml
author: Cherry Sage
image: /assets/blog/<slug>.jpg
related: true
pillar: love-and-relationships   # leave out if the post is not part of a guide
hidden: false
---
```

Body, written so search engines and AI assistants can quote it (AEO):
- Open with a short bold paragraph that answers the title question directly.
- Use `##` headings phrased as the questions people ask, each ending in `?`. The first
  paragraph under each one should answer it plainly in two to four sentences. For pillar posts
  the build turns these into question-and-answer data (FAQPage) automatically.
- Links: `[words](/page-slug)` for pages on cherrysage.com (no `.html`), full `https://` address
  for other sites. Include at least one link to the guide page and one to `/book-appointment`
  or `/psychic-reading`, unless Bev's text already has them.
- Never witchy or fortune-telling language. No promises that someone will come back.

Pictures go in `assets/blog/`, named after the slug, ideally 1200 px wide and under 400 KB.

## 3. What happens by itself
- The build makes the post page, adds it to the Blog list and the sitemap.
- With `pillar:` set, the post gets a "part of my guide" box linking to the guide page, and
  the guide page's "Guide Posts" section lists the post. Do not edit the guide page by hand.

## 4. Check, push, preview
- Run `npm run build` to check for warnings, then commit only the files you meant to add
  (the `.md`, the picture). Build output pages are rebuilt by Netlify.
- Commit message in plain words, e.g. `Add blog post: Can a Psychic Tell If Your Ex Will Come Back?`
  (it feeds the dashboard's "Changes we made" list).
- Push to the working branch, give Bev the Netlify preview link, and wait for "publish".
- Tell her how to undo: delete the post in the editor (or tick "Hide from site"), or revert
  the commit.
