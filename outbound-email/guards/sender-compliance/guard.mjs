import { campaignOf, fakeThread, footerProblems } from "../../lib/email.mjs";

export default function (ctx) {
  const d = ctx.deliverable;
  if (!d || typeof d !== "object" || !("body" in d)) return { ok: true };
  const c = campaignOf(ctx.task.inputs);
  const problems = footerProblems(d.body, c);
  if (/send-1$/.test(String(ctx.task.step_id ?? "")) || String(ctx.idempotency_key).endsWith(":1"))
    if (fakeThread(d.subject)) problems.push("first email subject pretends to be a reply or forward");
  return problems.length ? { ok: false, reason: problems.join("; ") } : { ok: true };
}
