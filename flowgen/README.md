# Onboarding Desk (FlowGen Labs)

Add a new hire, get their first 30 days with every task owned and dated, and see who's holding up which hire. Built as proof of work for FlowGen Labs' Chief of Staff, Founder's Office role. It answers two lines from that posting: "Build practical systems and use AI tools to automate repetitive work" and "fix the onboarding spreadsheet in the afternoon".

Built by Jake Makking-Robinson. This is a working draft, not a FlowGen product. Every hire, owner and customer is generic (Hire A–C, Owner A–E, Company A–C).

**One static page.** No backend, no API keys, no accounts and no model calls. Everything runs in the browser.

## What it does

- **Board (default view):** three demo hires with overlapping starts, about 6, 13 and 20 days out, counted from today so the demo never goes stale. Each column shows how many of the hire's tasks are done and the next three due. Above the columns, a **Blocked** strip ranks owners by how many hires their overdue tasks hold up, and drafts a nudge with one line per task naming the hire and their start date. Ticking a task updates everything straight away.
- **Add a hire:** pick a role (FlowGen's 11 open roles, or Other), a start date, a manager and an optional deployment to shadow. The 30-day plan is generated from the role playbook, grouped into Before day 1, Week 1, Weeks 2–4 and Day 30, and can be added to the board.
- **Ask:** questions a new hire would ask, answered from a 12-entry demo handbook using TF-IDF retrieval with a fixed threshold (0.35). Below the threshold it doesn't guess. It routes the question to the owner of the closest entry and drafts the message to them. One confident answer and one escalation are pre-loaded.
- **How it works:** the playbooks and the handbook, as editable JSON, plus the source quote behind every role-specific task.

## Rules

- Due date = start date + the task's day offset. A due date that falls on a weekend moves to the Friday before. So do the demo hires' start dates.
- **Overdue:** the due date has passed and the task isn't ticked. **At risk:** the task is due within 2 days and not ticked.
- A role gets the common tasks, then its family's tasks (deployment or sales), then its own. A `manager` task goes to whichever manager was picked for that hire.

## Sources

- The role-specific tasks quote FlowGen's own Ashby postings, all published 25 Oct 2026: Forward Deployed Engineer, SAP Technical Lead, SAP Functional Consultant, and Founding and Strategic Account Executive (these two postings are identical). Every quote was checked verbatim against the posting text when this was built.
- The security training default quotes flowgenlabs.com: "SOC 1 and SOC 2 certified with continuous monitoring."
- The other common tasks are generic defaults, and the page labels them that way.
- The visual style is read from flowgenlabs.com: near-black `#0E1113` background, `#15181C` panels, cream `#F9F5EA` text, green `#3EE89A` accent, Inter and IBM Plex Mono. Newsreader Light stands in for Tiempos Headline, which is licensed. The overdue red is an added colour.

## Hostile founder review (5 Nov 2026)

- **5-second test, desktop (1440×900):** passes. The headline, three steps, the verdict sentence ("3 hires start in the next 20 days. 2 have overdue tasks, and Owner A is holding up both."), the ranked owners and the drafted nudge are all visible without a click.
- **5-second test, phone (390px):** passes once the step detail lines are hidden at phone width. The verdict and the owner ranking are on the first screen. There's no horizontal scroll on any tab.
- **First 10 seconds:** the likely objection is "we have Rippling for this". The page leads with coordination across people (who is blocking which hire), not HR admin, which is the part an HRIS doesn't draft for you.
- **Judges their business?** No. Nothing claims how FlowGen onboards today. Common tasks are labelled as defaults, and role tasks cite their posting line.
- **Would they reopen it?** Only during a hiring push with several starts at once. That's the case it's built for, and the honest limit.
- **Numbers and labels:** dates are tested against 18 different "todays", including a DST change and every weekday. The Ask tab is labelled as keyword retrieval, not AI.
- **Fixed during review:** weekend due dates, a three-line headline, duplicated overdue labels, the singular verdict wording, and the phone fold.

## Files

- `public/index.html`: the whole app. `<script id="config">` holds the playbooks and handbook, `<script id="demo">` the demo hires, and `<script id="engine">` the pure logic (plans, states, ranking, nudges, retrieval).
- `tests/engine.test.mjs`: runs the engine under Node with no dependencies (`npm test`).
- `.github/workflows/deploy.yml`: runs the tests on every push to `main`, then publishes `public/` to GitHub Pages. It only runs once this folder is the root of its own repository.

## Run locally

Open `public/index.html` in a browser.
