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
