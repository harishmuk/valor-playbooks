import { campaignOf, result } from "../../../lib/email.mjs";

/** Read from the seed inboxes by VALOR: enough of them got the sample in the inbox. */
export default function (_d, ctx) {
  const c = campaignOf(ctx.inputs);
  const rows = ctx.read_back ?? [];
  const seeds = (c.sender?.seed_inboxes ?? []).length || rows.length;
  const inbox = rows.filter((x) => x.folder === "inbox").length;
  const min = Number(c.sender?.min_inbox_share ?? 0.8);
  if (!seeds) return result(["no seed results to read"]);
  return result(inbox / seeds >= min ? [] : [`${inbox} of ${seeds} seed inboxes got it in the inbox; at least ${Math.ceil(min * seeds)} must; keep warming and retest`]);
}
