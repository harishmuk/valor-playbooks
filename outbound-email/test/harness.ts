/**
 * Test harness for the outbound email playbook: the sample workspace in a temp folder, fixture agents that work
 * through the real agent contract, and a fake "world" (sent folder, seed inboxes, calendar) that the agents change
 * when they act and that VALOR only reads. Nothing is ever sent.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import YAML from "yaml";
import { openValor } from "@valor/open.js";
import { MemoryEventStore } from "@valor/adapters/eventstore-memory.js";
import { TrustingAuthenticator } from "@valor/engine/auth.js";
import { FixtureBinding, type Behavior, type FixtureEvent } from "@valor/agents/fixture.js";
import type { Engine } from "@valor/engine/engine.js";
import type { CorrectionDef } from "@valor/workspace/schema.js";
import { tick } from "@valor/engine/loop.js";
import { inbox } from "@valor/engine/queries.js";
import { aboutFor } from "@valor/cli/about.js";
// @ts-expect-error plain ESM helper shared with the playbook's checks
import { bodyHash } from "../lib/email.mjs";

export const PLAYBOOK = resolve(import.meta.dirname, "..");
export const MIN = 60e3;
export const HOUR = 3600e3;
export const DAY = 86400e3;

export class Clock {
  t: number;
  // Tuesday 2026-12-01, 13:00 UTC = 08:00 in New York: inside the default send window
  constructor(iso = "2026-12-01T13:00:00Z") {
    this.t = new Date(iso).getTime();
  }
  now = () => new Date(this.t);
  advance(ms: number) {
    this.t += ms;
  }
}

/** The sample workspace, copied, with its playbook layer pointed back at this playbook. */
export function sampleWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "valor-outbound-"));
  cpSync(join(PLAYBOOK, "examples", "workspace"), dir, { recursive: true });
  const cfgFile = join(dir, "valor.yaml");
  const cfg = YAML.parse(readFileSync(cfgFile, "utf8"));
  cfg.playbooks = [PLAYBOOK];
  writeFileSync(cfgFile, YAML.stringify(cfg));
  return dir;
}

/** The outside world the agents act on. VALOR reads it only through the workspace's fixture sources. */
export class World {
  constructor(public root: string) {}
  private file(name: string) {
    return join(this.root, "data", `${name}.json`);
  }
  read(name: string): Record<string, any[]> {
    return JSON.parse(readFileSync(this.file(name), "utf8"));
  }
  add(name: string, query: string, row: Record<string, unknown>) {
    const d = this.read(name);
    (d[query] ??= []).push(row);
    writeFileSync(this.file(name), JSON.stringify(d, null, 2));
  }
  sent(to?: string) {
    return (this.read("mailbox").sent ?? []).filter((r: any) => !to || r.to === to);
  }
}

let n = 0;
const nextId = (p: string) => `${p}-${++n}`;

export interface AgentScript {
  /** returns the deliverable (and optionally a pointer) for a task, by step id */
  work?: (ev: FixtureEvent) => { deliverable?: unknown; pointer?: { system: string; id: string }; evidence?: { kind: string; value: string }[] } | undefined;
  /** what a peer review says */
  review?: (ev: FixtureEvent) => { verdict: "pass" | "rework" | "reject"; reasons: string[] };
  /** acts in the world after a go-ahead, returning the pointer and evidence it reports */
  act?: (ev: Extract<FixtureEvent, { kind: "go" }>) => { pointer?: { system: string; id: string }; evidence: { kind: string; value: string }[] };
}

export function scripted(s: AgentScript): Behavior {
  return async (ev, eng) => {
    const { task, agent } = ev.ctx;
    if (ev.kind === "wake" || ev.kind === "answer") {
      await eng.claim(agent.id, task.id);
      if (task.review_of) {
        const v = s.review?.(ev) ?? { verdict: "pass", reasons: [] };
        await eng.submit(agent.id, task.id, { summary: `Review: ${v.verdict}`, deliverable: v, evidence: [], cost_usd: 0.01 });
        return;
      }
      const w = s.work?.(ev);
      if (!w) return;
      await eng.submit(agent.id, task.id, { summary: `Done by ${agent.id}.`, deliverable: w.deliverable, pointer: w.pointer, evidence: w.evidence ?? [{ kind: "link", value: `https://example.test/work/${task.id}` }], cost_usd: 0.05 });
    }
    if (ev.kind === "go" && s.act) {
      const a = s.act(ev);
      const at = new Date(eng.now().getTime() + 1).toISOString();
      await eng.submit(agent.id, task.id, {
        summary: `Acted: ${ev.go.action}`,
        pointer: a.pointer,
        evidence: a.evidence.map((e, i) => (i === 0 ? { ...e, idempotency_key: ev.go.key, acted_at: at } : e)),
        cost_usd: 0.01,
      });
    }
  };
}

const steps = (ev: FixtureEvent) => (ev.ctx.task.inputs as any).steps ?? {};
const campaign = (ev: FixtureEvent) => steps(ev).load?.output?.campaign;

/** A research agent that does every research-type task in the playbook well. */
export function researcher(over: { research?: (ev: FixtureEvent) => unknown; triage?: (text: string) => Record<string, unknown> } = {}): AgentScript {
  return {
    work(ev) {
      const t = ev.ctx.task;
      const inp = t.inputs as any;
      switch (t.step_id) {
        case "qualify": {
          const cands = steps(ev).pull.output.candidates as any[];
          const byCo = new Map<string, any[]>();
          for (const c of cands) byCo.set(c.company, [...(byCo.get(c.company) ?? []), c]);
          const companies = [...byCo.entries()].map(([company, ppl], i) => {
            const pick = ppl.find((p) => /founder|ceo|partner/i.test(p.title)) ?? ppl[0];
            return { company, verdict: "qualified", reason: "Independent agency in the size band.", source_url: `https://${pick.email.split("@")[1]}/about`, segment: i % 2 ? "design" : "marketing", fit: 0.9 - i * 0.1, people: [{ email: pick.email, name: pick.name, title: pick.title, tz: pick.tz, why: "Runs the business." }] };
          });
          return { deliverable: { id: `Q-${t.id}`, companies } };
        }
        case "research":
          return {
            deliverable: over.research?.(ev) ?? {
              id: `R-${inp.email}`,
              verdict: "qualified",
              role_confirmed: { source_url: "https://example.test/team", source_date: "2026-10-01" },
              hook: { fact: `${inp.company} opened a second studio in October.`, source_url: "https://example.test/news/second-studio", source_date: "2026-10-12", quote: `${inp.company} opens a second studio.` },
              pain_points: ["late-close"],
            },
          };
        case "triage":
          return { deliverable: { id: `RP-${inp.event.message_id}`, ...(over.triage ?? defaultTriage)(String(inp.event.text)) } };
        case "prep":
          return { deliverable: { id: `MB-${t.id}`, who: "Founder of a 40-person agency.", why_now: "Opened a second studio.", what_they_said: "\"Happy to talk.\"", questions: ["How do you close the month today?", "Who owns cash forecasting?"] } };
      }
      return undefined;
    },
  };
}

export function defaultTriage(text: string): Record<string, unknown> {
  const quote = text.split("\n").find((l) => l.trim()) ?? text;
  if (/remove me|unsubscribe/i.test(text)) return { label: "opted_out", quote };
  const time = /(\d{4}-\d\d-\d\dT[\d:]+(Z|[+-]\d\d:\d\d))/.exec(text);
  if (time) return { label: "meeting_time", quote, meeting_time: time[1] };
  const ref = /talk to (\w+) at ([\w.@-]+@[\w.-]+)/i.exec(text);
  if (ref) return { label: "referral", quote, referral: { name: ref[1], email: ref[2], company: "Referral Co" } };
  if (/interested|tell me more|sounds good/i.test(text)) return { label: "interested", quote };
  return { label: "other", quote };
}

/** A writer that follows the campaign's rules. */
export function writer(over: { sequence?: (ev: FixtureEvent) => unknown } = {}): AgentScript {
  return {
    work(ev) {
      const t = ev.ctx.task;
      const c = campaign(ev);
      const inp = t.inputs as any;
      const foot = `\n\n${c.sender.postal_address}\n${c.rules.opt_out_line}`;
      if (t.step_id === "write") {
        const r = steps(ev).research.output;
        return {
          deliverable: over.sequence?.(ev) ?? {
            id: `S-${inp.email}`,
            based_on_research: r.id,
            emails: [
              { subject: "Second studio, same month-end?", body: `Hi ${inp.name},\n\nCongrats on the second studio. Two locations usually means the books close later and cash is harder to see.\n\nWe close the books for agencies by the 5th business day of each month, for one flat monthly fee.\n\nOpen to a 20-minute call next month?\n\n${c.sender.name}${foot}` },
              { subject: "Re: Second studio, same month-end?", body: `${inp.name}, to make it concrete: clients cut month-end time by 40% on average in their first quarter. Worth a call?\n\n${c.sender.name}${foot}` },
              { subject: "Re: Second studio, same month-end?", body: `${inp.name}, I'll leave it here. If month-end gets tight this year, reply and I'll show you how it would run for you.\n\n${c.sender.name}${foot}` },
            ],
          },
        };
      }
      if (t.step_id === "respond")
        return { deliverable: { id: `RS-${inp.event.message_id}`, subject: `Re: ${inp.event.subject}`, body: `Thanks ${inp.email.split("@")[0]}. Glad it is useful. Would Tuesday or Thursday next week at 10am your time work for 20 minutes?\n\n${c.sender.name}${foot}` } };
      return undefined;
    },
  };
}

/** A sender that copies approved text exactly, and after the go-ahead writes it into the fake sent folder. */
export function sender(world: World, eng: () => Engine, over: { tamper?: (body: string) => string; sendTwice?: boolean } = {}): AgentScript {
  const draftOf = (ev: FixtureEvent): any => {
    const t = ev.ctx.task;
    const inp = t.inputs as any;
    const st = steps(ev);
    const m = /^send-(\d)$/.exec(String(t.step_id));
    if (m) {
      const e = st.write.output.emails[Number(m[1]) - 1];
      return { to: inp.email, subject: e.subject, body: over.tamper ? over.tamper(e.body) : e.body, sequence: m[1] === "1" ? st.write.output.emails : undefined };
    }
    if (t.step_id === "send-response") return { to: inp.event.from, subject: st.respond.output.subject, body: st.respond.output.body };
    return undefined;
  };
  return {
    work(ev) {
      const t = ev.ctx.task;
      const inp = t.inputs as any;
      const c = campaign(ev);
      switch (t.step_id) {
        case "buy":
          return { deliverable: { id: "plan-1", domain: "northwindledger-mail.test", mailbox: c.sender.mailbox, costs: [{ item: "domain", usd: 12, period: "year" }, { item: "mailbox", usd: 14, period: "month" }, { item: "warmup", usd: 29, period: "month" }] } };
        case "authenticate":
          return { pointer: { system: "dns", id: steps(ev).buy.output.domain }, evidence: [{ kind: "dns", value: "records published" }] };
        case "seed-test": {
          const subject = `seed ${t.id}`;
          for (const [i, s] of c.sender.seed_inboxes.entries()) world.add("seeds", "placement", { subject, seed: s, folder: i === 0 ? "spam" : "inbox" });
          return { pointer: { system: "seeds", id: subject, subject } as any, evidence: [{ kind: "message_id", value: `<${subject}@example.test>` }] };
        }
        case "book":
          return { deliverable: { start: inp.meeting_time, minutes: 30, attendees: [inp.email], video: "https://meet.example.test/abc" } };
      }
      const d = draftOf(ev);
      return d ? { deliverable: d, evidence: [{ kind: "record", value: `draft of ${t.step_id}` }] } : undefined;
    },
    act(ev) {
      const t = ev.ctx.task;
      const inp = t.inputs as any;
      if (t.step_id === "buy") return { evidence: [{ kind: "order_id", value: "ORD-1001" }] };
      if (t.step_id === "book") {
        const id = nextId("EV");
        world.add("calendar", "event", { id, start: inp.meeting_time, attendees: [inp.email, "alex@northwindledger-mail.test"], status: "confirmed" });
        return { pointer: { system: "calendar", id }, evidence: [{ kind: "event_id", value: id }] };
      }
      const d = draftOf(ev);
      const copies = over.sendTwice ? 2 : 1;
      let id = "";
      for (let i = 0; i < copies; i++) {
        id = nextId("MSG");
        world.add("mailbox", "sent", { message_id: id, to: d.to, subject: d.subject, body_sha256: bodyHash(d.body), sent_at: eng().now().toISOString() });
      }
      return { pointer: { system: "mailbox", id }, evidence: [{ kind: "message_id", value: id }] };
    },
  };
}

export async function setup(scripts: Record<string, AgentScript>, opts: { clock?: Clock; root?: string } = {}) {
  const root = opts.root ?? sampleWorkspace();
  const clock = opts.clock ?? new Clock();
  let engRef!: Engine;
  const behaviors = Object.fromEntries(Object.entries(scripts).map(([k, v]) => [k, scripted(v)]));
  const fixture = new FixtureBinding(() => engRef, behaviors);
  const { eng, issues } = await openValor(root, { store: new MemoryEventStore(clock.now), now: clock.now, auth: new TrustingAuthenticator(), bindings: { fixture } });
  engRef = eng;
  const correct = async (id: string, verdict: CorrectionDef["verdict"], extra: Partial<CorrectionDef> = {}) => {
    const s = await eng.state();
    const c = eng.writeCorrection({ about: extra.about ?? aboutFor(s, id), verdict, author: "owner", authenticated_by: { method: "local-cli" }, surface: "cli", reach: "item", reason_tags: [], except: [], ...extra });
    await settle();
    return c.id;
  };
  const open = async () => inbox(await eng.state(), eng.ws, eng.now());
  /** approves every open approval and batch, the way an owner clearing the inbox would */
  const approveAll = async (filter: (e: any) => boolean = () => true) => {
    for (const e of await open()) if ((e.kind === "approval" || e.kind === "batch") && filter(e)) await correct(e.id, "approve");
  };
  const standing = (play: string, step: string, standing_id: string) =>
    correct("", "approve", { about: { kind: "play", id: play }, reach: "standing", covers: { play, step, standing_id, limits: {} } } as any);
  /** ticks until nothing more happens at this instant (work started in one tick is picked up by the next) */
  const settle = async (max = 12) => {
    for (let i = 0; i < max; i++) {
      const before = (await eng.state()).events.length;
      await tick(eng);
      if ((await eng.state()).events.length === before) return;
    }
  };
  const run = async (ms: number, every = HOUR) => {
    for (let t = 0; t < ms; t += every) {
      clock.advance(Math.min(every, ms - t));
      await settle();
    }
  };
  return { root, clock, eng, issues, fixture, correct, open, approveAll, standing, run, settle, tick: () => tick(eng), world: new World(root) };
}
