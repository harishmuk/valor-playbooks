import { campaignOf, emailProblems, result } from "../../../lib/email.mjs";

/** Every email in the sequence against the campaign's rules, and the hook traced back to the research record. */
export default function (d, ctx) {
  const c = campaignOf(ctx.inputs);
  const emails = Array.isArray(d?.emails) ? d.emails : [];
  const touches = c.rules?.touches ?? 3;
  const r = [];
  if (emails.length !== touches) r.push(`the campaign's sequence has ${touches} emails; got ${emails.length}`);
  emails.forEach((e, i) => r.push(...emailProblems(e, c, i)));
  const research = ctx.inputs.steps?.research?.output ?? {};
  if (research.id && d?.based_on_research !== research.id) r.push(`based_on_research must name the research record ${research.id}`);
  return result(r);
}
