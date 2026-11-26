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
  const segs = Object.entries(bySeg).map(([k, v]) => `${k} ${v}`).join(", ");
  return { prospects, reserves, by_segment: bySeg, summary: `${prospects.length} people (${segs || "none"}), ${reserves.length} reserves` };
}
