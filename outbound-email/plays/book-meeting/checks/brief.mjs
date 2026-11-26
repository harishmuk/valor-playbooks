import { result } from "../../../lib/email.mjs";

export default function (d) {
  const r = [];
  for (const k of ["who", "why_now", "what_they_said"]) if (!String(d?.[k] ?? "").trim()) r.push(`${k} is missing`);
  if (!Array.isArray(d?.questions) || d.questions.length !== 2) r.push("give exactly two questions");
  return result(r);
}
