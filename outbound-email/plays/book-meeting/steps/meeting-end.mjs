/** When to ask whether the meeting happened: its end plus two hours. */
export default function (ctx) {
  const start = new Date(String(ctx.inputs.meeting_time));
  if (isNaN(start.getTime())) throw new Error(`meeting_time "${ctx.inputs.meeting_time}" is not a date`);
  const minutes = Number(ctx.steps.load.output.campaign?.meeting?.minutes ?? 30);
  return { check_at: new Date(start.getTime() + (minutes + 120) * 60e3).toISOString() };
}
