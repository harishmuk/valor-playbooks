import { normalizeBody, result } from "../../../lib/email.mjs";

export const LABELS = ["interested", "question", "meeting_time", "not_now", "referral", "opted_out", "out_of_office", "wrong_person", "other"];

/** Fixed label, verbatim quote, the fields each label needs, and agreement with the code-only opt-out rule. */
export default function (d, ctx) {
  const r = [];
  if (!LABELS.includes(d?.label)) return result([`label must be one of ${LABELS.join(", ")}`]);
  const text = normalizeBody(ctx.inputs.event?.text).replace(/\s+/g, " ").toLowerCase();
  const quote = normalizeBody(d.quote).replace(/\s+/g, " ").toLowerCase();
  if (!quote) r.push("quote the line that supports the label");
  else if (!text.includes(quote)) r.push("the quote is not in the message word for word");
  if (d.label === "meeting_time" && isNaN(new Date(String(d.meeting_time ?? "")).getTime())) r.push("meeting_time needs an ISO date and time");
  if (d.label === "referral" && !/@/.test(String(d.referral?.email ?? ""))) r.push("referral needs the referred person's email");
  if (d.label === "out_of_office" && d.return_date && isNaN(new Date(String(d.return_date)).getTime())) r.push("return_date is not a date");
  const rule = ctx.inputs.steps?.load?.output?.opt_out_rule === true;
  if (rule && d.label !== "opted_out")
    r.push(`the opt-out rule matched this message but the label is ${d.label}; the sender is already suppressed, and the owner decides`);
  return result(r);
}
