# Usability Testing

Usability testing is the practice of observing real users as they attempt real tasks with your product. No amount of expert review, heuristic evaluation, or design intuition can substitute for watching an actual person struggle — or succeed — with your interface. It is the single most important empirical method in the HCI practitioner's toolkit, and knowing how to plan, run, and analyze a usability test is a core professional skill.

## The Principle

A usability test is deceptively simple in concept: give a participant a task, watch them try to complete it, and record what happens. The depth lies in the planning, execution, and analysis decisions that determine whether the test produces actionable insights or misleading noise.

### Planning

**Task selection** is the most consequential planning decision. Tasks should be realistic, representative, and completeable within the test session. Good tasks are drawn from actual user goals: "Find a round-trip flight from Chicago to Denver for under $300" is a task; "Click the Search button" is a directive. The distinction matters because tasks reveal the user's natural strategy, while directives test only whether a single control works.

**Participant recruitment** must target the actual user population. A usability test of a medical records system with computer science students tells you almost nothing about how nurses will fare. Screening questionnaires should filter for relevant experience, domain knowledge, and demographic characteristics.

**How many participants?** Jakob Nielsen (2000) popularized the "5-user heuristic," arguing that five participants from a single user profile find approximately 80% or more of usability problems. His reasoning rests on the same mathematical model used in heuristic evaluation:

$$P(i) = 1 - (1 - \lambda)^i$$

where $\lambda$ is the probability that a single user encounters a given problem. With $\lambda = 0.31$ (a commonly cited average), five users yields $P(5) = 1 - (1 - 0.31)^5 \approx 0.84$, or 84%. Nielsen's advice is to run multiple small tests iteratively — test 5, fix, test 5 again — rather than one large test.

Spool and Schroeder (2001) challenged this number, arguing that for complex systems or heterogeneous user populations, five users may find far fewer problems. When $\lambda$ is low (problems are rare or user-specific), more participants are needed. The practical takeaway: five is a reasonable starting point for a single user profile testing common tasks, but complex products may require more.

### Think-Aloud Protocol

The think-aloud protocol, formalized by Ericsson and Simon (1993), asks participants to verbalize their thoughts as they work. There are two variants:

- **Concurrent think-aloud** — The participant speaks while performing the task. This provides a real-time window into their reasoning ("I'm looking for the settings... I thought it would be under this menu...") but can slow performance and alter behavior.
- **Retrospective think-aloud** — The participant performs the task silently, then reviews a recording and explains their thought process. This avoids interference with natural behavior but relies on memory, which is imperfect.

Most practitioners use concurrent think-aloud for qualitative insight and supplement it with quantitative metrics (time, errors, completion rate) measured in silent trials.

### Facilitator Behavior

The facilitator's discipline is critical. The golden rule: **never help the participant.** If a participant asks "Should I click here?", the correct response is "What would you do if I weren't here?" Leading questions, facial expressions of approval or concern, and premature interventions all contaminate the data. A pilot test — a dry run with a colleague — catches facilitation problems before real sessions begin.

### Remote vs. In-Person

Remote unmoderated testing (using tools like UserTesting, Maze, or Lookback) scales well — you can run 20 sessions across time zones with no scheduling friction. But moderated in-person testing yields richer data: you can ask follow-up questions, observe body language, and probe moments of confusion in real time. Use remote for breadth; use moderated for depth.

## Design Implications

- **Test early with prototypes.** Paper prototypes, wireframes, and clickable mockups are all testable. The earlier you test, the cheaper it is to fix problems. Waiting until development is complete means usability problems are discovered when they are most expensive to address.
- **Five users for a single profile.** If your product has multiple distinct user types (e.g., admin vs. end user), test 5 per profile. Do not mix profiles and assume 5 total is sufficient.
- **Write scenarios, not instructions.** "You just moved to a new city and need to find a dentist covered by your insurance" gives context and motivation. "Click Search, enter 'dentist,' click Filter, select 'In-network'" prescribes behavior and tests nothing.
- **Never help the participant.** Every time you rescue a stuck user, you erase a data point. Let them struggle — that struggle is your data.
- **Iterate: test, fix, retest.** One round of testing is informative; multiple rounds are transformative. The Nielsen Norman Group's longitudinal data shows that iterative testing and redesign improves usability metrics by an average of 165% across two iterations.
- **Remote unmoderated for scale, moderated for depth.** Use unmoderated tests to validate hypotheses across large samples. Use moderated tests to understand *why* users behave as they do.

## The Evidence

Robert Virzi (1992) conducted the study most directly relevant to test sizing. He ran usability tests with varying numbers of participants and plotted the cumulative proportion of problems discovered as a function of sample size. The resulting curve showed steep gains through 4-5 participants, with sharply diminishing returns thereafter. Five participants uncovered approximately 80% of the problems, confirming Nielsen's (2000) later heuristic.

Nielsen (2000) synthesized findings across 83 usability studies and argued for "discount usability testing" — small, fast, iterative tests that prioritize frequency over formality. His cost-benefit analysis showed that the return on investment for usability testing peaks when tests are small and frequent: three rounds of 5 users beats one round of 15 users, because each round of fixes eliminates problems that would have masked deeper issues.

Rubin and Chisnell (2008) codified best practices in *Handbook of Usability Testing*, covering task design, participant screening, facilitator training, and analysis techniques. Krug (2000) popularized usability testing for web design in *Don't Make Me Think*, arguing that even informal "hallway testing" — grabbing someone and watching them use your site for 10 minutes — yields insights that no amount of internal debate can match.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p>Virzi (1992) used data from two usability studies — one of a voice messaging system, one of a graphical telephone interface — with 20 and 24 participants respectively. He randomly sampled subsets of 1, 2, 3, ..., N participants and computed the proportion of unique problems found in each subset. By averaging across all possible subsets of each size (a resampling approach), he generated smooth curves showing cumulative problem detection as a function of sample size.</p>

<p>Key findings:</p>

<ul>
<li><strong>80% detection at 4-5 users:</strong> Both datasets converged on approximately 80% problem detection with 5 participants.</li>
<li><strong>Severe problems found first:</strong> The most severe problems (those blocking task completion) tended to have higher detection rates per user ($\lambda$ closer to 0.5), meaning they were found in the first 2-3 sessions.</li>
<li><strong>Diminishing returns:</strong> Going from 5 to 10 participants increased detection from ~80% to ~90% — a 10% gain for double the cost.</li>
</ul>

<p>Ericsson and Simon (1993) validated the think-aloud method in <em>Protocol Analysis: Verbal Reports as Data</em>, the definitive scientific treatment. They showed that concurrent verbalization of <strong>Level 1</strong> (simply vocalizing current thoughts) does not significantly alter task performance or strategy, while <strong>Level 3</strong> verbalization (explaining and justifying behavior) does slow performance and may change the cognitive process. This distinction is critical: facilitators should prompt "Keep talking" or "Tell me what you're thinking," not "Why did you do that?" during the task.</p>

<p>Brooke (1996) introduced the <strong>System Usability Scale (SUS)</strong>, a 10-item Likert questionnaire administered after usability test sessions. SUS produces a single score from 0 to 100, with 68 as the average. Sauro and Lewis (2016) showed that SUS scores are remarkably reliable (Cronbach's alpha ~0.91) and correlate with task performance metrics, making SUS the industry standard for post-test subjective assessment.</p>

</details>

## Related Studies

**Spool and Schroeder (2001)** tested the five-user heuristic on large-scale e-commerce sites and found that when user populations are heterogeneous (different experience levels, different goals), five users from a single profile may miss problems encountered by other profiles. They recommended testing with at least 2-3 representatives per distinct user segment.

**Barnum (2010)** — *Usability Testing Essentials* — provides a practitioner-focused guide to planning and running tests, with templates for test plans, screener questionnaires, task scenarios, and analysis reports. Her emphasis on actionable recommendations — not just problem lists — reflects the maturation of usability testing from academic method to industry standard.

**Sauro and Lewis (2016)** — *Quantifying the User Experience* — is the definitive reference for usability metrics. They provide formulas for computing confidence intervals on task completion rates, geometric means for task times, and standardized SUS score interpretation (a score of 80.3 corresponds to the 90th percentile).

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Lewis (1994)</strong> introduced the <strong>adjusted completion rate</strong>, which credits partial task completion rather than treating every incomplete task as a failure. For example, a user who completes 4 of 5 steps receives a score of 0.8 rather than 0. This yields more sensitive measurement and better differentiates between "almost succeeded" and "completely lost."</p>

<p><strong>Hertzum, Hansen, and Andersen (2009)</strong> conducted a meta-analysis of the think-aloud effect, examining whether verbalization alters task performance. Across 40+ studies, they found that concurrent think-aloud increases task time by approximately 15-20% but does not significantly change error rates or task completion rates. Retrospective think-aloud has no performance effect but produces less detailed protocols.</p>

<p><strong>Woolrych and Cockton (2001)</strong> compared usability testing findings against heuristic evaluation findings for the same interface. They found partial overlap: usability testing was better at revealing problems related to task flow, mental model mismatches, and unexpected user strategies, while heuristic evaluation was better at catching consistency violations and missing feedback. The two methods are complementary, not interchangeable.</p>

<p><strong>Krug (2010)</strong> updated his approach in <em>Rocket Surgery Made Easy</em>, simplifying usability testing to a one-morning-a-month cadence: recruit 3 participants, run 1-hour sessions, debrief with the team over lunch, and fix the top 3 problems before the next month's test. This "continuous testing" model has been widely adopted in agile development teams.</p>

</details>

## See Also

- [Heuristic Evaluation](../lessons/16-heuristic-evaluation.md) — heuristic evaluation complements usability testing by catching principle-based violations that users may work around without noticing
- [Data Collection & Metrics](../lessons/20-data-collection-metrics.md) — usability testing produces the raw data that metrics frameworks organize and interpret
- [Experimental Design](../lessons/19-experimental-design.md) — formal experimental design principles govern how to set up comparative usability studies

## Try It

<details>
<summary>Exercise: Plan a Usability Test</summary>

<p>You are the UX lead for a project management tool. A new "Timeline View" feature has been designed. Your task is to plan a usability test.</p>

<p><strong>Step 1 — Define tasks.</strong> Write three task scenarios (not instructions) that test the Timeline View:</p>

<ul>
<li><strong>Task 1:</strong> "Your team has a project launching on April 15. A teammate just told you the design phase will take an extra week. Update the timeline to reflect this delay and see how it affects the launch date."</li>
<li><strong>Task 2:</strong> "You just joined this project and need to understand what's happening this week. Figure out which tasks are due in the next 7 days and who is responsible for each."</li>
<li><strong>Task 3:</strong> "The client wants a PDF showing the current project schedule. Generate and download a timeline export."</li>
</ul>

<p><strong>Step 2 — Determine participant count.</strong> The tool has two user profiles: project managers (power users) and team members (casual viewers). Using the 5-user heuristic applied per profile: recruit <strong>5 project managers</strong> and <strong>5 team members</strong> = 10 participants total.</p>

<p><strong>Step 3 — Choose method.</strong> Moderated, concurrent think-aloud sessions, 45 minutes each. Moderated because the feature is new and you want to probe moments of confusion. Record screen + audio.</p>

<p><strong>Step 4 — Define success metrics:</strong></p>
<ul>
<li><strong>Completion rate:</strong> % of participants who complete each task without assistance</li>
<li><strong>Time on task:</strong> Seconds to complete each task (geometric mean across participants)</li>
<li><strong>Error count:</strong> Wrong clicks, wrong screens visited, backtracking events</li>
<li><strong>SUS score:</strong> Post-session System Usability Scale questionnaire</li>
</ul>

<p><strong>Step 5 — Predict findings.</strong> Based on the task designs, likely problem areas include: (a) difficulty discovering how to drag-extend a timeline bar (Task 1), (b) confusion about filter/date-range controls (Task 2), and (c) hidden export function requiring multiple clicks (Task 3).</p>

</details>
