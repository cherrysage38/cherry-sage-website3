// Cherry Sage — morning release of scheduled blog posts (Bev, 2026-10-10; moved here 2026-10-17).
// The site build holds back any post dated after today and lists those dates in /scheduled.json.
// Every morning at about 6 AM Eastern this reads that list (and /featured.json), and if a post's date
// has arrived or a featured post's run has ended, it asks Netlify to rebuild the live site, which puts
// the post up. The rebuild refreshes the list, so each date triggers one rebuild only.
// It used to be a GitHub Action that committed a note to main; main now only accepts pull requests.
//
// Setting (Netlify > Project configuration > Environment variables, scope must include Functions):
//   SCHEDULED_POSTS_BUILD_HOOK  the URL of a Netlify build hook for the main branch.

function env(name) {
  try { return Netlify.env.get(name); } catch { return process.env[name]; }
}

const todayEastern = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  return res.json();
}

export default async () => {
  const site = env("URL") || "https://cherrysage.com";
  const today = todayEastern();
  const { waiting = [] } = await getJson(`${site}/scheduled.json`);
  const featured = await getJson(`${site}/featured.json`).catch(() => ({}));

  const due = waiting.filter((d) => d <= today);
  const featureEnded = featured.featured?.until && featured.featured.until < today;
  if (!due.length && !featureEnded) { console.log("Nothing due today."); return; }

  const hook = env("SCHEDULED_POSTS_BUILD_HOOK");
  if (!hook) throw new Error("Posts are due but SCHEDULED_POSTS_BUILD_HOOK is not set.");
  const res = await fetch(`${hook}?trigger_title=${encodeURIComponent(`Scheduled posts for ${today}`)}`, { method: "POST" });
  if (!res.ok) throw new Error(`Build hook answered ${res.status}`);
  console.log(`Rebuilding for ${due.length ? `posts dated ${due.join(", ")}` : "a featured post that ended"}.`);
};

export const config = { schedule: "7 10 * * *" }; // 10:07 UTC = 6:07 AM Eastern in summer, 5:07 AM in winter
