import { laneHealth } from "../../../lib/steps.mjs";
/** Reports every lane; unlike build-list it never throws, so the report is the output. */
export default async (ctx) => laneHealth(ctx, ctx.steps.load.output.campaign.lanes ?? []);
