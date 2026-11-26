/** Every chosen address through the verifier source. Invalid addresses always go; risky ones go unless the campaign keeps them. */
export default async function (ctx) {
  const campaign = ctx.steps.load.output.campaign;
  const keepRisky = campaign.audience?.keep_risky_addresses === true;
  const chosen = (ctx.steps.qualify.output.companies ?? []).filter((c) => c.verdict === "qualified").flatMap((c) => (c.people ?? []).map((p) => ({ ...p, company: c.company, segment: c.segment, fit: c.fit })));
  const valid = [];
  const dropped = [];
  for (const p of chosen) {
    const [v] = await ctx.query("verifier", "verify", { email: String(p.email).toLowerCase() });
    const status = v?.status ?? "unknown";
    if (status === "valid" || (keepRisky && ["catch_all", "risky"].includes(status))) valid.push({ ...p, email_status: status });
    else dropped.push({ email: p.email, status });
  }
  return { valid, dropped };
}
