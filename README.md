# Ohm Hiring Desk

Answers one question for each open Ohm role: of this week's applicants, who gets a work trial, and why?

Built by Jake Makking-Robinson as proof of work for Ohm's Chief of Staff role, against the line "Hiring + sourcing the best candidates, running interviews/work trials, onboarding new hires". A working draft, not an Ohm product. Every applicant is synthetic.

**One static page. No API, no server, no keys.** It's a rules engine over pasted text, not a model. Everything runs in the browser, and nothing pasted into it leaves the page.

## What it does

1. **Roles and rubrics from Ohm's own postings.** Three roles: FDE Test & Validation, Founding AE and Chief of Staff. Every criterion carries the requirement line it was drawn from, copied word for word and shown when you tap the criterion. The postings are kept in `postings/`, and a test fails if any line isn't an exact substring.
2. **Gates.** Work authorisation, where the posting asks for it, plus the posting's first requirement, which must score 3 or more. For the two "US citizen/visa only" roles, needing sponsorship fails the gate, and an applicant who doesn't state authorisation goes to a screen to confirm it. The Chief of Staff posting says "US citizenship/visa not required", so that gate starts off there.
3. **Scores, each with a quote.** Each criterion is scored 1–5 from the CV lines that match its evidence terms, and the strongest lines are quoted verbatim. A keyword in a skills list or summary scores 2 at most. A 5 needs a line with an action, a number and an outcome, backed by a second solid line. The AE closing criterion only counts deals of six figures or more.
4. **Decision.**
   - **Work trial:** clears both gates, has a weighted score of 3.8 or more, nothing under 3, at least 5 lines of evidence, and states work authorisation.
   - **Phone screen first:** scores 2.8 or more but misses one of the above.
   - **Pass:** everything else.

   Each decision comes with a one-line reason. Nice-to-haves add 0.1 each, up to 0.3.
5. **Editable rubric.** In the side drawer you can edit weights, evidence terms, the 1/3/5 anchors, both bars and both gates. The shortlist re-sorts as you type.
6. **Stages and SLAs.** Applied → Screened → Work trial → Debrief → Offer → Onboarding, plus Passed. Targets: screen within 2 days, work trial within 5, debrief within 1. Anyone over target is listed in the header ("3 applicants waiting more than 2 days for a screen").
7. **Work-trial brief.** Three tasks, chosen to cover the criteria the CV leaves least certain first, then the heaviest-weighted. Each task says which criterion it checks and what good looks like (the 5 anchor). It can be copied to the clipboard.
8. **Onboarding.** On "Offer accepted", it produces a first-two-weeks checklist for the role: accounts, intro meetings and a first customer touchpoint, plus weekly pairing on the weakest criterion.

## Demo set

There are 8 synthetic applicants per role, labelled "Demo applicants, not real people", with company names invented. They include strong, weak and edge cases, and `npm test` checks that each one sorts as intended:

- A great battery PhD applying for T&V with no Python evidence → screen, flagged on Python.
- An AE with big deals but no technical background → screen, flagged on STEM.
- A strong T&V or AE candidate who needs sponsorship → pass on the visa gate. A Chief of Staff candidate in London who needs sponsorship isn't penalised.
- A strong Chief of Staff candidate with a thin CV → screen.
- A strong engineer with no generalist breadth, applying for Chief of Staff → pass.
- A data scientist who lists T&V terms only in the skills list and summary → pass on the must-have gate.
- An SMB rep with many small inbound deals → pass (under six figures).

## Files

- `public/index.html`: the whole app.
  - `<script id="engine">`: scoring, decisions, SLAs, briefs and onboarding.
  - `<script id="roles">`: the three rubrics.
  - `<script id="demo">`: the applicants.
  - `<script id="app">`: the UI.
- `postings/`: Ohm's postings as published, the source of every quoted line.
- `tests/engine.test.mjs`: runs the engine under Node with no dependencies (`npm test`).
- `.github/workflows/deploy.yml`: on every push to `main`, runs the tests and publishes `public/` to GitHub Pages.

Rubric edits, stage moves and pasted applicants are saved in the viewer's browser only (localStorage).

## Before sending the link

- [ ] Run `npm test`, then open the live page on desktop and phone.

The last Sela version is tagged `sela-final`.
