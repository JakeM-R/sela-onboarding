// Runs the in-page engine under Node. No dependencies: npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = (id) => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(script("config") + script("demo") + script("engine"), ctx);
const { Engine: E, DEFAULT_CONFIG: CFG, DEFAULT_HANDBOOK: HB, DEMO_HIRES, ASK_PRELOAD } = ctx;

const seed = () => Object.fromEntries(DEMO_HIRES.map((h) => [h.id, Object.fromEntries(h.done.map((d) => [d, true]))]));
// Run against every day of a fortnight (so every weekday lands on a weekend start once) plus a DST change.
const TODAYS = ["2026-11-05", "2026-03-08", "2027-01-01", "2026-06-30"].map((s) => E.parseISO(s));
const FORTNIGHT = Array.from({ length: 14 }, (_, i) => E.addDays(E.parseISO("2026-11-01"), i));

for (const today of [...TODAYS, ...FORTNIGHT]) {
  test(`demo board on ${E.iso(today)}: an overdue task, and one owner holding up two hires`, () => {
    const cols = E.board(CFG, DEMO_HIRES, seed(), today);
    cols.forEach((c, i) => assert.ok(c.daysToStart <= [6, 13, 20][i] && c.daysToStart >= [6, 13, 20][i] - 2));
    for (const c of cols) for (const d of [c.start, ...c.tasks.map((t) => t.due)]) assert.ok(d.getDay() !== 0 && d.getDay() !== 6, "weekday only");
    assert.ok(cols.some((c) => c.overdue.length > 0));
    const owners = E.blocked(cols);
    assert.equal(owners[0].owner, "Owner A");
    assert.deepEqual([...owners[0].hires], ["Hire A", "Hire B"]);
    assert.ok(owners.every((o, i) => i === 0 || o.hires.length <= owners[i - 1].hires.length));
    assert.match(E.summary(cols, owners), /Owner A is holding up both/);
  });
}

test("nudge has one line per task naming the hire and start date", () => {
  const today = TODAYS[0];
  const owners = E.blocked(E.board(CFG, DEMO_HIRES, seed(), today));
  const msg = E.nudge(owners[0], CFG.rules.atRiskDays);
  const lines = msg.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(lines.length, owners[0].overdue.length + owners[0].atRisk.length);
  for (const l of lines) assert.match(l, /for Hire [A-C] \(.+, starts .+\): due /);
  assert.ok(!/—/.test(msg), "no em dashes in drafted copy");
});

test("ticking a task updates readiness and clears the flag", () => {
  const today = TODAYS[0];
  const done = seed();
  const before = E.board(CFG, DEMO_HIRES, done, today).find((c) => c.hire.id === "demo-b");
  done["demo-b"]["laptop-ordered"] = true;
  const after = E.board(CFG, DEMO_HIRES, done, today).find((c) => c.hire.id === "demo-b");
  assert.equal(after.done, before.done + 1);
  assert.equal(after.overdue.length, before.overdue.length - 1);
  assert.deepEqual([...E.blocked(E.board(CFG, DEMO_HIRES, done, today))[0].hires], ["Hire A"]);
});

test("verdict reads correctly when one owner holds up one hire", () => {
  const today = TODAYS[0];
  const done = seed();
  done["demo-b"]["laptop-ordered"] = true;
  const cols = E.board(CFG, DEMO_HIRES, done, today);
  assert.match(E.summary(cols, E.blocked(cols)), /^3 hires start in the next \d+ days\. 1 has overdue tasks, most of them with Owner B\.$/);
});

test("task states: overdue, at risk within the window, not started beyond it", () => {
  const today = TODAYS[0];
  const t = (n) => ({ due: E.addDays(today, n) });
  assert.equal(E.status(t(-1), false, today, 2), "overdue");
  assert.equal(E.status(t(0), false, today, 2), "at_risk");
  assert.equal(E.status(t(2), false, today, 2), "at_risk");
  assert.equal(E.status(t(3), false, today, 2), "not_started");
  assert.equal(E.status(t(-5), true, today, 2), "done");
});

test("plan dates are start date plus the playbook offset, grouped into the four phases", () => {
  const hire = { id: "x", name: "Hire D", role: "SAP Functional Consultant", start: "2026-12-07", manager: "Owner D", deployment: "Company C" };
  const plan = E.buildPlan(CFG, hire, TODAYS[0]);
  const laptop = plan.find((t) => t.id === "laptop-shipped");
  assert.equal(E.iso(laptop.due), "2026-12-02");
  assert.equal(laptop.owner, "Owner A");
  assert.equal(plan.find((t) => t.id === "buddy").owner, "Owner D", "manager resolves to the chosen manager");
  assert.match(plan.find((t) => t.id === "shadow").task, /Company C/);
  assert.deepEqual([...new Set(plan.map((t) => t.phase))], ["before", "week1", "weeks2_4", "day30"]);
  const other = E.buildPlan(CFG, { ...hire, role: "Other" }, TODAYS[0]);
  assert.equal(other.length, CFG.common.length);
});

test("every role-specific task carries a source quote and link", () => {
  const roleTasks = [...Object.values(CFG.families).flatMap((f) => f.tasks), ...Object.values(CFG.roles).flatMap((r) => r.tasks)];
  for (const t of roleTasks) {
    assert.ok(t.source && t.source.quote && t.source.url.startsWith("https://"), t.task);
  }
  assert.ok(CFG.common.find((t) => t.id === "security-training").source.quote.includes("SOC 1 and SOC 2"));
});

test("Ask: the two pre-loaded questions land as one answer and one escalation", () => {
  const index = E.buildIndex(HB.entries);
  const [sure, unsure] = ASK_PRELOAD.map((q) => E.ask(index, q, HB.threshold));
  assert.equal(sure.confident, true);
  assert.equal(sure.top.entry.id, "sandbox");
  assert.equal(unsure.confident, false);
  const x = E.escalation(CFG, unsure);
  assert.equal(x.entry.id, "laptop");
  assert.equal(x.owner, "Owner A");
});

test("Ask: common questions answer from the right entry, with margin over the threshold", () => {
  const index = E.buildIndex(HB.entries);
  const cases = { "When is security training due?": "security", "When does my laptop arrive?": "laptop", "Which deployment do I shadow?": "shadow", "when do I get slack": "accounts", "who do I pair with": "pairing" };
  for (const [q, id] of Object.entries(cases)) {
    const r = E.ask(index, q, HB.threshold);
    assert.equal(r.top.entry.id, id, q);
    assert.ok(r.top.score >= HB.threshold + 0.05, `${q}: ${r.top.score}`);
  }
  const none = E.ask(index, "What is the parental leave policy?", HB.threshold);
  assert.equal(none.confident, false);
  assert.equal(E.escalation(CFG, none).owner, "Owner A");
  assert.equal(HB.entries.length, 12);
});

test("no real customer, person or invented company names on the page", () => {
  for (const name of ["Veritiv", "Pacific", "Korn Ferry", "Permian"]) assert.ok(!html.includes(name), name);
  const companies = new Set(html.match(/Company [A-Z]\b/g));
  assert.deepEqual([...companies].sort(), ["Company A", "Company B", "Company C"]);
});
