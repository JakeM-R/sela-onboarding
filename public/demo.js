// Demo inputs. All synthetic.
//
// SAMPLE_JD is a stand-in written for this demo. Before sending the link,
// replace it with the live text of Sela's Founding Data Scientist (or AI PM)
// posting from trysela.com/careers, so the demo runs on their own words.

export const SAMPLE_JD_IS_PLACEHOLDER = true;

export const SAMPLE_JD = `Founding Data Scientist

We build AI voice agents that handle borrower calls for mortgage lenders: refinance outreach, application follow-up and servicing questions. Our agents already run alongside human teams at some of the largest independent mortgage banks in the US, and every agent change is A/B tested against human performance.

What you'll do
- Own how we measure agent quality: design the evaluation system that scores calls for accuracy, compliance and borrower outcomes.
- Design and analyse A/B tests comparing agent variants against each other and against human loan officers.
- Build the data pipelines and models that turn millions of call transcripts into product decisions.
- Work directly with engineering and customers to decide what to build next.

What we're looking for
- 3+ years of hands-on data science or ML in production, shipping models or analyses that changed a product.
- Strong experimental design and statistics: you know when an A/B test result is real.
- Fluent in Python and SQL, comfortable working with messy, large-scale text or audio data.
- Experience evaluating LLMs or conversational systems is a strong plus.
- You write clearly and can explain a result to a customer as well as to an engineer.

San Francisco, in office 4 days a week (Wednesdays remote).`;

export const CANDIDATES = [
  {
    id: "strong",
    label: "Strong",
    name: "Maya Chen",
    text: `Maya Chen (synthetic candidate)

EXPERIENCE
Senior Data Scientist, Lumen Voice (contact-centre speech analytics), 2022–present
- Built the call-quality evaluation pipeline used to grade 40,000 calls a week; replaced a manual QA sample of 2% of calls.
- Designed the A/B testing framework for our LLM-based call summariser; caught a novelty effect that would have shipped a variant that lost 6% accuracy after week two.
- Trained an intent classifier on 3M transcribed calls (Python, PyTorch, BigQuery); cut misrouted calls by 18%.
- Mentored two junior analysts; wrote our internal guide to sequential testing, now required reading for new hires.

Data Scientist, Northwind Lending, 2020–2022
- Built the prepayment model used by the capital markets team to price refinance offers.
- Partnered with compliance to audit model inputs for fair-lending risk.

EDUCATION
MS Statistics, University of Washington, 2020

APPLICATION ANSWERS
Why this role? I've spent four years making voice systems measurable, and two years before that inside a lender. Your problem, proving an agent is as good as a loan officer, is the exact intersection.

Tell us about a result you got wrong. Early on I reported a 9% lift in call resolution that turned out to be a logging change. I now run an A/A test before every launch, and I told the team about the mistake the same day.`,
  },
  {
    id: "borderline",
    label: "Borderline",
    name: "Jordan Okafor",
    text: `Jordan Okafor (synthetic candidate)

EXPERIENCE
Analytics Lead, Brightpath Insurance, 2021–present
- Own the weekly claims dashboard (SQL, Looker) used by 30 people across operations.
- Ran pricing experiments on the renewal email flow with the marketing team.
- Onboarded and trained four new analysts on our SQL style guide.

Business Analyst, Brightpath Insurance, 2019–2021
- Built Excel models for quarterly planning.

PROJECTS
- Kaggle: sentiment classifier on customer reviews (top 30%), Python and scikit-learn.
- Completed a course on large language models; built a small chatbot for FAQ answers.

EDUCATION
BA Economics, UC Davis, 2019

APPLICATION ANSWERS
Why this role? I want to move from reporting into building models, and voice AI for lending looks like a big opportunity where I can learn fast.

Tell us about a result you got wrong. A dashboard double-counted claims for a month because of a join. I fixed the query and added a row-count check.`,
  },
  {
    id: "weak",
    label: "Weak",
    name: "Sam Patel",
    text: `Sam Patel (synthetic candidate)

SUMMARY
Passionate, results-driven data enthusiast and strong communicator with a proven track record of leveraging cutting-edge AI to drive synergies and deliver value.

EXPERIENCE
Data Science Intern, Various Startups, 2023–2024
- Leveraged machine learning to drive insights.
- Worked on AI projects using ChatGPT.
- Responsible for data tasks as assigned.

EDUCATION
Data Science Bootcamp, 2023

SKILLS
Python, AI, ML, Deep Learning, Big Data, Leadership, Teamwork

APPLICATION ANSWERS
Why this role? I am passionate about AI and believe I would be a great fit for your dynamic team.

Tell us about a result you got wrong. I am a perfectionist so I always double check my work.`,
  },
];
