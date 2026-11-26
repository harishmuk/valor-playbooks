import { doNotContactReason } from "../../../lib/steps.mjs";

/** Candidates from the prospect source's saved search, minus everyone the workspace says not to email. */
export default async function (ctx) {
  const campaign = ctx.steps.load.output.campaign;
  const search = campaign.audience?.saved_search;
  if (!search) throw new Error("campaign.audience.saved_search is not set");
  const rows = await ctx.query("prospects", "search", { saved_search: search });
  const candidates = [];
  const removed = [];
  for (const p of rows) {
    const reason = await doNotContactReason(ctx, p.email, campaign);
    if (reason) removed.push({ email: p.email, company: p.company, reason });
    else candidates.push(p);
  }
  return { candidates, removed, count: candidates.length };
}
