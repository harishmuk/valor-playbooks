import { bodyHash, lower, result } from "../../../lib/email.mjs";

/** The email about to be sent is, word for word, the n-th email of the approved sequence (step send-<n>), to the run's recipient. */
export default function (d, ctx) {
  const n = Number(/(\d+)$/.exec(String(ctx.task?.step_id ?? ""))?.[1] ?? 1);
  const want = (ctx.inputs.steps?.write?.output?.emails ?? [])[n - 1];
  if (!want) return result([`the sequence has no email ${n}`]);
  const r = [];
  if (lower(d?.to) !== lower(ctx.inputs.email)) r.push(`draft is addressed to ${d?.to}, not ${ctx.inputs.email}`);
  if (bodyHash(d?.body) !== bodyHash(want.body)) r.push(`body differs from email ${n} of the approved sequence`);
  if (n === 1 && String(d?.subject ?? "").trim() !== String(want.subject ?? "").trim()) r.push("subject differs from the approved sequence");
  return result(r);
}
