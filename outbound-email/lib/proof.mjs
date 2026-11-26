import { bodyHash, result } from "./email.mjs";

/**
 * Proof of send, read from the mailbox source after the agent says it sent: exactly one message to the recipient
 * with the approved body, and the agent's reported message id is that message. What the agent says is not proof.
 * The approved body is the draft the owner approved (ctx.draft), or the step's `expect` text for un-drafted sends.
 */
export default function (_d, ctx) {
  const draft = ctx.draft ?? {};
  const want = bodyHash(draft.body);
  const rows = (ctx.read_back ?? []).filter((m) => m.body_sha256 === want);
  const r = [];
  if (!draft.body) r.push("no approved draft to compare with");
  if (rows.length === 0) r.push("the sent folder has no message to this recipient with the approved body");
  if (rows.length > 1) r.push(`the approved email was sent ${rows.length} times`);
  const ids = (ctx.evidence ?? []).filter((e) => e.kind === "message_id").map((e) => String(e.value));
  if (rows.length === 1 && !ids.includes(String(rows[0].message_id))) r.push("the reported message id is not the message found in the sent folder");
  return result(r);
}
