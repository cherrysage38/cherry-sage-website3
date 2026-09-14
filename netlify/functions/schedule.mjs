// Cherry Sage — availability schedule. GET returns the schedule (no auth, read by every page's
// status widget); POST saves it, gated by the same dashboard PIN pattern as shop-admin.mjs/
// dashboard-summary.mjs (not the old STATUS_ADMIN_KEY env var, which was never actually set,
// so Bev had no real way to mark herself away/on holiday -- found 2026-09-15).
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";

const PIN = "0011";

const DEFAULT = {
  tz: "America/New_York",
  // 0=Sun ... 6=Sat. null = closed that day. [openHour, closeHour] in 24h local time.
  hours: { 0:null, 1:[9,21], 2:[9,21], 3:[9,21], 4:[9,21], 5:[9,21], 6:[10,18] },
  always: true,          // while true, always "online" (her current 24h mode) until she sets hours
  holidays: [],          // ["2026-12-25", ...] -> away those days
  away: false            // manual vacation toggle -> away
};

async function checkBusyNow() {
  // Real-time "on a confirmed call right now" signal for the status widget. Returns false
  // (never blocks the widget) if Supabase isn't reachable for any reason.
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "cherry_sage" } });
    const { data, error } = await supabase.rpc("is_appointment_active_now");
    if (error) return false;
    return !!data;
  } catch { return false; }
}

export default async (req) => {
  const store = () => getStore("schedule");
  if (req.method === "GET") {
    let s = DEFAULT;
    try { const v = await store().get("current", { type: "json" }); if (v) s = v; } catch {}
    const busyNow = await checkBusyNow();
    return json({ ...s, busyNow });
  }
  if (req.method === "POST") {
    const pin = req.headers.get("x-dashboard-pin") || "";
    if (pin !== PIN) return json({ error: "unauthorized" }, 403);
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }
    const s = {
      tz: String(d.tz || DEFAULT.tz),
      hours: d.hours && typeof d.hours === "object" ? d.hours : DEFAULT.hours,
      always: !!d.always,
      holidays: Array.isArray(d.holidays) ? d.holidays.slice(0, 60) : [],
      away: !!d.away
    };
    try { await store().setJSON("current", s); } catch (e) { return json({ error: "save failed" }, 500); }
    return json({ ok: true, schedule: s });
  }
  return json({ error: "method" }, 405);
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" } });
}
