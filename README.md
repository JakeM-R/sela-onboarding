# Screening and onboarding agent

Takes one candidate from application to day one. Built as proof of work for Sela's first strategy & ops hire, where the year-one job is tripling headcount and automating most of recruiting with AI.

Built by Jake Makking-Robinson. A working draft, not a Sela product: no Sela logo, and all demo data is synthetic.

## What it does

1. **Input:** a job description plus one candidate's CV and application answers, pasted as text.
2. **Rubric:** Sela's three hiring values (intelligence, communication, team player, from their careers page) are fixed axes with hand-written 1/3/5 anchors (`lib/rubric.js`). The model adds 3–4 must-haves from the job description. Each must-have quotes its JD line.
3. **Screen:** scores 1–5 on every axis. Every score quotes the application lines it rests on, and each quote is checked against the pasted text (`lib/verify.js`). Any quote that can't be found is flagged in red for a human to check.
4. **Suggestion:** a fixed rule on the scores, not a model judgement. Any must-have at 2 or below suggests decline, a high mean with no weak axis suggests advance, and everything else goes to human review.
5. **Interview kit:** five questions for this candidate, at least three aimed at the weakest axis.
6. **Candidate message:** drafts both an advance and a decline. The decline names one real strength. The reviewer picks which to send.
7. **Onboarding, on "hire":** a 30-day plan tied to the must-haves, an access checklist (Slack, GitHub, the eval system, call recordings with a compliance step first), a first-week schedule with Wednesday remote, and a welcome message to the team.

Three synthetic candidates (strong, borderline, weak) are preloaded. **Run all three demo candidates** shows the whole range in one click.

## Stack

- `public/`: a static page (`index.html`) and the demo inputs (`demo.js`).
- `functions/api/{rubric,screen,onboard}.js`: Cloudflare Pages Functions. They call Claude server-side, so the key never reaches the browser.
- `lib/agent.js`: prompts, schemas (structured output via Zod) and the three agent steps. Uses `claude-opus-5-5` with server-side refusal fallbacks turned on (`fallbacks: "default"`), so a classifier false positive on a CV is re-run on another model instead of failing.
- Identical requests are cached at the edge for a week, so the demo candidates load instantly after the first run and repeat clicks cost nothing.

## Before sending the link

- [ ] **Replace `SAMPLE_JD` in `public/demo.js`** with the live text of Sela's Founding Data Scientist (or AI PM) posting from trysela.com/careers. Then set `SAMPLE_JD_IS_PLACEHOLDER = false`. The current text is a stand-in written for the demo, because the careers board couldn't be fetched from the build environment.
- [ ] Run `npm run eval` against the real JD and check that it passes.
- [ ] Deploy, open the live URL on desktop and phone, and click **Run all three** once to warm the cache.
- [ ] Set a monthly spend limit on the Anthropic API key, and a Cloudflare rate-limiting rule on `/api/*`. The endpoint is public.

## Run locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .dev.vars
npm run dev            # http://localhost:8788
npm test               # quote verification and suggestion rule, no API calls
ANTHROPIC_API_KEY=sk-ant-... npm run eval   # three demo candidates through the real model
```

`npm run eval` checks that strong > borderline > weak on mean score, that the weak candidate isn't suggested for advance, that the strong one isn't declined, and that every quote is verified. Output goes to `scripts/out/eval.json`. Set `JD_FILE=path.txt` to run it against a different JD.

## Deploy (Cloudflare Pages)

One-off from a laptop:

```bash
npx wrangler login
npx wrangler pages project create sela-hiring-agent --production-branch main
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name sela-hiring-agent
npm run deploy
```

After that, `.github/workflows/deploy.yml` runs the tests and deploys on every push to `main` once the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set. Until then it runs the tests and skips the deploy step.

## Out of scope

File upload (paste-in only), an ATS integration, storing candidates, and sending email. A person copies the message and makes every decision.
