import { doNotContactReason } from "../../../lib/steps.mjs";

/** Before each follow-up: stop if they replied, bounced, opted out or became a known contact in the meantime. */
export default async function (ctx) {
  const reason = await doNotContactReason(ctx, ctx.inputs.email, ctx.steps.load.output.campaign);
  return { go: reason === null, reason };
}
