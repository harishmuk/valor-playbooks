// Code steps shared by the plays. Each play's steps/ file re-exports one of these, so a layer can swap a single file.
import { lower, onList } from "./email.mjs";

/**
 * Sending lanes: the workspace's mailboxes, set up once and shared by every goal. One row per mailbox in the `senders`
 * source: id, name, company, mailbox, domain, primary_domain, postal_address, opt_out_line, daily_cap, status
 * (active | warming | planned | paused), resource (the vault resource VALOR sends from), and for setup: warmup_days, setup_budget_usd, seed_inboxes, min_inbox_share.
 */
export async function loadLanes(ctx) {
  return ctx.query("senders", "get", {});
}

/** Lanes a campaign may send from: active ones, limited to the campaign's `senders` list when it has one. */
export function sendingLanes(lanes, campaign) {
  const allow = campaign?.senders;
  return lanes.filter((l) => (l.status ?? "active") === "active" && (!allow?.length || allow.includes(l.id) || allow.includes(l.mailbox)));
}

/**
 * Loads one goal's campaign (who, offer, claims, rules) from the `campaigns` source and joins it with the sending lane
 * for this run (inputs.sender, or the mailbox a reply came to). Every play starts with this, so checks and guards see
 * one copy, as `campaign` with `campaign.sender` being this run's lane and `campaign.lanes` every lane it may use.
 */
export async function loadCampaign(ctx) {
  const id = ctx.inputs.campaign;
  let campaign = { id: id ?? null };
  if (id) {
    const rows = await ctx.query("campaigns", "get", { id });
    if (!rows.length) throw new Error(`campaign "${id}" not found in the campaigns source`);
    campaign = rows[0];
  }
  const all = await loadLanes(ctx);
  const want = lower(ctx.inputs.sender ?? ctx.inputs.event?.to ?? "");
  const sender = (want && all.find((l) => lower(l.id) === want || lower(l.mailbox) === want)) ?? sendingLanes(all, campaign)[0];
  if (ctx.inputs.sender && !sender) throw new Error(`sending lane "${ctx.inputs.sender}" not found in the senders source`);
  return {
    ...campaign,
    lanes: sendingLanes(all, campaign),
    sender: sender ?? {},
    rules: { ...(campaign.rules ?? {}), opt_out_line: sender?.opt_out_line ?? campaign.rules?.opt_out_line },
  };
}

/** Why VALOR must not write to this person, or null. Code only: lists in the ledger and the workspace's contacts source. */
export async function doNotContactReason(ctx, email, campaign) {
  if (!email) return "no email address";
  if (onList(ctx.list("suppression"), email)) return "on the suppression list";
  if (onList(ctx.list("bounced"), email)) return "address bounced before";
  if (onList(ctx.list("replied"), email)) return "already replied";
  const domain = lower(email).split("@")[1];
  const blocked = (campaign?.audience?.exclude_domains ?? []).map(lower);
  if (domain && blocked.includes(domain)) return `domain ${domain} is excluded by the campaign`;
  const known = await ctx.query("contacts", "known", { email: lower(email) });
  if (known.length) return `existing relationship (${known[0].relationship ?? "known contact"})`;
  return null;
}

export function addDays(now, days) {
  return new Date(now.getTime() + days * 86400e3).toISOString();
}

/**
 * Deliverability of each sending lane, read by VALOR from public DNS (the `dns` source), code only:
 * - the sending domain publishes SPF (exactly one record), DKIM (a selector resolves), DMARC and MX;
 * - the lane never sends from the main domain (primary_domain), so cold outreach cannot hurt the company's own mail;
 * - the main domain publishes DMARC (a warning only: it protects the brand, it does not block sending).
 * A lane that fails is left out of the list; if every lane fails, the list is not built.
 */
export async function laneHealth(ctx, lanes) {
  const healthy = [];
  const failed = [];
  const warnings = [];
  const auth = async (domain) => (domain ? ((await ctx.query("dns", "auth", { domain })) ?? [])[0] : undefined);
  for (const l of lanes) {
    const reasons = [];
    const domain = lower(l.domain ?? String(l.mailbox ?? "").split("@")[1] ?? "");
    const main = lower(l.primary_domain ?? "");
    if (!domain) reasons.push("no sending domain");
    if (main && domain === main) reasons.push(`sends from the main domain ${main}; use a separate sending domain`);
    const rec = await auth(domain);
    if (domain && !rec) reasons.push(`no DNS answer for ${domain}`);
    if (rec) {
      if (!/^v=spf1\b/i.test(String(rec.spf ?? ""))) reasons.push(`${domain}: ${String(rec.spf ?? "").startsWith("MULTIPLE") ? "more than one SPF record" : "no SPF record"}`);
      if (rec.dkim !== true) reasons.push(`${domain}: DKIM not found`);
      if (!/^v=DMARC1\b/i.test(String(rec.dmarc ?? ""))) reasons.push(`${domain}: no DMARC record`);
      if (!Array.isArray(rec.mx) || !rec.mx.length) reasons.push(`${domain}: no MX records, so replies and bounces cannot arrive`);
    }
    if (main && main !== domain) {
      const m = await auth(main);
      if (!m || !/^v=DMARC1\b/i.test(String(m.dmarc ?? ""))) warnings.push(`${l.id}: main domain ${main} has no DMARC record`);
    }
    if (reasons.length) failed.push({ id: l.id, reasons });
    else healthy.push(l.id);
  }
  const summary = `${healthy.length} of ${lanes.length} lanes ready${failed.length ? `; not ready: ${failed.map((f) => `${f.id} (${f.reasons.join("; ")})`).join(", ")}` : ""}`;
  return { healthy, failed, warnings, summary };
}
