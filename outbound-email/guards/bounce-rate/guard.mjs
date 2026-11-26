import { campaignOf } from "../../lib/email.mjs";

export default function (ctx) {
  const c = campaignOf(ctx.task.inputs);
  const max = c.limits?.max_bounce_rate ?? 0.03;
  const min = c.limits?.bounce_rate_min_sends ?? 20;
  const sent = ctx.list("sent").size;
  const bounced = ctx.list("bounced").size;
  if (sent >= min && bounced / sent > max)
    return { ok: false, reason: `bounce rate ${(100 * bounced / sent).toFixed(1)}% (${bounced} of ${sent}) is over ${(100 * max).toFixed(1)}%; check the list and the domain before sending more` };
  return { ok: true };
}
