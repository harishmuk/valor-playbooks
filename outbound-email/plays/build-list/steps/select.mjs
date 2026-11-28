/** Ranks by fit, caps each segment's share, keeps reserves. Code, so the same inputs always give the same list. */
export default function (ctx) {
  const c = ctx.steps.load.output.campaign;
  const size = Number(c.audience?.list_size ?? 100);
  const reserveShare = Number(c.audience?.reserve_share ?? 0.2);
  const maxShare = Number(c.audience?.max_segment_share ?? 1);
  const cap = Math.max(1, Math.floor(size * maxShare));
  const pool = [...(ctx.steps["verify-emails"].output.valid ?? [])].sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0) || String(a.email).localeCompare(String(b.email)));
  const bySeg = {};
  const prospects = [];
  const rest = [];
  for (const p of pool) {
    const seg = p.segment ?? "other";
    if (prospects.length < size && (bySeg[seg] ?? 0) < cap) {
      bySeg[seg] = (bySeg[seg] ?? 0) + 1;
      prospects.push(p);
    } else rest.push(p);
  }
  const reserves = rest.slice(0, Math.ceil(size * reserveShare));
  // spread the list over the campaign's sending lanes, in rank order, so each mailbox gets an even share
  const ready = ctx.steps.lanes?.output?.healthy;
  const lanes = (c.lanes ?? []).filter((l) => !ready || ready.includes(l.id));
  if (!lanes.length) throw new Error("no active sending lane: add a mailbox to the senders source (status: active)");
  const unbound = lanes.filter((l) => !l.resource).map((l) => l.id);
  if (unbound.length) throw new Error(`active lanes with no mailbox resource for VALOR to send from: ${unbound.join(", ")} (set resource on the lane)`);
  const byLane = {};
  prospects.forEach((p, i) => {
    const l = lanes[i % lanes.length];
    Object.assign(p, { sender: l.id, sender_daily_cap: Number(l.daily_cap ?? 25) });
    byLane[l.id] = (byLane[l.id] ?? 0) + 1;
  });
  const segs = Object.entries(bySeg).map(([k, v]) => `${k} ${v}`).join(", ");
  const lanesText = Object.entries(byLane).map(([k, v]) => `${k} ${v}`).join(", ");
  return { prospects, reserves, by_segment: bySeg, by_sender: byLane, summary: `${prospects.length} people (${segs || "none"}), ${reserves.length} reserves, sending from ${lanesText}` };
}
