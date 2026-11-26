import { result } from "../../../lib/email.mjs";

/** Read from public DNS by VALOR: SPF, DKIM, DMARC and MX all present. */
export default function (_d, ctx) {
  const rec = (ctx.read_back ?? [])[0] ?? {};
  const r = [];
  if (!/^v=spf1\b/i.test(String(rec.spf ?? ""))) r.push("no SPF record (v=spf1 ...)");
  if (rec.dkim !== true) r.push("the DKIM selector does not resolve");
  if (!/^v=DMARC1\b/i.test(String(rec.dmarc ?? ""))) r.push("no DMARC record (v=DMARC1 ...)");
  if (!Array.isArray(rec.mx) || !rec.mx.length) r.push("no MX records");
  return result(r);
}
