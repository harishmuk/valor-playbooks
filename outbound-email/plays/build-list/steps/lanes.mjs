import { laneHealth } from "../../../lib/steps.mjs";
/** Checks every lane this campaign may send from before any list is built. */
export default async (ctx) => {
  const r = await laneHealth(ctx, ctx.steps.load.output.campaign.lanes ?? []);
  if (!r.healthy.length) throw new Error(`no sending lane is ready: ${r.summary}`);
  return r;
};
