import { allowedClaims, bannedPhrases, campaignOf, footerProblems, result, stripFooter, unresolved, unsupportedFigures, words } from "../../../lib/email.mjs";

export default function (d, ctx) {
  const c = campaignOf(ctx.inputs);
  const r = [];
  if (!String(d?.body ?? "").trim()) return result(["the reply has no body"]);
  const max = c.rules?.reply_max_words ?? 120;
  const n = words(stripFooter(d.body, c));
  if (n > max) r.push(`reply is ${n} words; the limit is ${max}`);
  for (const f of unsupportedFigures(stripFooter(d.body, c), allowedClaims(c))) r.push(`states "${f}", which no allowed claim backs`);
  for (const b of bannedPhrases(d.body, c.rules?.banned_phrases)) r.push(`uses the banned phrase "${b}"`);
  for (const u of unresolved(d.body)) r.push(`unresolved merge field ${u}`);
  r.push(...footerProblems(d.body, c));
  return result(r);
}
