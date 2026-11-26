import { loadCampaign } from "../../../lib/steps.mjs";
import { optOutRule } from "../../../lib/email.mjs";

/** Loads the campaign and applies the code-only opt-out rule to the message before any agent reads it. */
export default async function (ctx) {
  const campaign = await loadCampaign(ctx);
  return { campaign, opt_out_rule: optOutRule(ctx.inputs.event?.text, campaign) };
}
