# Hick's Law

When a user faces a menu, a toolbar, or a set of navigation links, how long it takes them to decide where to click is not random — it follows a precise logarithmic relationship with the number of choices. Hick's Law is one of the most directly actionable principles in interface design, giving designers a mathematical tool to predict and reduce decision time.

## The Principle

In 1952, the British psychologist William Edmund Hick published an experiment that quantified something designers intuit: more options mean slower decisions. A year later, Ray Hyman independently replicated and extended the finding. Together their work established what we now call the **Hick-Hyman Law**.

The law states that the time to make a decision increases logarithmically with the number of equally probable alternatives:

$$RT = a + b \cdot \log_2(n)$$

where $RT$ is the reaction time, $n$ is the number of alternatives, $a$ is the base reaction time (the irreducible time for perceiving the stimulus and executing a motor response, typically 200-400 ms), and $b$ is the slope — approximately **150 ms per bit** of information.

The $\log_2$ is not arbitrary. It comes directly from **information theory**. Each equally likely choice among $n$ alternatives carries $\log_2(n)$ bits of information. A choice between 2 items requires 1 bit; a choice among 8 items requires 3 bits; a choice among 32 items requires 5 bits. The law says that humans process decisions at a roughly constant rate measured in bits per second.

### When the Law Breaks Down

Hick's Law assumes the user must **search and decide** among unfamiliar, unpredictable options. It weakens or breaks down entirely in several situations:

- **Practiced users.** An expert who has memorized that "Save" is the third item in the File menu does not scan the menu — they execute a ballistic movement. Reaction time becomes nearly independent of menu length.
- **Spatial consistency.** When items occupy stable, known positions (e.g., a toolbar that never changes), spatial memory replaces serial search.
- **Categorized menus.** If a menu is organized into clear groups, users first choose a category (small $n$), then an item within it (small $n$ again), rather than scanning the entire flat list.
- **Search and filter.** A search box sidesteps Hick's Law entirely. The user does not choose among presented options — they recall and type what they want.

## Design Implications

- **Fewer visible choices speed decisions — but do not hide functionality.** Reducing a 20-item toolbar to 5 primary actions with a "More" overflow cuts the initial decision from $\log_2(20) \approx 4.3$ bits to $\log_2(5) \approx 2.3$ bits. The overflow is there when needed, but the common case is fast.
- **Categorize large sets into hierarchical groups.** A flat list of 64 items requires $\log_2(64) = 6$ bits of decision. Grouping them into 8 categories of 8 items each requires $\log_2(8) + \log_2(8) = 6$ bits total — the same — but each individual decision is smaller and cognitively easier, and users can skip irrelevant categories entirely.
- **Use progressive disclosure.** Show only what the user needs at each step. A wizard that presents 3 options per page across 4 pages is faster than a single page with 12 options, because each decision is simpler.
- **For expert users, spatial consistency matters more than option count.** A power user who knows exactly where "Export as PDF" lives in a 40-item menu is barely affected by the menu's length. Redesigning menu order to "simplify" the menu can actually slow experts down by breaking spatial memory.
- **Search and filter sidestep the law.** For large option sets (country pickers, font selectors, command palettes), providing a search field transforms the task from visual scanning to recall — which for frequent actions is much faster.

## The Evidence

Hick's 1952 experiment was elegant in its simplicity. He seated participants in front of a panel with **10 small lamps**, each paired with a corresponding response key. On each trial, some subset of the lamps was designated as "active" — the set could be 1, 2, 4, 8, or all 10 lamps. One active lamp lit up at random, and the participant pressed the corresponding key as quickly as possible. Hick measured the time from lamp onset to keypress.

The results were strikingly clean. When only 1 lamp was active, the task was a simple reaction time (~200 ms). As the number of active lamps increased, reaction time grew, but not linearly. Doubling the number of active lamps added a roughly constant increment of time. When plotted against $\log_2(n)$, the data formed a straight line, confirming the information-theoretic prediction that humans process decisions at a constant bit rate.

The slope was approximately **150 ms per bit**, meaning each doubling of alternatives added about 150 ms. With all 10 lamps active ($\log_2(10) \approx 3.32$ bits), reaction time was roughly $200 + 150 \times 3.32 \approx 700$ ms.

A follow-up by **Landauer and Nachbar (1985)** applied Hick's Law to menu design directly. They compared **broad-shallow** menus (many items per level, few levels) against **narrow-deep** menus (few items per level, many levels). Their finding: broader, shallower menus led to faster task completion, because the total information processed at each level was lower per step and there were fewer navigation steps. A menu with 4,096 items organized as $6 \times 6 \times 6 \times 6$ (4 levels of 6) was slower than $16 \times 16 \times 16$ (3 levels of 16), even though each level of the narrow menu had fewer items.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p>Hick's experimental setup was a <strong>choice reaction time (CRT)</strong> paradigm, which differs from simple reaction time (SRT) in that the participant must both identify which stimulus appeared and select the corresponding response. The key insight is that CRT increases with the number of stimulus-response mappings, while SRT does not.</p>

<p>Hick used a within-subjects design: each participant performed all conditions (1, 2, 4, 8, and 10 active lamps), with order counterbalanced. He collected hundreds of trials per condition per participant to obtain stable mean RTs. The logarithmic fit was assessed by plotting mean RT against $\log_2(n)$ and computing the linear correlation — which was consistently above $r = 0.99$.</p>

<p><strong>Hyman's 1953 extension</strong> was methodologically important because he manipulated not just the number of alternatives but their <strong>probabilities</strong>. When alternatives were unequally probable, the relevant quantity was Shannon entropy $H = -\sum p_i \log_2 p_i$, not simply $\log_2(n)$. Hyman confirmed that RT was linear in $H$, not $n$ — the true predictor is information content, not raw option count. This means that in practice, a menu where 80% of users pick one of 3 options behaves as if it has far fewer choices than its full length suggests.</p>

<p><strong>Landauer and Nachbar (1985)</strong> used a computer-based menu selection task with hierarchical menus of varying breadth and depth. Their dependent variable was total task completion time, which included both decision time at each level and navigation time between levels. They found that optimal breadth was between 4 and 8 items per level for most total set sizes, with broader menus winning because the logarithmic cost of adding items to a level grew slowly while the fixed overhead of navigating to additional levels was substantial.</p>

<p><strong>Important caveats from the replication literature:</strong></p>

<ul>
<li>Hick's Law applies most cleanly to <strong>symbolic, unpracticed</strong> choices. Once a stimulus-response mapping is overlearned, RT flattens and the logarithmic relationship weakens (Teichner & Krebs, 1974).</li>
<li>The constant $b \approx 150$ ms/bit is an average. It varies with modality (visual vs. auditory stimuli), response type (keypress vs. vocal), and individual differences in processing speed.</li>
<li>For very large $n$ (beyond ~30 items), some studies find that RT increases faster than $\log_2(n)$, possibly because visual search time (which is linear or sublinear in $n$) begins to dominate over decision time.</li>
</ul>

</details>

## Related Studies

**Hyman (1953)** — Extended Hick's work to unequal stimulus probabilities, demonstrating that the true predictor of reaction time is Shannon entropy $H = -\sum p_i \log_2 p_i$ rather than the raw number of options. This means frequent options are processed faster than rare ones, even in the same menu.

**Seow (2005)** — Revisited Hick's Law in the context of modern GUI design. Found that the law held for unfamiliar interfaces but that expert users showed significantly flatter slopes, confirming that practice and spatial memory attenuate the effect.

**Cockburn, Gutwin, and Greenberg (2007)** — Studied adaptive and adaptable menus, finding that menus that reorder items based on frequency can help novices (by reducing effective $n$) but hurt experts (by breaking spatial consistency). This highlights the tension between optimizing for Hick's Law and preserving spatial memory.

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Teichner and Krebs (1974)</strong> conducted a meta-analysis of 13 choice reaction time studies and confirmed the Hick-Hyman relationship while noting that the slope $b$ decreases with practice. After extensive training (thousands of trials), the slope can drop to near zero — the reaction time becomes nearly independent of the number of alternatives. This is the psychophysical basis for "muscle memory" in expert users.</p>

<p><strong>Card, Moran, and Newell (1983)</strong> incorporated Hick's Law into the Model Human Processor framework in their landmark book <em>The Psychology of Human-Computer Interaction</em>. They used it to model menu selection time and to derive guidelines for optimal menu breadth. Their analysis predicted that menus should have 4-8 items per level, a recommendation that has held up remarkably well.</p>

<p><strong>Kiger (1984)</strong> empirically compared menu structures for a 64-item database: a flat list of 64, a 2-level structure of $8 \times 8$, a 3-level structure of $4 \times 4 \times 4$, and a 6-level binary tree of $2 \times 2 \times 2 \times 2 \times 2 \times 2$. The $8 \times 8$ structure was fastest overall, supporting the broad-shallow principle. The binary tree, despite having the smallest per-level choice, was slowest due to accumulated navigation overhead.</p>

<p><strong>Proctor and Schneider (2018)</strong> reviewed Hick's Law in the context of modern UX research and noted that the original paradigm (arbitrary stimulus-response mappings with no spatial structure) does not directly map to most real-world interfaces. In realistic GUIs, visual search, grouping, labeling quality, and familiarity all modulate reaction time. Hick's Law is best understood as a lower bound on decision time that applies most directly when the user is genuinely uncertain about which option to choose.</p>

</details>

## See Also

- [Fitts's Law](../lessons/10-fitts-law.md) — once Hick's Law governs the decision, Fitts's Law governs the movement to the chosen target
- [Working Memory](../lessons/04-working-memory.md) — the number of simultaneously evaluable options is constrained by working memory capacity

## Try It

<details>
<summary>Exercise: Compare Two Navigation Designs</summary>

<p>A settings screen has 32 options. Design A presents all 32 in a single scrollable list. Design B groups them into 4 categories of 8 options each. Assume all options are equally likely to be selected and the user is unfamiliar with the layout.</p>

<p><strong>Analysis:</strong></p>

<p>Design A — flat list of 32:</p>
<p>$$RT_A = a + b \cdot \log_2(32) = a + 5b$$</p>
<p>With $a = 200$ ms and $b = 150$ ms/bit: $RT_A = 200 + 750 = 950$ ms.</p>

<p>Design B — two-step: choose 1 of 4 categories, then 1 of 8 items:</p>
<p>$$RT_B = (a + b \cdot \log_2(4)) + (a + b \cdot \log_2(8)) = 2a + b(2 + 3) = 2a + 5b$$</p>
<p>With the same constants: $RT_B = 400 + 750 = 1150$ ms.</p>

<p>Wait — the two-step design is <strong>slower</strong> by the total information metric? Yes, the raw bit count is the same ($\log_2(4) + \log_2(8) = 5$ bits = $\log_2(32)$), and there is an extra base RT cost $a$ for the second decision. However, this analysis assumes equal probabilities and complete unfamiliarity. In practice, Design B wins because:</p>

<ul>
<li>Users can <strong>skip irrelevant categories</strong> entirely, reducing effective $n$.</li>
<li>Category labels provide <strong>semantic cues</strong> that reduce uncertainty below the equal-probability assumption.</li>
<li>Cognitive load per decision is lower, reducing errors and backtracking.</li>
</ul>

<p>The lesson: Hick's Law provides the theoretical floor, but real-world categorization benefits come from reduced effective entropy, not just from splitting the choice into steps.</p>

</details>
