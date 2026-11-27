// Code steps shared by the plays. Each play's steps/ file re-exports one of these, so a layer can swap a single file.
import { lower, onList } from "./email.mjs";

/**
 * Sending lanes: the workspace's mailboxes, set up once and shared by every goal. One row per mailbox in the `senders`
 * source: id, name, company, mailbox, domain, primary_domain, postal_address, opt_out_line, daily_cap, status
 * (active | warming | planned | paused), resource (the vault resource VALOR sends from), min_health_score and max_spam_rate (mailbox-health), and setup_budget_usd.
 */
export async function loadLanes(ctx) {
  return ctx.query("senders", "get", {});
}

/** Lanes a campaign may send from: active ones not held by mailbox-health, limited to the campaign's `senders` list when it has one. */
export function sendingLanes(lanes, campaign, held = new Set()) {
  const allow = campaign?.senders;
  return lanes.filter((l) => (l.status ?? "active") === "active" && !held.has(lower(l.id)) && (!allow?.length || allow.includes(l.id) || allow.includes(l.mailbox)));
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
  const held = ctx.list ? ctx.list("held-senders") : new Set();
  const sender = (want && all.find((l) => lower(l.id) === want || lower(l.mailbox) === want)) ?? sendingLanes(all, campaign, held)[0];
  if (ctx.inputs.sender && !sender) throw new Error(`sending lane "${ctx.inputs.sender}" not found in the senders source`);
  return {
    ...campaign,
    lanes: sendingLanes(all, campaign, held),
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

/**
 * Mailbox health, judged by code from the workspace's deliverability source (Smartlead, or any provider returning
 * { mailbox, score (0-100), warmup: active|inactive|paused, spam_rate, blocked, blocked_reason, connected }):
 * - cleared to send: score at or above the lane's min_health_score (default 90), spam rate at or under
 *   max_spam_rate (default 0.03), not blocked, connected;
 * - otherwise held: the lane goes on the `held-senders` list (nothing new is assigned to it and its queued sends
 *   wait), and VALOR starts its warmup if it is not warming already.
 * A lane the provider does not know is held too: it cannot be warmed or measured.
 */
export async function mailboxHealth(ctx) {
  const lanes = (await loadLanes(ctx)).filter((l) => ["active", "warming"].includes(l.status ?? "active"));
  const day = new Date(ctx.now).toISOString().slice(0, 10);
  const cleared = [];
  const held = [];
  const acts = [];
  for (const l of lanes) {
    const mailbox = lower(l.mailbox);
    const row = (await ctx.query("deliverability", "health", { mailbox }))[0];
    const min = Number(l.min_health_score ?? 90);
    const maxSpam = Number(l.max_spam_rate ?? 0.03);
    const reasons = [];
    if (!row) reasons.push("not connected in the warmup provider");
    else {
      if (row.connected === false) reasons.push("the warmup provider cannot log in to it");
      if (row.blocked) reasons.push(`warmup blocked${row.blocked_reason ? `: ${row.blocked_reason}` : ""}`);
      if (row.score == null) reasons.push("no health score yet");
      else if (Number(row.score) < min) reasons.push(`health ${row.score} is under ${min}`);
      if (row.spam_rate != null && Number(row.spam_rate) > maxSpam) reasons.push(`spam rate ${(Number(row.spam_rate) * 100).toFixed(1)}% is over ${(maxSpam * 100).toFixed(1)}%`);
    }
    if (reasons.length) {
      held.push({ id: l.id, mailbox, score: row?.score ?? null, reasons });
      if (row && row.warmup !== "active" && !row.blocked) acts.push({ resource: l.warmup_resource ?? "warmup", action: "start_warmup", params: { mailbox }, key: `warmup:${mailbox}:${day}` });
    } else cleared.push({ id: l.id, mailbox, score: row.score });
  }
  return {
    cleared,
    held,
    lists: { "held-senders": { add: held.map((h) => h.id), remove: cleared.map((c) => c.id) } },
    acts,
    summary: `${cleared.length} cleared to send${cleared.length ? ` (${cleared.map((c) => `${c.id} ${c.score}`).join(", ")})` : ""}; ${held.length} held${held.length ? `: ${held.map((h) => `${h.id} (${h.reasons.join("; ")})`).join(", ")}` : ""}`,
  };
}
