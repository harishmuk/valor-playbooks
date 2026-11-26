// Code steps shared by the plays. Each play's steps/ file re-exports one of these, so a layer can swap a single file.
import { lower, onList } from "./email.mjs";

/** Loads the campaign's settings from the `campaigns` source. Every play starts with this, so checks and guards see one copy. */
export async function loadCampaign(ctx) {
  const id = ctx.inputs.campaign;
  const rows = await ctx.query("campaigns", "get", { id });
  if (!rows.length) throw new Error(`campaign "${id}" not found in the campaigns source`);
  return rows[0];
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
