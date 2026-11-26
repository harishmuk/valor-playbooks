import { campaignOf, result } from "../../../lib/email.mjs";

const DAY = 86400e3;

/** Fields present, verdict from the fixed set, hook sourced and fresh, pain points from the campaign's list. */
export default function (d, ctx) {
  const c = campaignOf(ctx.inputs);
  const r = [];
  if (!["qualified", "disqualify"].includes(d?.verdict)) return result(["verdict must be qualified or disqualify"]);
  if (d.verdict === "disqualify") return result(d.reason ? [] : ["a disqualify verdict needs a reason"]);
  const h = d.hook ?? {};
  if (!h.fact) r.push("hook.fact is missing");
  if (!/^https?:\/\//.test(String(h.source_url ?? ""))) r.push("hook.source_url must be a URL");
  if (!h.quote) r.push("hook.quote is missing: quote the sentence that supports the hook");
  const maxDays = c.research?.hook_max_age_days ?? 365;
  const date = new Date(String(h.source_date ?? ""));
  if (isNaN(date.getTime())) r.push("hook.source_date is missing or not a date");
  else if (Date.now() - date.getTime() > maxDays * DAY) r.push(`hook source is dated ${h.source_date}, older than ${maxDays} days`);
  const allowed = (c.offer?.pain_points ?? []).map((p) => String(p).toLowerCase());
  const pains = Array.isArray(d.pain_points) ? d.pain_points : [];
  if (!pains.length || pains.length > 2) r.push("give one or two pain points");
  if (allowed.length) for (const p of pains) if (!allowed.includes(String(p.id ?? p).toLowerCase())) r.push(`pain point "${p.id ?? p}" is not in the campaign's list`);
  return result(r);
}
