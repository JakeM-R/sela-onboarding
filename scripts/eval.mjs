// Runs the three synthetic demo candidates through the real agent and checks
// the ordering a reviewer would expect: strong > borderline > weak, the weak
// candidate is not suggested for advance, the strong one is not declined,
// and every quoted line is found in the candidate's text.
//
//   ANTHROPIC_API_KEY=... npm run eval
import { mkdirSync, writeFileSync } from "node:fs";
import { makeClient, buildRubric, screenCandidate } from "../lib/agent.js";
import { SAMPLE_JD, CANDIDATES } from "../public/demo.js";

const client = makeClient(process.env.ANTHROPIC_API_KEY);
const jd = process.env.JD_FILE ? (await import("node:fs")).readFileSync(process.env.JD_FILE, "utf8") : SAMPLE_JD;

const rubric = await buildRubric(client, { jd });
console.log(`Rubric: ${rubric.role_title}, ${rubric.axes.length} axes`);
for (const a of rubric.axes.filter((a) => a.kind === "must_have")) console.log(`  must-have: ${a.name}${a.jd_quote_verified ? "" : "  [JD QUOTE NOT FOUND]"}`);

const results = {};
for (const c of CANDIDATES) {
  results[c.id] = await screenCandidate(client, { jd, rubric, candidate: c.text });
  const r = results[c.id];
  console.log(`${c.label.padEnd(10)} mean ${r.suggestion.mean.toFixed(2)}  ${r.suggestion.decision.padEnd(12)}  unverified quotes: ${r.unverified_quotes}`);
}

mkdirSync("scripts/out", { recursive: true });
writeFileSync("scripts/out/eval.json", JSON.stringify({ rubric, results }, null, 2));

const checks = [
  ["strong > borderline", results.strong.suggestion.mean > results.borderline.suggestion.mean],
  ["borderline > weak", results.borderline.suggestion.mean > results.weak.suggestion.mean],
  ["weak is not advanced", results.weak.suggestion.decision !== "advance"],
  ["strong is not declined", results.strong.suggestion.decision !== "decline"],
  ["all quotes verified", Object.values(results).every((r) => r.unverified_quotes === 0)],
  ["five interview questions each", Object.values(results).every((r) => r.interview_questions.length === 5)],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
