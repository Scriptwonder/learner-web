# Heuristic Evaluation

Heuristic evaluation is a discount usability inspection method in which a small group of evaluators independently judge an interface against a set of recognized usability principles. It is the single most cost-effective way to find usability problems before a product reaches real users — and understanding its strengths, its limits, and the "evaluator effect" is essential for anyone who designs or reviews interfaces.

## The Principle

In 1990, Jakob Nielsen and Rolf Molich introduced heuristic evaluation as a structured alternative to expensive laboratory usability testing. The core idea is simple: trained evaluators walk through an interface, comparing each element and interaction against a checklist of broad usability principles — heuristics. Each violation is recorded, categorized, and rated for severity.

Nielsen refined the method across several publications, culminating in his widely adopted set of **10 usability heuristics** (1994):

1. **Visibility of system status** — The system should always keep users informed about what is going on, through appropriate feedback within reasonable time.
2. **Match between system and the real world** — The system should speak the user's language, using words, phrases, and concepts familiar to the user rather than system-oriented jargon.
3. **User control and freedom** — Users often choose system functions by mistake and need a clearly marked "emergency exit" to leave the unwanted state without an extended dialogue. Support undo and redo.
4. **Consistency and standards** — Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform conventions.
5. **Error prevention** — Even better than good error messages is a careful design that prevents a problem from occurring in the first place.
6. **Recognition rather than recall** — Minimize the user's memory load by making objects, actions, and options visible. Instructions should be visible or easily retrievable.
7. **Flexibility and efficiency of use** — Accelerators — unseen by the novice user — may often speed up the interaction for the expert user. Allow users to tailor frequent actions.
8. **Aesthetic and minimalist design** — Dialogues should not contain information that is irrelevant or rarely needed. Every extra unit of information competes with the relevant units and diminishes their relative visibility.
9. **Help users recognize, diagnose, and recover from errors** — Error messages should be expressed in plain language (no codes), precisely indicate the problem, and constructively suggest a solution.
10. **Help and documentation** — Even though it is better if the system can be used without documentation, it may be necessary to provide help and documentation. Such information should be easy to search, focused on the user's task, list concrete steps, and not be too large.

### The Evaluator Effect

A single evaluator typically finds only about **35%** of the usability problems in an interface. Different evaluators find different problems — their individual expertise, cognitive style, and domain knowledge shape what they notice. Nielsen's aggregation data showed that **five evaluators** working independently find approximately **75%** of all problems, following a curve of diminishing returns:

$$P(i) = 1 - (1 - \lambda)^i$$

where $P(i)$ is the proportion of problems found by $i$ evaluators and $\lambda$ is the average detection probability per evaluator (typically around 0.35 for "regular" evaluators, higher for usability specialists).

### Severity Ratings

Not all usability problems are equal. Nielsen proposed a five-point severity scale that evaluators assign independently:

| Rating | Label | Description |
|---|---|---|
| 0 | Not a problem | Does not affect usability |
| 1 | Cosmetic | Fix only if extra time is available |
| 2 | Minor | Low priority; causes minor delay |
| 3 | Major | High priority; causes significant difficulty |
| 4 | Catastrophe | Imperative to fix; users cannot complete task |

Severity is the product of three factors: **frequency** (how often does the problem occur?), **impact** (how difficult is it to overcome?), and **persistence** (is it a one-time problem or does it recur?). Independent severity ratings from multiple evaluators are averaged to produce a consensus score.

## Design Implications

- **Use 3-5 evaluators.** Fewer than three misses too many problems; more than five provides diminishing returns relative to cost. The sweet spot maximizes coverage per dollar.
- **Evaluate independently, then aggregate.** If evaluators discuss problems during inspection, they converge on the same subset and the evaluator effect — finding diverse problems — is lost. Merge findings only after each evaluator has submitted their report.
- **Use severity ratings to prioritize.** Not every violation needs to be fixed immediately. Severity ratings let the team triage: fix all 4s before launch, schedule 3s for the next sprint, backlog the 1s and 2s.
- **Combine with user testing for full coverage.** Heuristic evaluation excels at catching inconsistencies, missing feedback, and jargon — problems that violate known principles. But it cannot reveal problems rooted in users' real-world context, mental models, or task strategies. Pairing heuristic evaluation with even a small usability test closes this gap.
- **Provide evaluators with task scenarios.** Without scenarios, evaluators may inspect screens superficially. Giving them realistic tasks (e.g., "You want to cancel an order placed yesterday") forces them through the actual interaction paths where problems cluster.

## The Evidence

Nielsen and Molich (1990) conducted the foundational comparison of usability inspection methods. They asked evaluators of varying expertise to inspect a voice-response system and a computer system, recording every usability problem they identified. They found that individual evaluators detected between 20% and 51% of known problems, with an average around 35%. Crucially, the overlap between any two evaluators was modest — different people found different things — which meant aggregating results from multiple evaluators dramatically increased coverage.

Jeffries, Miller, Wharton, and Uyeda (1991) confirmed and extended these findings in a comparative study that pitted heuristic evaluation against usability testing, cognitive walkthroughs, and guidelines review. Heuristic evaluation found the most problems per dollar invested, though usability testing found more severe problems on average. The conclusion was not that one method should replace the other, but that heuristic evaluation is the best starting point — a first pass that eliminates the obvious problems before more expensive methods are deployed.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p>Nielsen and Molich's (1990) study used a within-subjects design in which 77 students evaluated a voice-response system. Each evaluator spent 1-2 hours inspecting the system against a preliminary set of heuristics, then submitted a written report. The experimenters compiled a master list of 249 usability problems from all reports combined and calculated each evaluator's detection rate against this master list.</p>

<p>Key methodological details:</p>

<ul>
<li><strong>Independence:</strong> Evaluators worked alone, without access to others' findings. This was essential for measuring the evaluator effect — the degree to which different people find different problems.</li>
<li><strong>Expertise:</strong> Nielsen later (1992) showed that "double experts" — people with both usability expertise and domain knowledge — found significantly more problems (~60%) than novice evaluators (~22%). Regular usability specialists fell in between (~35%).</li>
<li><strong>Problem classification:</strong> Two researchers independently classified each problem against the heuristics. Inter-rater reliability was moderate, reflecting the inherent ambiguity of mapping problems to heuristics (a single problem sometimes violates multiple heuristics).</li>
</ul>

<p>Jeffries et al. (1991) used four teams, each applying a different method to the same system. The heuristic evaluation team of four evaluators found 105 problems, compared to 31 for usability testing, 35 for cognitive walkthrough, and 35 for guidelines review. However, usability testing found a higher proportion of <strong>severe</strong> problems — ones that actually blocked task completion — because real users encountered real breakdowns. This complementarity is the strongest argument for using both methods.</p>

<p>Nielsen (1994) published the refined set of 10 heuristics, derived from a factor analysis of 249 usability problems across 11 studies. The original 1990 list had nine somewhat overlapping principles; the 1994 revision produced more orthogonal categories that evaluators found easier to apply consistently.</p>

</details>

## Related Studies

**Nielsen (1994)** introduced the severity rating scale and demonstrated that averaging independent severity ratings from 3+ evaluators produces reliable priority rankings. The scale has become the de facto standard for heuristic evaluation reports in industry.

**Cockton and Woolrych (2001)** challenged the high detection rates claimed for heuristic evaluation, arguing that many "problems" found by evaluators are false positives — predicted issues that do not actually affect real users. They estimated that up to 50% of heuristic evaluation findings may not correspond to genuine user difficulties, urging practitioners to validate findings with empirical testing.

**Hertzum and Jacobsen (2001)** formalized the "evaluator effect" in a meta-analysis, documenting that any two evaluators typically agree on fewer than 20% of the problems they find. This result underscores why multiple evaluators and post-hoc aggregation are non-negotiable.

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Molich et al. (2004)</strong> ran the Comparative Usability Evaluation (CUE) studies, in which multiple professional usability teams evaluated the same website independently. The results were sobering: teams found largely non-overlapping sets of problems, and the severity ratings assigned to the same problem varied widely across teams. This demonstrated that the evaluator effect operates not just at the individual level but at the team level.</p>

<p><strong>Law and Hvannberg (2004)</strong> investigated the reliability of heuristic evaluation by having evaluators inspect the same e-commerce site with and without severity ratings. They found that severity ratings improved prioritization consistency across evaluators, and that problem descriptions became more actionable when evaluators were forced to assess impact explicitly.</p>

<p><strong>Inostroza et al. (2012)</strong> adapted Nielsen's heuristics for mobile touchscreen applications, adding principles for gesture discoverability, physical interaction, and context-awareness. Their adapted set (SMASH — Smartphone Adapted Set of Heuristics) found problems that the original 10 heuristics missed in mobile-specific contexts, such as inadequate fat-finger tolerance and missing haptic feedback.</p>

<p><strong>Quiñones and Rusu (2017)</strong> conducted a systematic review of domain-specific heuristic sets and found over 70 published adaptations spanning games, medical devices, e-learning, and virtual reality. They concluded that while Nielsen's 10 remain the best general-purpose set, domain-specific extensions significantly improve detection rates for specialized interfaces.</p>

</details>

## See Also

- [Design Principles](../lessons/12-design-principles.md) — the design principles that heuristics operationalize for systematic inspection
- [Recognition over Recall](../lessons/07-recognition-vs-recall.md) — Heuristic #6 directly derives from the recognition-over-recall principle
- [Error Prevention & Recovery](../lessons/14-error-prevention-recovery.md) — Heuristics #5 and #9 map directly onto error prevention and recovery strategies

## Try It

<details>
<summary>Exercise: Heuristic Inspection of a Checkout Flow</summary>

<p>Consider an e-commerce checkout flow with the following screens:</p>

<ul>
<li><strong>Screen 1 — Cart:</strong> Shows items, quantities, and a "Proceed to Checkout" button. No indication of how many steps remain.</li>
<li><strong>Screen 2 — Shipping:</strong> Asks for full address. The "Country" dropdown defaults to "Afghanistan" (alphabetical first). No option to use a previously saved address. Clicking "Back" returns to the homepage, not the cart.</li>
<li><strong>Screen 3 — Payment:</strong> Shows an animated spinner with no text while processing. If the card is declined, the message reads "Error code 4012."</li>
</ul>

<p><strong>Step 1:</strong> For each screen, identify at least one heuristic violation and name the heuristic by number.</p>

<p><strong>Worked solution:</strong></p>

<ul>
<li><strong>Screen 1:</strong> No progress indicator — violates <strong>H1 (Visibility of system status)</strong>. Users cannot see how many steps remain, creating uncertainty about time investment.</li>
<li><strong>Screen 2:</strong> Country default of "Afghanistan" — violates <strong>H7 (Flexibility and efficiency of use)</strong> and arguably <strong>H5 (Error prevention)</strong>. A geo-located default or "most recent" selection would eliminate unnecessary scrolling. "Back" goes to homepage — violates <strong>H3 (User control and freedom)</strong>. Users expect "Back" to return to the previous step, not exit the flow entirely.</li>
<li><strong>Screen 3:</strong> Spinner with no text — violates <strong>H1 (Visibility of system status)</strong>. Users do not know if the system is processing, frozen, or waiting. "Error code 4012" — violates <strong>H9 (Help users recognize, diagnose, and recover from errors)</strong>. A constructive message like "Your card was declined. Please check the number or try a different card." would be far more useful.</li>
</ul>

<p><strong>Step 2:</strong> Rate each violation's severity on the 0-4 scale. The "Back" navigation issue is arguably a <strong>3 (Major)</strong> because it causes data loss. The cryptic error message is a <strong>3</strong> because it blocks task completion without guidance. The spinner issue is a <strong>2 (Minor)</strong> because most users will wait, but some will click away.</p>

</details>
