// Cherry Sage — availability status. GET returns what the site should say right now (no login, every
// page's "Chat with Ivy" widget reads it). POST saves changes and needs Cherry's own login.
//
// 2026-09-22 rebuilt after Bev's report that the status "was supposed to follow my scheduled hours",
// "should say Busy when I have an appointment", and that her Away/Vacation switch "doesn't work":
//  - Her hours are the appointment scheduler's hours (cherry_sage.availability_rules), so the status light
//    and the booking page can never disagree. They are edited in Manage My Status.
//  - Holidays and days off are the scheduler's date overrides, so those days also stop taking bookings.
//  - A confirmed appointment happening right now shows Busy (is_appointment_active_now).
//  - Away/Vacation now beats everything. Before, a leftover one-tap "Available" beat it, which is why
//    the switch seemed dead. One-tap states now last until the end of that day (Cherry's time zone).
// Anything the database cannot answer falls back to "online", never to a blank widget.
import { getStore } from "@netlify/blobs";
import { createClient } from "@supabase/supabase-js";

const TZ = "America/New_York";
const MANUAL_STATES = ["available", "busy", "brb", "not_available"];
const DEFAULT_BLOB = { away: false, awayUntil: null, manualState: null, manualDate: null };

function clientFor(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const auth = req ? req.headers.get("authorization") || "" : "";
  const opts = { db: { schema: "cherry_sage" }, auth: { persistSession: false, autoRefreshToken: false } };
  if (auth.startsWith("Bearer ")) opts.global = { headers: { Authorization: auth } };
  return createClient(url, key, opts);
}

async function isOwner(sb) {
  if (!sb) return false;
  const { data, error } = await sb.rpc("is_owner");
  return !error && data === true;
}

function nowIn(tz, at = new Date()) {
  const parts = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(at).forEach((p) => { parts[p.type] = p.value; });
  const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
  return { day, minutes: (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10), date: `${parts.year}-${parts.month}-${parts.day}` };
}

const toMinutes = (t) => { const [h, m] = String(t || "0:0").split(":"); return parseInt(h, 10) * 60 + parseInt(m || "0", 10); };
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// What the site should say right now, and why. Order matters:
//   away/vacation, then today's one-tap busy/back/not-available, then a real appointment, then a one-tap
//   "online", then a holiday or day off, then the weekly hours.
export function compute(s, at = new Date()) {
  const n = nowIn(s.tz || TZ, at);
  const awayActive = s.away && !(s.awayUntil && n.date > s.awayUntil);
  if (awayActive) return { k: "offline", reason: "away" };
  const manual = s.manualState && s.manualDate === n.date ? s.manualState : null;
  if (manual === "busy") return { k: "busy", reason: "manual_busy" };
  if (manual === "brb") return { k: "busy", reason: "manual_brb" };
  if (manual === "not_available") return { k: "offline", reason: "manual_unavailable" };
  if (s.busyNow) return { k: "busy", reason: "appointment" };
  if (manual === "available") return { k: "online", reason: "manual_online" };
  if ((s.holidays || []).some((h) => h.date === n.date)) return { k: "offline", reason: "holiday" };
  const h = (s.hours || {})[n.day];
  if (h && n.minutes >= h[0] && n.minutes < h[1]) return { k: "online", reason: "hours_open" };
  return { k: "offline", reason: "hours_closed" };
}

async function readBlob() {
  try { const v = await getStore("schedule").get("current", { type: "json" }); if (v) return { ...DEFAULT_BLOB, ...v }; } catch { /* first run or no store */ }
  return { ...DEFAULT_BLOB };
}

async function build() {
  const blob = await readBlob();
  const sb = clientFor(null);
  let hours = null, holidays = [], busyNow = false, dbOk = false;
  if (sb) {
    try {
      const [rules, days, busy] = await Promise.all([
        sb.from("availability_rules").select("day_of_week,start_time,end_time,active").eq("active", true),
        sb.from("availability_overrides").select("date,note").eq("is_available", false).order("date"),
        sb.rpc("is_appointment_active_now"),
      ]);
      if (!rules.error && rules.data) {
        hours = {};
        for (let d = 0; d < 7; d++) hours[d] = null;
        for (const r of rules.data) hours[r.day_of_week] = [toMinutes(r.start_time), toMinutes(r.end_time)];
        dbOk = true;
      }
      if (!days.error && days.data) holidays = days.data.map((d) => ({ date: d.date, note: d.note || "" }));
      if (!busy.error) busyNow = !!busy.data;
    } catch { /* fall through to the safe default */ }
  }
  const schedule = { tz: TZ, hours, holidays, busyNow, away: !!blob.away, awayUntil: blob.awayUntil || null, manualState: blob.manualState || null, manualDate: blob.manualDate || null };
  const today = nowIn(TZ).date;
  schedule.manualActive = !!(schedule.manualState && schedule.manualDate === today);
  // No hours from the database means we cannot judge open or closed, so say online (as before).
  schedule.computed = dbOk ? compute(schedule) : (compute({ ...schedule, hours: { 0: [0, 1440], 1: [0, 1440], 2: [0, 1440], 3: [0, 1440], 4: [0, 1440], 5: [0, 1440], 6: [0, 1440] } }));
  return schedule;
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

const mapDbError = (e) => (/^(the hours are not valid|the days off are not valid)/i.test(String(e?.message || "")) ? String(e.message) : null);

export default async (req) => {
  if (req.method === "GET") return json(await build());

  if (req.method === "POST") {
    const sb = clientFor(req);
    if (!(await isOwner(sb))) return json({ error: "unauthorized" }, 403);
    let d = {};
    try { d = await req.json(); } catch { return json({ error: "bad body" }, 400); }

    // hours and days off live in the scheduler's own tables
    if (d.hours && typeof d.hours === "object") {
      const rules = [];
      for (let day = 0; day < 7; day++) {
        const h = d.hours[day];
        if (Array.isArray(h) && h.length === 2) rules.push({ day, start: toTime(Number(h[0])), end: toTime(Number(h[1])) });
      }
      const { error } = await sb.rpc("admin_set_hours", { p_pin: "", p_rules: rules });
      if (error) return json({ error: mapDbError(error) || "could not save your hours" }, mapDbError(error) ? 409 : 500);
    }
    if (Array.isArray(d.holidays)) {
      const days = d.holidays.slice(0, 150).map((h) => ({ date: String(h.date || "").slice(0, 10), note: String(h.note || "").slice(0, 80) }));
      const { error } = await sb.rpc("admin_set_days_off", { p_pin: "", p_days: days });
      if (error) return json({ error: mapDbError(error) || "could not save your days off" }, mapDbError(error) ? 409 : 500);
    }

    // the one-tap status and the away switch
    const blob = await readBlob();
    const today = nowIn(TZ).date;
    if ("manualState" in d) {
      const ms = MANUAL_STATES.includes(d.manualState) ? d.manualState : null;
      blob.manualState = ms; blob.manualDate = ms ? today : null;
    }
    if ("away" in d) blob.away = !!d.away;
    if ("awayUntil" in d) blob.awayUntil = /^\d{4}-\d{2}-\d{2}$/.test(String(d.awayUntil || "")) ? String(d.awayUntil) : null;
    if (!blob.away) blob.awayUntil = null;
    try { await getStore("schedule").setJSON("current", { away: blob.away, awayUntil: blob.awayUntil, manualState: blob.manualState, manualDate: blob.manualDate }); }
    catch { return json({ error: "save failed" }, 500); }
    return json({ ok: true, schedule: await build() });
  }
  return json({ error: "method" }, 405);
};
