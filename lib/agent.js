import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { FIXED_AXES, suggest } from "./rubric.js";
import { checkQuotes } from "./verify.js";

export const MODEL = "claude-opus-5-5";
export const LIMITS = { jd: 20000, candidate: 20000 };

// baseURL is only set for local testing against a mock server.
export function makeClient(apiKey, baseURL) {
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000, ...(baseURL ? { baseURL } : {}) });
}

// One structured call. Fallbacks re-run a safety-classifier refusal on another
// model server-side, so a false positive on a CV doesn't surface as an error.
async function call(client, { system, user, schema, effort = "medium" }) {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new AgentError("The model declined this input.", 422);
  if (res.stop_reason === "max_tokens") throw new AgentError("Output ran past the token limit. Try a shorter input.", 502);
  if (!res.parsed_output) throw new AgentError("The model returned output that did not match the schema.", 502);
  return res.parsed_output;
}

export class AgentError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

const fixedAxesText = FIXED_AXES.map(
  (a) => `- ${a.name} (${a.id}): ${a.question}\n  1 = ${a.anchors[1]}\n  3 = ${a.anchors[3]}\n  5 = ${a.anchors[5]}`
).join("\n");

// ---------- 1. Rubric: job description -> must-haves ----------

const RubricSchema = z.object({
  role_title: z.string().describe("The role title as written in the job description."),
  must_haves: z
    .array(
      z.object({
        id: z.string().describe("snake_case id, e.g. production_ml"),
        name: z.string().describe("Short label, 2-5 words."),
        jd_quote: z.string().describe("The exact line from the job description this must-have comes from, copied verbatim."),
        anchor_1: z.string().describe("What a 1 looks like for this must-have."),
        anchor_3: z.string().describe("What a 3 looks like."),
        anchor_5: z.string().describe("What a 5 looks like."),
      })
    )
    .describe("Between 3 and 4 hard requirements, the ones that would sink a candidate if missing."),
});

const RUBRIC_SYSTEM = `You turn a job description into the role-specific half of a hiring rubric.

The other half is fixed and you must not repeat it:
${fixedAxesText}

Pick the 3 or 4 requirements in the job description that are genuinely must-have: the ones a hiring manager would reject a candidate for missing. Skip nice-to-haves, perks and anything already covered by the three fixed axes. Each must-have quotes the exact job-description line it comes from, copied character for character. Anchors describe observable evidence in a CV, not personality.`;

export async function buildRubric(client, { jd }) {
  const out = await call(client, { system: RUBRIC_SYSTEM, user: `<job_description>\n${jd}\n</job_description>`, schema: RubricSchema, effort: "low" });
  const mustHaves = out.must_haves.slice(0, 4).map((m) => ({
    id: m.id,
    name: m.name,
    jd_quote: m.jd_quote,
    jd_quote_verified: checkQuotes([m.jd_quote], jd)[0].verified,
    anchors: { 1: m.anchor_1, 3: m.anchor_3, 5: m.anchor_5 },
  }));
  return {
    role_title: out.role_title,
    axes: [
      ...FIXED_AXES.map((a) => ({ ...a, kind: "fixed" })),
      ...mustHaves.map((m) => ({ ...m, kind: "must_have" })),
    ],
  };
}

// ---------- 2. Screen: rubric + candidate -> scores, questions, messages ----------

const ScreenSchema = z.object({
  candidate_name: z.string().describe("Candidate name as written, or 'Candidate' if absent."),
  scores: z.array(
    z.object({
      axis_id: z.string(),
      score: z.int().min(1).max(5),
      evidence: z
        .array(z.string())
        .describe("1-3 exact quotes from the candidate text that this score rests on, copied verbatim. Empty only if there is no relevant line at all."),
      reasoning: z.string().describe("One sentence linking the quotes to the anchor."),
    })
  ),
  summary: z.string().describe("Two sentences for the hiring manager: the case for and the main doubt."),
  strongest_axis_id: z.string(),
  weakest_axis_id: z.string(),
  interview_questions: z
    .array(
      z.object({
        question: z.string(),
        axis_id: z.string(),
        listen_for: z.string().describe("What a strong answer contains, in one line."),
      })
    )
    .describe("Exactly five questions. At least three target the weakest evidenced axis."),
  advance_message: z.object({ subject: z.string(), body: z.string() }),
  decline_message: z.object({
    subject: z.string(),
    body: z.string(),
    named_strength: z.string().describe("The one real, specific strength the decline names, taken from the evidence."),
  }),
});

const SCREEN_SYSTEM = `You are a first-pass screener. A person reads your output and makes every decision.

Score the candidate 1-5 on every axis in the rubric, using the anchors. Rules:
- Every score rests on quotes copied exactly from the candidate text. Do not paraphrase, fix typos or merge lines inside a quote. Use "..." only to skip words within one line.
- Absence of evidence is not evidence of weakness, but it caps the score at 2 for that axis. Say so in the reasoning.
- Judge Communication from how the candidate writes, including their application answers, not from claims like "strong communicator".
- Score on what is written. Ignore name, gender, age, nationality, school prestige and employment gaps.
- Interview questions: five, specific to this candidate's CV, at least three probing the weakest axis. No generic questions.
- Write both an advance and a decline message, so the reviewer can pick. Both are short, warm and in plain English, signed "The Sela team". The advance message invites them to a 30-minute first call. The decline names one real, specific strength from their application, so the candidate leaves thinking well of the company. Never invent a reason for the decline or mention scores.`;

export async function screenCandidate(client, { jd, rubric, candidate }) {
  const axesText = rubric.axes
    .map((a) => `- ${a.name} (${a.id})${a.kind === "must_have" ? ` [must-have, from JD: "${a.jd_quote}"]` : ""}\n  1 = ${a.anchors[1]}\n  3 = ${a.anchors[3]}\n  5 = ${a.anchors[5]}`)
    .join("\n");
  const user = `<role>${rubric.role_title}</role>\n<rubric>\n${axesText}\n</rubric>\n<job_description>\n${jd}\n</job_description>\n<candidate>\n${candidate}\n</candidate>`;
  const out = await call(client, { system: SCREEN_SYSTEM, user, schema: ScreenSchema });

  // Keep scores in rubric order and drop any axis the rubric doesn't have.
  const byId = new Map(out.scores.map((s) => [s.axis_id, s]));
  const scores = rubric.axes.map((a) => {
    const s = byId.get(a.id);
    if (!s) return { axis_id: a.id, score: 1, evidence: [], reasoning: "Not scored by the model.", missing: true };
    return { ...s, evidence: checkQuotes(s.evidence, candidate) };
  });
  const mustHaveIds = rubric.axes.filter((a) => a.kind === "must_have").map((a) => a.id);
  const unverified = scores.reduce((n, s) => n + s.evidence.filter((e) => !e.verified).length, 0);

  return {
    candidate_name: out.candidate_name,
    scores,
    summary: out.summary,
    strongest_axis_id: out.strongest_axis_id,
    weakest_axis_id: out.weakest_axis_id,
    interview_questions: out.interview_questions.slice(0, 5),
    messages: { advance: out.advance_message, decline: out.decline_message },
    suggestion: suggest(scores, mustHaveIds),
    unverified_quotes: unverified,
  };
}

// ---------- 3. Onboarding: on "hire" ----------

const OnboardSchema = z.object({
  thirty_day_plan: z
    .array(
      z.object({
        week: z.int().min(1).max(4),
        focus: z.string(),
        outcomes: z.array(z.string()).describe("2-3 concrete, checkable outcomes for the week."),
        must_have_id: z.string().describe("The rubric must-have this week builds on, or 'ramp' for general onboarding."),
      })
    )
    .describe("Four entries, one per week."),
  access_checklist: z.array(
    z.object({
      item: z.string(),
      owner: z.string().describe("Role responsible, e.g. 'Hiring manager', 'Ops'."),
      due: z.string().describe("e.g. 'Before day 1', 'Day 1', 'Week 1'."),
    })
  ),
  first_week: z
    .array(z.object({ day: z.string(), items: z.array(z.string()) }))
    .describe("Monday to Friday."),
  welcome_message: z.string().describe("A short Slack message to the team introducing the new hire."),
});

const ONBOARD_SYSTEM = `You write the onboarding pack for a new hire at a ~25-person AI startup that builds voice agents for mortgage lenders. The office is in San Francisco, in person four days a week with Wednesdays remote.

- The 30-day plan ties each week to one of the role's must-haves, and builds on the strengths and gaps the screen found. Outcomes are concrete and checkable, not "get familiar with".
- The access checklist always covers Slack, GitHub, the agent evaluation system and call recordings, plus anything the role needs. Call recordings contain borrower data, so include the compliance step before access.
- The first week respects Wednesday as a remote day.
- The welcome message is warm, three or four sentences, and mentions one specific thing from the hire's background.
Do not invent internal tool names beyond the ones listed; describe anything else generically.`;

export async function onboard(client, { rubric, candidate, screen }) {
  const user = `<role>${rubric.role_title}</role>\n<must_haves>\n${rubric.axes
    .filter((a) => a.kind === "must_have")
    .map((a) => `- ${a.id}: ${a.name}`)
    .join("\n")}\n</must_haves>\n<screen_summary>${screen.summary}\nStrongest: ${screen.strongest_axis_id}. Weakest: ${screen.weakest_axis_id}.</screen_summary>\n<candidate>\n${candidate}\n</candidate>`;
  return call(client, { system: ONBOARD_SYSTEM, user, schema: OnboardSchema, effort: "low" });
}
