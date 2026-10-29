// Runs the in-page engine under Node. No dependencies: npm test or node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = (id) => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(script("engine") + script("roles") + script("demo"), ctx);
const { Desk: D, ROLES, DEMO } = ctx.window;

const role = (id) => ROLES.find((r) => r.id === id);
const demo = (id) => DEMO.find((a) => a.id === id);
const run = (id, cfg) => { const a = demo(id), r = role(a.role); return D.evaluate(r, cfg || D.defaults(r), a.text); };
const posting = (r) => {
  const f = new URL(`../postings/${r.posting}`, import.meta.url);
  return existsSync(f) ? readFileSync(f, "utf8") : null;
};

test("every criterion, gate and nice-to-have line is copied word for word from Ohm's posting", () => {
  for (const r of ROLES) {
    const text = posting(r);
    assert.ok(text, `postings/${r.posting} is missing: paste Ohm's ${r.title} posting there`);
    for (const line of [r.visa.src, ...r.axes.map((a) => a.src), ...r.nice.map((n) => n.src)]) {
      assert.ok(line, `${r.title}: a source line is empty`);
      assert.ok(text.includes(line), `${r.title}: not verbatim in the posting: ${line}`);
    }
  }
});

test("eight demo applicants per role, all labelled synthetic", () => {
  for (const r of ROLES) assert.equal(DEMO.filter((a) => a.role === r.id).length, 8);
  for (const a of DEMO) assert.match(a.text.split("\n")[0], /^Synthetic \d+$/);
  assert.match(html, /Demo applicants, not real people/);
});

test("the rubric sorts every demo applicant as intended", () => {
  for (const a of DEMO) assert.equal(run(a.id).decision, a.expect, `${a.id}: ${run(a.id).reason}`);
});

test("shortlist order is work trial, then screen, then pass, each by score", () => {
  for (const r of ROLES) {
    const list = D.shortlist(r, D.defaults(r), DEMO.filter((a) => a.role === r.id));
    const order = { trial: 0, screen: 1, pass: 2 };
    for (let i = 1; i < list.length; i++) {
      const [p, q] = [list[i - 1].result, list[i].result];
      assert.ok(order[p.decision] < order[q.decision] || (p.decision === q.decision && p.score >= q.score));
    }
  }
});

test("edge case: a great battery PhD with no Python evidence goes to a screen, flagged on Python", () => {
  const r = run("tv8");
  assert.ok(r.byId.tv_depth.score >= 4);
  assert.equal(r.byId.tv_data.score, 1);
  assert.equal(r.decision, "screen");
  assert.match(r.reason, /Applied data and Python \(1\/5\)/);
});

test("edge case: an AE with big deals but no technical background goes to a screen, flagged on STEM", () => {
  const r = run("ae3");
  assert.ok(r.byId.ae_close.score >= 4);
  assert.equal(r.byId.ae_tech.score, 1);
  assert.equal(r.decision, "screen");
  assert.match(r.reason, /STEM degree/);
});

test("edge case: a strong candidate who needs sponsorship fails the visa gate, quoting the line", () => {
  for (const id of ["tv4", "ae5"]) {
    const r = run(id);
    assert.equal(r.visa.status, "sponsor");
    assert.equal(r.decision, "pass");
    assert.match(r.quote.text, /sponsorship/);
    assert.ok(r.mean >= 3.5, `${id} should be strong apart from the gate`);
  }
});

test("the visa gate follows each posting: Chief of Staff doesn't require US authorisation", () => {
  const r = run("cos2");
  assert.equal(r.visa.status, "sponsor");
  assert.equal(r.decision, "trial");
  assert.equal(D.defaults(role("cos")).gates.visa, false);
});

test("edge case: a strong candidate with a thin CV goes to a screen, not a trial", () => {
  const r = run("cos3");
  assert.ok(r.score >= 4);
  assert.ok(r.thin);
  assert.equal(r.decision, "screen");
});

test("name-dropping: requirement keywords in a skills list or summary don't open the gate", () => {
  const r = run("tv5");
  assert.equal(r.byId.tv_depth.score, 2);
  assert.ok(r.byId.tv_depth.claimOnly);
  assert.equal(r.decision, "pass");
});

test("a 5 needs a concrete outcome, not just the keyword", () => {
  const tv = role("tv"), cfg = D.defaults(tv);
  const bare = D.evaluate(tv, cfg, "Synthetic 99\n\nExperience\n- Qualification, validation engineer, HALT, DVT, environmental test, reliability test");
  assert.ok(bare.byId.tv_depth.score <= 2);
  const proved = D.evaluate(tv, cfg, "Synthetic 98\n\nExperience\n- Led qualification of 4 battery packs, all released on schedule\n- Ran HALT on 30 boards, which caught 6 design flaws");
  assert.equal(proved.byId.tv_depth.score, 5);
});

test("AE closing must be six figures: many small deals don't count", () => {
  const r = run("ae4");
  assert.ok(r.byId.ae_close.score <= 2);
  assert.match(r.byId.ae_close.why, /under six figures/);
});

test("every quote is copied verbatim from the applicant's text", () => {
  for (const a of DEMO) {
    const r = run(a.id);
    for (const s of r.scores) for (const e of s.evidence) assert.ok(a.text.includes(e.text), e.text);
    if (r.quote) assert.ok(a.text.includes(r.quote.text));
    if (r.visa.line) assert.ok(a.text.includes(r.visa.line.text));
  }
});

test("visa wording: 'no sponsorship required' clears, 'needs sponsorship' fails, silence is unknown", () => {
  const v = (t) => D.visaCheck(D.parseCandidate("Synthetic 1\n" + t)).status;
  assert.equal(v("Authorized to work in the US, no sponsorship required"), "ok");
  assert.equal(v("Does not require visa sponsorship"), "ok");
  assert.equal(v("US citizen"), "ok");
  assert.equal(v("Will require H-1B sponsorship"), "sponsor");
  assert.equal(v("Would need visa sponsorship to work in the US"), "sponsor");
  assert.equal(v("Austin, TX"), "unknown");
});

test("rubric edits re-sort: bars, gates, weights and evidence terms all change the outcome", () => {
  const tv = role("tv");
  const raised = D.defaults(tv); raised.bars.trial = 4.6;
  assert.equal(run("tv2", raised).decision, "screen");
  const noVisa = D.defaults(tv); noVisa.gates.visa = false;
  assert.equal(run("tv4", noVisa).decision, "trial");
  assert.equal(run("tv3", noVisa).decision, "trial");
  const noTerms = D.defaults(tv); noTerms.axes.tv_data.terms = ["Fortran"];
  assert.notEqual(run("tv1", noTerms).decision, "trial");
  const ae = role("ae"), w = D.defaults(ae);
  const before = run("ae3", w).score; w.axes.ae_tech.weight = 0;
  assert.ok(run("ae3", w).score > before);
});

test("saved rubric edits merge over the defaults", () => {
  const tv = role("tv");
  const m = D.merge(tv, { bars: { trial: 4 }, axes: { tv_ai: { weight: 0 } } });
  assert.equal(m.bars.trial, 4);
  assert.equal(m.bars.screen, 2.8);
  assert.equal(m.axes.tv_ai.weight, 0);
  assert.deepEqual([...m.axes.tv_ai.terms], [...tv.axes.find((a) => a.id === "tv_ai").terms]);
});

test("SLAs: screen within 2 days, work trial within 5, debrief within 1", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  const dated = (role) => DEMO.filter((a) => a.role === role).map((a) => ({ ...a, moved: new Date(now - a.days * 86400000).toISOString() }));
  const tv = D.overdue(dated("tv"), now);
  assert.equal(tv[0].text, "3 applicants waiting more than 2 days for a screen");
  const ae = D.overdue(dated("ae"), now);
  assert.ok(ae.some((g) => g.text === "1 applicant waiting more than 1 day for a debrief"));
  assert.deepEqual({ ...D.SLA.Screened }, { days: 5, waiting: "a work trial" });
});

test("work-trial brief: three tasks, each naming its criterion and the 5 anchor", () => {
  for (const a of DEMO.filter((x) => x.expect !== "pass")) {
    const r = role(a.role), cfg = D.defaults(r), res = D.evaluate(r, cfg, a.text);
    const b = D.brief(r, cfg, res);
    assert.equal(b.tasks.length, 3);
    for (const t of b.tasks) {
      const ax = r.axes.find((x) => x.name === t.axis);
      assert.ok(b.text.includes(`Checks: ${ax.name}`));
      assert.ok(b.text.includes(cfg.axes[ax.id].anchors[5]));
    }
  }
  // The criterion the CV leaves least certain is tested first.
  const r = role("tv"), cfg = D.defaults(r), b = D.brief(r, cfg, run("tv8"));
  assert.equal(b.tasks[0].axis, "Applied data and Python");
});

test("onboarding: a first-two-weeks checklist per role with accounts, intros and a first customer touchpoint", () => {
  for (const r of ROLES) {
    const a = DEMO.find((x) => x.role === r.id && x.expect === "trial");
    const o = D.onboarding(r, D.defaults(r), D.evaluate(r, D.defaults(r), a.text));
    assert.ok(o.items.some((i) => /access/i.test(i.item)));
    assert.ok(o.items.some((i) => /Intro meetings/.test(i.item)));
    assert.ok(o.items.some((i) => /First customer touchpoint/.test(i.item)));
    assert.ok(o.items.every((i) => /^(Before day 1|Day \d+|Week [12])$/.test(i.when)));
  }
});
