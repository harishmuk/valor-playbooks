/** Holds a send while its lane is on the held-senders list. Lanes with no id (sends outside lanes) pass. */
export default function (ctx) {
  const lane = String(ctx.task.inputs.sender ?? "").toLowerCase();
  if (lane && ctx.list("held-senders").has(lane)) return { ok: false, reason: `mailbox lane ${lane} is held by mailbox-health (warming up)` };
  return { ok: true };
}
