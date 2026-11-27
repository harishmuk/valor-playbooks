import { addDays } from "../../../lib/steps.mjs";

/** Warmup ends after the lane's warmup_days (14 by default). */
export default (ctx) => ({ until: addDays(ctx.now, Number(ctx.steps.load.output.campaign.sender?.warmup_days ?? 14)) });
