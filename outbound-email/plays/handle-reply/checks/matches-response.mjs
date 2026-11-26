import { bodyHash, lower, result } from "../../../lib/email.mjs";

export default function (d, ctx) {
  const want = ctx.inputs.steps?.respond?.output;
  if (!want?.body) return result(["there is no written reply to send"]);
  const r = [];
  if (lower(d?.to) !== lower(ctx.inputs.event?.from)) r.push(`draft is addressed to ${d?.to}, not ${ctx.inputs.event?.from}`);
  if (bodyHash(d?.body) !== bodyHash(want.body)) r.push("body differs from the written reply");
  return result(r);
}
