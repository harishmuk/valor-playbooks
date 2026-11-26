import { lower, result } from "../../../lib/email.mjs";

/** The event read back from the calendar is at the agreed time and has the person as an attendee. */
export default function (_d, ctx) {
  const ev = (ctx.read_back ?? [])[0];
  if (!ev) return result(["the calendar has no such event"]);
  const r = [];
  if (new Date(String(ev.start)).getTime() !== new Date(String(ctx.inputs.meeting_time)).getTime())
    r.push(`event starts at ${ev.start}, not the agreed ${ctx.inputs.meeting_time}`);
  const attendees = (ev.attendees ?? []).map(lower);
  if (!attendees.includes(lower(ctx.inputs.email))) r.push(`${ctx.inputs.email} is not among the attendees`);
  if (ev.status && ev.status !== "confirmed") r.push(`event status is ${ev.status}`);
  return result(r);
}
