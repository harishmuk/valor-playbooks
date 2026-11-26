// Shared, code-only helpers for the outbound email playbook's checks, guards and code steps.
// Nothing here calls a model or the network. Layers can override any check or guard file and still import these.
import { createHash } from "node:crypto";

/** Normalises a body the way the mailbox source is expected to before hashing: LF line ends, no trailing spaces. */
export function normalizeBody(body) {
  return String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}

/** The hash that ties an approved text to what the sent folder shows. */
export function bodyHash(body) {
  return createHash("sha256").update(normalizeBody(body)).digest("hex");
}

export const words = (text) => (String(text ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length;

export const hasLink = (text) => /(https?:\/\/|www\.)\S+/i.test(String(text ?? "")) || /\b[a-z0-9-]+\.(com|io|ai|co|net|org)\b/i.test(String(text ?? ""));

/** Unresolved merge fields such as {first_name}, {{company}} or [Name]. */
export const unresolved = (text) => String(text ?? "").match(/\{\{?[^}]*\}\}?|\[(first ?name|name|company|title)\]/gi) ?? [];

/** Every figure an email states: numbers, percentages, money, multipliers. */
export function figures(text) {
  return (String(text ?? "").match(/[$€£]?\d[\d,.:]*\s*(%|x\b|k\b|m\b|million|billion|percent|am\b|pm\b|st\b|nd\b|rd\b|th\b)?/gi) ?? [])
    .map((f) => f.trim().replace(/[.,:]+$/, ""))
    .filter((f) => /\d/.test(f));
}

/** Figures in `text` that no allowed claim backs. Years and small counts written as words are not claims. */
export function unsupportedFigures(text, claims = []) {
  const backed = new Set(claims.flatMap((c) => figures(typeof c === "string" ? c : c.text)).map(canon));
  return figures(text).filter((f) => !isIncidental(f) && !backed.has(canon(f)));
}
const canon = (f) => f.toLowerCase().replace(/[\s,]/g, "").replace("percent", "%");
// Years, single digits, ordinals ("5th") and clock times ("10am", "9:30") are not claims.
const isIncidental = (f) => /^(19|20)\d\d$/.test(f) || /^\d$/.test(f) || /\d\s*(st|nd|rd|th)$/i.test(f) || /(am|pm)$/i.test(f) || /^\d{1,2}:\d\d$/.test(f);

/** What an email may state: the allowed claims, plus the ask itself (so "a 20-minute call" is not a claim). */
export function allowedClaims(campaign) {
  return [...(campaign?.offer?.claims ?? []), ...(campaign?.offer?.ask ? [campaign.offer.ask] : [])];
}

export function bannedPhrases(text, banned = []) {
  const t = String(text ?? "").toLowerCase();
  return banned.filter((b) => t.includes(String(b).toLowerCase()));
}

export const questions = (text) => (String(text ?? "").match(/\?/g) ?? []).length;

export function lower(x) {
  return String(x ?? "").trim().toLowerCase();
}

/** Lists in the ledger are lower-cased; compare the same way. */
export function onList(list, email) {
  return !!email && list.has(lower(email));
}

/** The campaign loaded by a play's first code step, wherever a check or guard sees the task's inputs. */
export function campaignOf(inputs) {
  return inputs?.steps?.load?.output?.campaign ?? inputs?.campaign_settings ?? {};
}

/** The footer every commercial email carries: the sender's postal address and a plain way to opt out. */
export function footerProblems(body, campaign) {
  const out = [];
  const addr = campaign?.sender?.postal_address;
  const optout = campaign?.rules?.opt_out_line;
  if (!addr) out.push("campaign has no sender postal address: set sender.postal_address before sending");
  else if (!normalizeBody(body).includes(addr)) out.push("footer is missing the sender's postal address");
  if (optout && !normalizeBody(body).toLowerCase().includes(String(optout).toLowerCase())) out.push(`footer is missing the opt-out line "${optout}"`);
  return out;
}

/** A first email must not pretend to be a reply or a forward. */
export const fakeThread = (subject) => /^\s*(re|fw|fwd)\s*:/i.test(String(subject ?? ""));

/** Default opt-out rule, code only. A layer can pass its own pattern in campaign.rules.opt_out_pattern. */
export const OPT_OUT = /\b(unsubscribe|remove me|take me off|opt[ -]?out|stop (emailing|contacting|writing)|do not (contact|email)|don'?t (contact|email))\b|^\s*(no|stop)[\s.!]*$/im;
export function optOutRule(text, campaign) {
  const p = campaign?.rules?.opt_out_pattern ? new RegExp(campaign.rules.opt_out_pattern, "im") : OPT_OUT;
  return p.test(String(text ?? ""));
}

/** Checks one email against the campaign's writing rules. `position` is 0 for the first touch. */
export function emailProblems(email, campaign, position) {
  const r = campaign?.rules ?? {};
  const p = [];
  const label = position === 0 ? "email 1" : `email ${position + 1}`;
  if (!email || typeof email !== "object") return [`${label} is missing`];
  if (!String(email.body ?? "").trim()) p.push(`${label} has no body`);
  if (position === 0 && !String(email.subject ?? "").trim()) p.push(`${label} has no subject`);
  if (position === 0 && fakeThread(email.subject)) p.push(`${label} subject pretends to be a reply or forward`);
  const max = position === 0 ? r.first_max_words ?? 120 : r.followup_max_words ?? 80;
  const n = words(stripFooter(email.body, campaign));
  if (n > max) p.push(`${label} is ${n} words; the limit is ${max}`);
  if (position === 0 && r.links_in_first === false && hasLink(stripFooter(email.body, campaign))) p.push(`${label} has a link; the first email must not`);
  const maxQ = r.max_questions ?? 1;
  if (questions(stripFooter(email.body, campaign)) > maxQ) p.push(`${label} asks more than ${maxQ} question(s)`);
  for (const b of bannedPhrases(`${email.subject ?? ""}\n${email.body}`, r.banned_phrases)) p.push(`${label} uses the banned phrase "${b}"`);
  for (const f of unsupportedFigures(`${email.subject ?? ""}\n${stripFooter(email.body, campaign)}`, allowedClaims(campaign))) p.push(`${label} states "${f}", which no allowed claim backs`);
  for (const u of unresolved(`${email.subject ?? ""}\n${email.body}`)) p.push(`${label} has an unresolved merge field ${u}`);
  p.push(...footerProblems(email.body, campaign).map((x) => `${label}: ${x}`));
  return p;
}

/** The footer is not part of the word count or the link rule. */
export function stripFooter(body, campaign) {
  let b = normalizeBody(body);
  const addr = campaign?.sender?.postal_address;
  if (addr && b.includes(addr)) b = b.slice(0, b.lastIndexOf(addr));
  const optout = campaign?.rules?.opt_out_line;
  if (optout) {
    const i = b.toLowerCase().lastIndexOf(String(optout).toLowerCase());
    if (i >= 0) b = b.slice(0, i);
  }
  return b;
}

export const result = (reasons) => ({ pass: reasons.length === 0, reasons });
