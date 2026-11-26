import { loadCampaign, doNotContactReason } from "../../../lib/steps.mjs";

/** Loads the campaign and decides, in code, whether this person may be written to at all. */
export default async function (ctx) {
  const campaign = await loadCampaign(ctx);
  const reason = await doNotContactReason(ctx, ctx.inputs.email, campaign);
  return { campaign, ok: reason === null, reason };
}
