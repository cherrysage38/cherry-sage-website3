// TEMPORARY (2026-09-20): reports only whether the running functions see CS_SERVER_KEY and whether it
// matches the expected value, using a hash. Removed right after the check.
import { createHash } from "node:crypto";
const EXPECTED = "d17a46793fd63ce71ff74beea5bec9b57806b95b1fcc4a484a57aaeb10dc25dc";
export default async () => {
  const k = process.env.CS_SERVER_KEY || "";
  const matches = k.length > 0 && createHash("sha256").update(k).digest("hex") === EXPECTED;
  return new Response(JSON.stringify({ set: k.length > 0, matches }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
};
