import { allowedClaims, bannedPhrases, campaignOf, stripFooter, unsupportedFigures } from "../../lib/email.mjs";

export default function (ctx) {
  const d = ctx.deliverable;
  if (!d || typeof d !== "object" || !("body" in d)) return { ok: true };
  const c = campaignOf(ctx.task.inputs);
  const text = `${d.subject ?? ""}\n${stripFooter(d.body, c)}`;
  const figs = unsupportedFigures(text, allowedClaims(c));
  if (figs.length) return { ok: false, reason: `unsupported figure(s): ${figs.join(", ")}` };
  const banned = bannedPhrases(text, c.rules?.banned_phrases);
  if (banned.length) return { ok: false, reason: `banned phrase(s): ${banned.join(", ")}` };
  return { ok: true };
}
