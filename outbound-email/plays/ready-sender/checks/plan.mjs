import { campaignOf, lower, result } from "../../../lib/email.mjs";

/** A separate domain, a mailbox on it, and every cost listed within the campaign's setup budget. */
export default function (d, ctx) {
  const c = campaignOf(ctx.inputs);
  const r = [];
  const domain = lower(d?.domain);
  const main = lower(c.sender?.primary_domain);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) r.push("domain is missing or not a domain name");
  if (main && (domain === main || domain.endsWith(`.${main}`))) r.push(`never send from the main domain ${main} or its subdomains`);
  if (!lower(d?.mailbox).endsWith(`@${domain}`)) r.push("the mailbox must be on the new domain");
  const costs = Array.isArray(d?.costs) ? d.costs : [];
  if (!costs.length) r.push("list every cost");
  for (const x of costs) if (!(typeof x.usd === "number" && x.item && x.period)) r.push(`cost entry needs item, usd and period: ${JSON.stringify(x)}`);
  const cap = c.sender?.setup_budget_usd;
  const first = costs.reduce((a, x) => a + (typeof x.usd === "number" ? x.usd : 0), 0);
  if (cap !== undefined && first > cap) r.push(`first-period cost of ${first} USD is over the setup budget of ${cap} USD`);
  return result(r);
}
