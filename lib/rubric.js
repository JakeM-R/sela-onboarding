// The fixed half of the rubric. These three axes are Sela's stated hiring bar
// (careers page: intelligence, communication, team player). The anchors are
// written by hand, not generated, so every candidate is scored against the
// same definitions. The role's must-haves are the only part the model writes.

export const FIXED_AXES = [
  {
    id: "intelligence",
    name: "Intelligence",
    question: "Do they solve hard, ambiguous problems and learn fast?",
    anchors: {
      1: "No evidence of solving a non-routine problem. Duties listed, outcomes absent.",
      3: "Solved real problems with clear outcomes, mostly within a defined scope.",
      5: "Repeatedly took an ambiguous problem, chose the approach, and shipped a measurable result; picked up new domains quickly.",
    },
  },
  {
    id: "communication",
    name: "Communication",
    question: "Is their writing clear, specific and easy to act on?",
    anchors: {
      1: "Vague or padded. Buzzwords instead of specifics; hard to tell what they did.",
      3: "Clear and mostly specific. Some padding or unexplained jargon.",
      5: "Precise and concrete. Numbers, decisions and trade-offs stated plainly; explains technical work to non-specialists.",
    },
  },
  {
    id: "team_player",
    name: "Team player",
    question: "Do they make the people around them better?",
    anchors: {
      1: "Only solo work, or credit claimed for team outcomes with no sign of others.",
      3: "Worked well inside a team; some evidence of helping others.",
      5: "Raised the bar for others: mentored, unblocked, documented, or took unglamorous work that helped the team ship.",
    },
  },
];

// Deterministic suggestion. The model scores; it does not decide.
// A person makes the call in the UI and can override this.
export function suggest(scores, mustHaveIds) {
  const values = scores.map((s) => s.score);
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const missedMustHave = scores.some((s) => mustHaveIds.includes(s.axis_id) && s.score <= 2);
  const weakFixed = scores.some((s) => !mustHaveIds.includes(s.axis_id) && s.score <= 2);
  let decision = "human_review";
  if (missedMustHave || mean < 2.5) decision = "decline";
  else if (mean >= 3.75 && !weakFixed && values.every((v) => v >= 3)) decision = "advance";
  return { decision, mean: Math.round(mean * 100) / 100 };
}
