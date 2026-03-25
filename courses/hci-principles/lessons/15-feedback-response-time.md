# Feedback & Response Time

A 400-millisecond delay does not sound like much. But when Google tested adding 400ms of latency to search results in 2009, search volume dropped measurably. Users could not articulate why the experience felt worse — they just searched less. Response time is not a technical concern bolted onto the end of a project; it is a fundamental dimension of usability. The human perceptual system has hard thresholds, and interfaces that violate them feel broken regardless of how beautiful they look.

## The Principle

The foundational model comes from Robert B. Miller (1968) and was refined by Jakob Nielsen (1993) into three response-time thresholds:

$$t_{instant} \approx 0.1\text{s} \quad|\quad t_{flow} \approx 1.0\text{s} \quad|\quad t_{attention} \approx 10\text{s}$$

### The 0.1-Second Threshold (100ms)

Below 100 milliseconds, the response feels **instantaneous**. The user perceives no delay between their action and the system's response. This is the target for direct-manipulation interactions: button presses, drag operations, hover states, text input. At this speed, the interface feels like a physical extension of the user's hand.

Card, Moran & Newell (1983) grounded this threshold in their **Model Human Processor**, which describes three cognitive subsystems with characteristic cycle times:

- **Perceptual processor** — ~100ms cycle time. This is the minimum time to perceive a stimulus.
- **Cognitive processor** — ~70ms cycle time. This is the minimum time to make a simple decision.
- **Motor processor** — ~70ms cycle time. This is the minimum time to initiate a physical response.

A round-trip below 100ms is perceived before the perceptual processor completes its next cycle — making the delay invisible.

### The 1.0-Second Threshold

Between 0.1 and 1.0 seconds, the user notices a delay but **maintains their flow of thought**. The interaction still feels responsive, and the user does not need any visual indicator that the system is working. This is acceptable for page navigations, form submissions with immediate server responses, and transitions between views.

Above 1.0 second, the user's train of thought begins to fragment. They start to wonder: "Did it work? Should I click again?" This is where feedback becomes mandatory.

### The 10-Second Threshold

At 10 seconds, the user's attention shifts away from the task. Nielsen (1993) noted that this is approximately the limit of short-term memory for maintaining focus on a single task. Beyond 10 seconds without meaningful feedback, users will context-switch — check another tab, pick up their phone, or abandon the task entirely.

### Feedback Types

Matching the right feedback mechanism to the delay duration is critical:

**Immediate acknowledgment (0-100ms)** — Button depress animations, hover state changes, input character echoing. No spinner or indicator needed; the interface simply responds.

**Activity indicators / spinners (1-10s)** — A spinner communicates "the system is working" without specifying how long it will take. Appropriate when the duration is unpredictable but expected to be brief.

**Progress bars (10s+)** — When a task will take more than 10 seconds, users need to know how much longer it will take. Progress bars reduce perceived wait time and prevent abandonment. Determinate progress bars (showing percentage) are superior to indeterminate ones (looping animation) because they set expectations.

**Skeleton screens** — A skeleton screen shows the layout structure (gray boxes where content will appear) before the actual content loads. This technique, popularized by Facebook and LinkedIn, creates the perception that the page loaded quickly and content is "filling in," even though the total load time is unchanged. Skeleton screens are strictly superior to blank screens or full-page spinners.

**Optimistic UI** — The interface assumes the action will succeed and shows the result immediately, then corrects if it fails. Toggling a "like" button that shows the new state instantly — then rolls back if the server rejects it — is optimistic UI. This works for low-risk, high-probability-of-success actions and makes the interface feel instantaneous.

## Design Implications

- **Button feedback within 100ms.** Every interactive element must provide visual feedback within 100ms of interaction. A button that takes 300ms to visually respond feels broken, even if the underlying action is fast.
- **1-10s delays: show a spinner.** If a server call takes 2-5 seconds, display an activity indicator immediately (within 100ms of the action). Do not wait until 1 second has passed to show the spinner — show it instantly and remove it when the data arrives.
- **10s+ delays: show a progress bar.** For file uploads, data processing, and other long operations, provide a determinate progress bar with an estimated time remaining.
- **Skeleton screens are better than blank loading states.** When loading a page, show the structural layout immediately and fill in content progressively. This reduces perceived load time even when actual load time is unchanged.
- **Optimistic UI for low-risk actions.** Liking a post, marking an email as read, toggling a setting — these can be shown as complete immediately and corrected on failure.
- **Load text before images.** Text content is smaller and renders faster. Showing text while images load progressively gives users something to engage with immediately.
- **Perceived performance matters more than actual performance.** A 3-second load with a skeleton screen feels faster than a 2-second load with a blank white page. Invest in perceived performance, not just actual latency.

## The Evidence

Miller (1968) conducted the pioneering study on response-time thresholds. Working with computer terminals at MIT, he measured user productivity and satisfaction across a range of system response times. He identified that users had distinct behavioral breakpoints: below 0.1 seconds they treated the system as instantaneous, below 2 seconds they maintained conversational flow, and beyond 15 seconds they context-switched to other activities. Miller was working with text terminals, but his thresholds have proven remarkably stable across five decades of technology change.

Nielsen (1993) refined Miller's findings into the three-threshold model that became standard in HCI. He argued that these thresholds are rooted in human cognitive architecture, not technological convention, which is why they have not changed despite dramatic increases in computing power. A 10-second wait in 1968 feels the same as a 10-second wait in 2026 — the human perceptual system has not sped up.

Seow (2008) proposed a more granular taxonomy of response times in *Designing and Engineering Time*, defining categories like "instantaneous" (<0.2s), "immediate" (0.5-1s), "transitional" (1-5s), "pause" (5-10s), and "disruption" (>10s). His contribution was connecting each category to specific feedback design patterns and providing empirical guidelines for when each pattern should be deployed.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p><strong>Miller (1968)</strong> — "Response Time in Man-Computer Conversational Transactions" studied users performing a variety of tasks on time-sharing systems. His methodology was naturalistic: he observed users at terminals, measured their response patterns at different system delays, and identified behavioral transitions. The study was observational rather than controlled-experimental, but the consistency of the thresholds across tasks and users gave the findings high ecological validity.</p>

<p><strong>Card, Moran & Newell (1983)</strong> — <em>The Psychology of Human-Computer Interaction</em> provided the theoretical grounding for response-time thresholds. Their Model Human Processor formalized the perceptual (~100ms), cognitive (~70ms), and motor (~70ms) cycle times based on a meta-analysis of hundreds of psychological experiments. These cycle times explain <em>why</em> 100ms is the instantaneity threshold: it falls within one perceptual processing cycle.</p>

<p><strong>Nielsen (1993)</strong> — <em>Usability Engineering</em> compiled evidence from multiple studies and practical experience. Nielsen's contribution was primarily synthetic: he distilled Miller's and others' findings into a simple three-threshold model that designers could memorize and apply. He did not run new experiments but cited converging evidence from multiple sources.</p>

<p><strong>Seow (2008)</strong> — Conducted systematic reviews of response-time literature and supplemented them with user studies in enterprise software contexts. He found that the basic thresholds held but that context matters: users tolerate longer delays for tasks they perceive as inherently complex (generating a report) than for tasks they perceive as simple (clicking a link). This led to his recommendation that feedback should communicate not just "working" but "working on something complex."</p>

<p><strong>Brutlag (2009)</strong> — At Google, Brutlag ran large-scale A/B tests adding artificial latency to search results. Adding 400ms of delay reduced search volume by 0.59%. Adding 200ms reduced ad revenue measurably. These were among the first studies to quantify the business impact of response-time thresholds at scale, with millions of users providing statistical power that lab studies could never achieve.</p>

</details>

## Related Studies

**Card, Moran & Newell (1983)** — *The Psychology of Human-Computer Interaction* established the Model Human Processor and laid the theoretical foundation for understanding why specific response-time thresholds exist. Their processor-cycle framework remains the standard explanation for the 100ms instantaneity threshold.

**Dabrowski & Munson (2011)** — Studied the effect of progress bar design on perceived waiting time. They found that progress bars that accelerate toward the end (starting slow, finishing fast) are perceived as faster than linear progress bars, even when total duration is identical. This is because the acceleration creates a sense of momentum and an expectation that completion is imminent.

**Brutlag (2009)** — Google's landmark latency experiment demonstrated that response time directly impacts user behavior and revenue at scale. The finding that 400ms of added delay reduced search usage established response-time optimization as a business imperative, not just a usability concern.

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Nah (2004)</strong> — Studied tolerable waiting time for web pages and found that users' patience threshold was approximately 2 seconds for expected page loads. When a page exceeded this threshold without feedback, abandonment rates spiked. With a progress indicator, the tolerable threshold extended to approximately 10 seconds, confirming that feedback does not just improve perception — it fundamentally changes behavior.</p>

<p><strong>Harrison, Amento, Kuznetsov & Bell (2007)</strong> — Tested skeleton screens (then called "progressive loading") against blank loading states and spinners. Users rated skeleton-screen versions as loading faster, even when objective load times were identical or slightly longer. The skeleton provided a reference frame that made subsequent content appearance feel like "filling in" rather than "appearing from nothing."</p>

<p><strong>Lallemand & Koenig (2020)</strong> — Studied optimistic UI patterns and found that users preferred interfaces that showed immediate results (with occasional rollbacks) over interfaces that waited for server confirmation before updating the display. Error rates for the optimistic pattern were negligibly higher (< 0.5% of actions required rollback), while perceived responsiveness was dramatically better.</p>

<p><strong>Kohavi, Longbotham, Sommerfield & Henne (2009)</strong> — Reported on controlled experiments at Amazon and Microsoft showing that every 100ms of additional latency reduced revenue by measurable amounts. They argued that response time should be treated as a key performance indicator alongside uptime and error rate, and that performance budgets should be set and enforced like any other system requirement.</p>

</details>

## See Also

- [Design Principles](../lessons/12-design-principles.md) — feedback is one of Norman's six core design principles
- [Mental Models](../lessons/06-mental-models.md) — response-time expectations are part of the user's mental model of system behavior
- [Keystroke-Level Model](../lessons/17-keystroke-level-model.md) — KLM uses processor cycle times from the Model Human Processor to predict task completion times

## Try It

<details>
<summary>Exercise: Design a Feedback Strategy for a Multi-Stage Workflow</summary>

<p>Scenario: A user clicks "Generate Report" in a business analytics dashboard. The process has four stages:</p>

<ol>
<li>Query database (~2 seconds)</li>
<li>Aggregate data (~5 seconds)</li>
<li>Generate charts (~8 seconds)</li>
<li>Render PDF (~3 seconds)</li>
</ol>

<p>Total time: ~18 seconds. Design the feedback strategy for each stage.</p>

<p><strong>Worked Example:</strong></p>

<p><strong>Immediate (0-100ms):</strong> The "Generate Report" button immediately transitions to a disabled state with a subtle loading animation. The button text changes to "Generating..." This provides instant acknowledgment that the click was received.</p>

<p><strong>Stage 1 — Query Database (0-2s):</strong> A progress overlay appears on the report area showing "Fetching data..." with a determinate progress bar. Since 2 seconds is within the flow-maintenance threshold, a simple spinner with text label is sufficient. Progress bar shows 0-15%.</p>

<p><strong>Stage 2 — Aggregate Data (2-7s):</strong> Progress bar advances to 15-45% with label "Processing records..." The user is now past the 1-second threshold, so the progress indicator is essential to maintain engagement. The determinate bar shows forward motion.</p>

<p><strong>Stage 3 — Generate Charts (7-15s):</strong> Progress bar advances to 45-85% with label "Building visualizations..." Since this stage alone exceeds 5 seconds, consider showing a skeleton preview of the report layout — gray boxes where charts will appear. This gives the user a preview of the output structure and reduces perceived wait time.</p>

<p><strong>Stage 4 — Render PDF (15-18s):</strong> Progress bar advances to 85-100% with label "Finalizing report..." At this point the user has been waiting 15 seconds. An estimated time remaining ("~3 seconds left") helps maintain patience.</p>

<p><strong>Completion:</strong> The progress bar reaches 100%, the overlay fades, and the report appears with a brief highlight animation. A toast notification confirms: "Report generated — <strong>Download PDF</strong>."</p>

<p>Key design decisions: (1) The progress bar is determinate because the stages are predictable. (2) Each stage has a descriptive label so the user understands what is happening, not just that something is happening. (3) The skeleton preview during the longest stage reduces perceived wait. (4) The total 18-second wait exceeds the 10-second attention threshold, so the progress bar and stage labels are mandatory, not optional.</p>

</details>
