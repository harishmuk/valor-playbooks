import { onList } from "../../lib/email.mjs";

export default function (ctx) {
  const to = ctx.deliverable?.to ?? ctx.task.inputs.email ?? ctx.task.inputs.recipient;
  if (onList(ctx.list("suppression"), to)) return { ok: false, reason: `${to} is on the suppression list` };
  return { ok: true };
}
