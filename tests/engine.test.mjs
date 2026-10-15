// Runs the in-page engine under Node. No dependencies: npm test or node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = (id) => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(script("engine") + script("demo"), ctx);
const { Screen: S, DEMO } = ctx.window;

const rubric = S.buildRubric(DEMO.jd);
const run = Object.fromEntries(DEMO.candidates.map((c) => [c.id, S.screen(rubric, c.text)]));

test("rubric keeps real must-haves and skips nice-to-haves and the writing line", () => {
  const must = rubric.axes.filter((a) => a.kind === "must_have");
  assert.equal(must.length, 3);
  assert.equal(must.map((a) => a.id).join(","), "production_ml,experimentation,python_sql");
  assert.equal(must[0].years, 3);
  assert.equal(rubric.skipped.length, 2);
});

test("every quote is copied verbatim from the candidate text", () => {
  for (const c of DEMO.candidates) for (const s of run[c.id].scores) for (const e of s.evidence) assert.ok(c.text.includes(e.text), e.text);
});

test("demo range: strong advances, borderline goes to a person, weak is declined", () => {
  assert.equal(run.strong.suggestion.decision, "advance");
  assert.equal(run.borderline.suggestion.decision, "human_review");
  assert.equal(run.weak.suggestion.decision, "decline");
  assert.ok(run.strong.suggestion.mean > run.borderline.suggestion.mean);
  assert.ok(run.borderline.suggestion.mean > run.weak.suggestion.mean);
});

test("five distinct interview questions, at least two on the weakest axis", () => {
  for (const r of Object.values(run)) {
    assert.equal(r.interview_questions.length, 5);
    assert.equal(new Set(r.interview_questions.map((q) => q.question)).size, 5);
    assert.ok(r.interview_questions.filter((q) => q.axis_id === r.weakest_axis_id).length >= 2);
  }
});

test("decline names a strength and never mentions scores", () => {
  for (const r of Object.values(run)) {
    assert.ok(r.messages.decline.named_strength.length > 0);
    assert.ok(!/score|\/5|rubric/i.test(r.messages.decline.body));
  }
});

test("onboarding has four weeks, Wednesday remote and compliance before recordings", () => {
  const o = S.onboarding(run.strong.candidate, rubric.role_title, rubric.axes, run.strong.scores);
  assert.equal(o.weeks.length, 4);
  assert.ok(o.firstWeek.some((d) => /Wednesday \(remote\)/.test(d.day)));
  const items = o.checklist.map((c) => c.item);
  assert.ok(items.findIndex((i) => /compliance/i.test(i)) < items.findIndex((i) => /recordings/i.test(i)));
});

test("an unrelated pasted JD still produces must-haves", () => {
  const r = S.buildRubric(`Recruiting Operations Lead\n\nRequirements\n- 4+ years running recruiting operations at a startup\n- Experience building hiring processes and automating workflows\n- Comfortable with an ATS like Ashby or Greenhouse`);
  assert.ok(r.axes.filter((a) => a.kind === "must_have").length >= 2);
});

test("the suggestion rule", () => {
  const s = (pairs) => pairs.map(([axis_id, score]) => ({ axis_id, score }));
  assert.equal(S.suggest(s([["a", 5], ["m", 2]]), ["m"]).decision, "decline");
  assert.equal(S.suggest(s([["a", 4], ["m", 4]]), ["m"]).decision, "advance");
  assert.equal(S.suggest(s([["a", 3], ["m", 3]]), ["m"]).decision, "human_review");
});

// ---------- Tracker ----------
vm.runInContext(script("tracker-core"), ctx);
const T = ctx.window.Tracker;
const NOW = Date.parse("2026-10-15T12:00:00Z");

test("demo pipeline covers three roles and flags overdue candidates", () => {
  const items = T.demo(NOW);
  const roles = T.roles(items, NOW);
  assert.equal(roles.length, 3);
  const ds = roles.find((r) => r.role === "Founding Data Scientist");
  assert.equal(ds.inProcess, 7);
  const od = T.overdue(items, NOW).map((c) => c.name);
  assert.ok(od.includes("Jordan Okafor"));   // 6 days in Screened, target 3
  assert.ok(od.includes("Tomás Ortega"));    // 7 days in Interview, target 5
  assert.ok(!od.includes("Maya Chen"));      // 2 days in Interview
  assert.ok(!od.includes("Ben Carter"));     // hired, never overdue
});

test("funnel counts who reached each stage, including people declined later", () => {
  const f = T.funnel(T.demo(NOW).filter((c) => c.role === "Founding Data Scientist"));
  assert.equal(f.map((r) => r.reached).join(","), "9,6,4,1,0");
  assert.equal(Math.round(f[2].conversion * 100), 67);
});

test("moving to Declined remembers the stage, moving back clears it", () => {
  const c = { id: "x", name: "A", role: "R", stage: "Interview", moved: new Date(NOW - 5 * 864e5).toISOString() };
  const d = T.move(c, "Declined", NOW);
  assert.equal(d.declinedFrom, "Interview");
  assert.equal(T.daysIn(d, NOW), 0);
  assert.equal(T.move(d, "Offer", NOW).declinedFrom, undefined);
});

test("CSV escapes quotes and has a header row", () => {
  const out = T.csv([{ name: 'Ann "AJ" Lee', role: "R", stage: "Applied", moved: new Date(NOW).toISOString() }], NOW);
  assert.ok(out.startsWith('"Name","Role"'));
  assert.ok(out.includes('"Ann ""AJ"" Lee"'));
});
