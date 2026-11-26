import { onList } from "../../lib/email.mjs";

export default function (ctx) {
  const to = ctx.deliverable?.to ?? ctx.task.inputs.email;
  if (onList(ctx.list("replied"), to)) return { ok: false, reason: `${to} has replied; the sequence stops` };
  if (onList(ctx.list("bounced"), to)) return { ok: false, reason: `${to} bounced; the sequence stops` };
  return { ok: true };
}
