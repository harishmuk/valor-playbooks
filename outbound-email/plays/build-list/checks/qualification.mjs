import { campaignOf, lower, result } from "../../../lib/email.mjs";

const VERDICTS = ["qualified", "not_a_fit", "out_of_size", "out_of_region", "other"];

/** Every candidate company judged, people chosen only from the candidates, within the per-company limit. */
export default function (d, ctx) {
  const c = campaignOf(ctx.inputs);
  const cands = ctx.inputs.steps?.pull?.output?.candidates ?? [];
  const byCompany = new Map();
  for (const p of cands) byCompany.set(lower(p.company), [...(byCompany.get(lower(p.company)) ?? []), lower(p.email)]);
  const per = Number(c.audience?.per_company ?? 1);
  const out = Array.isArray(d?.companies) ? d.companies : [];
  const r = [];
  const seen = new Set();
  for (const co of out) {
    const key = lower(co.company);
    seen.add(key);
    if (!byCompany.has(key)) r.push(`${co.company} is not among the candidates`);
    if (!VERDICTS.includes(co.verdict)) r.push(`${co.company}: verdict must be one of ${VERDICTS.join(", ")}`);
    if (!String(co.reason ?? "").trim()) r.push(`${co.company}: give a one-line reason`);
    if (!/^https?:\/\//.test(String(co.source_url ?? ""))) r.push(`${co.company}: source_url must be a URL`);
    const people = co.people ?? [];
    if (co.verdict === "qualified") {
      if (!people.length) r.push(`${co.company}: qualified but nobody chosen`);
      if (people.length > per) r.push(`${co.company}: ${people.length} people chosen; the limit is ${per}`);
      for (const p of people) if (!(byCompany.get(key) ?? []).includes(lower(p.email))) r.push(`${co.company}: ${p.email} is not one of its candidates`);
      if (typeof co.fit !== "number" || co.fit < 0 || co.fit > 1) r.push(`${co.company}: fit must be a number from 0 to 1`);
    } else if (people.length) r.push(`${co.company}: people chosen for a company that did not qualify`);
  }
  for (const k of byCompany.keys()) if (!seen.has(k)) r.push(`no verdict for ${k}`);
  return result(r);
}
