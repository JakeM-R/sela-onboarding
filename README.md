# Candidate Screening Desk

Takes one candidate from application to day one. Built as proof of work for Sela's first strategy & ops hire, where the year-one job is tripling headcount and automating most of recruiting.

Built by Jake Makking-Robinson. A working draft, not a Sela product. All demo data is synthetic.

**One static page. No API, no server, no keys.** Everything runs in the browser, and nothing pasted into it leaves the page.

## What it does

1. **Input:** a job description plus one candidate's CV and application answers, pasted as text.
2. **Rubric:** Sela's three hiring values (intelligence, communication, team player, from their careers page) are fixed axes with 1/3/5 anchors. Must-haves come from the requirement lines in the job description. Nice-to-haves, and lines the values already cover (such as "you write clearly"), are left out and listed as such.
3. **Screen:** scores 1–5 on every axis. Every score quotes the application lines it rests on, copied verbatim. A line scores higher when it shows an action, a number and an outcome, and lower when it leans on buzzwords. Years of experience are read from date ranges and cap a must-have that asks for more.
4. **Suggestion:** a fixed rule on the scores. Any must-have at 2 or below suggests decline, a mean of 3.75+ with nothing below 3 suggests advance, and everything else goes to a person.
5. **Interview kit:** five questions, at least two aimed at the weakest axis, some built from the candidate's own lines.
6. **Reply:** drafts both an advance and a decline. The decline names one real strength from the application. The reviewer picks.
7. **Onboarding, on "hire":** a 30-day plan tied to the must-haves, an access checklist (Slack, GitHub, the eval system, and call recordings after compliance training), a first week with Wednesday remote, and a welcome message to the team.

It has two demo roles. **Founding Strategy & Operations Generalist** uses Sela's own posting, with the applicant's real profile alongside a borderline and a weak synthetic candidate. **Founding Data Scientist** uses a sample posting with three synthetic candidates (strong, borderline, weak). Each role opens already compared, so the whole range shows on first load.

## Pipeline tracker

The second tab tracks candidates per role through Applied → Screened → Interview → Offer → Hired, with Declined recorded against the stage it happened at.

- **All roles:** one row per role with counts at each stage and how many are overdue.
- **Per role:** a funnel of how many candidates reached each stage and the conversion between stages, a "needs attention" list of anyone past their stage's target (Applied 3 days, Screened 3, Interview 5, Offer 3), and the candidate list with a stage picker.
- **Add to tracker** on the screen tab sends the screened candidate into their role's pipeline with the score and suggestion. It never moves someone backwards. Candidates can also be added by hand.
- **Copy as CSV** puts the current view on the clipboard for a spreadsheet.
- It opens with a synthetic demo pipeline across three roles, with a button to clear it. Data is saved in the viewer's browser only (localStorage), so nothing is sent anywhere and each person sees their own copy.

## Files

- `public/index.html`: the whole app. The scoring engine is the `<script id="engine">` block, tracker logic is `<script id="tracker-core">`, and demo inputs are in `<script id="demo">`.
- `tests/engine.test.mjs`: runs the engine under Node (`npm test`, no dependencies). Checks the demo range, that every quote is verbatim, the question and message rules, and the onboarding pack.
- `.github/workflows/deploy.yml`: on every push to `main`, runs the tests and publishes `public/` to GitHub Pages.

## Before sending the link

- [ ] Replace the sample posting in `<script id="demo">` with the live text of Sela's Founding Data Scientist (or AI PM) posting from trysela.com/careers, and set `jdIsSample: false`. The current text is a stand-in written for the demo.
- [ ] Run `npm test`, then open the live page on desktop and phone.

## Run locally

Open `public/index.html` in a browser. That's it.
