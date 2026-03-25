# Steering Law & Path-Based Interaction

Not all pointing tasks end at a single target. When a user navigates a cascading dropdown menu, drags a scrollbar thumb, or traces a path through a narrow corridor of UI elements, they are performing a **steering task** — a continuous movement through a constrained tunnel. The Steering Law, established by Johnny Accot and Shumin Zhai in 1997, quantifies why these interactions are so much harder than simple point-and-click, and why getting them wrong creates some of the most frustrating moments in interface design.

## The Principle

Where Fitts's Law governs **discrete** aimed movements (point A to point B), the Steering Law governs **continuous** movements through a constrained path. The user must stay within the bounds of a tunnel for the entire duration of the movement, not just hit a target at the end.

For a straight tunnel of length $D$ and constant width $W$, the Steering Law states:

$$T = a + b \cdot \frac{D}{W}$$

The critical difference from Fitts's Law is that the relationship is **linear** in $D/W$, not logarithmic. This has enormous practical consequences: doubling the length of a narrow tunnel **doubles** the additional steering time, while doubling the distance to a point target adds only a constant increment.

### Why Linear, Not Logarithmic?

In Fitts's Law, the user makes a single ballistic movement with corrective submovements at the end — a process that integrates information logarithmically. In steering, the user must maintain continuous control throughout the entire path. The movement can be modeled as a sequence of infinitesimal Fitts's Law tasks, each requiring the cursor to remain within a corridor of width $W$. When you integrate these infinitesimal tasks over the path length $D$, the logarithms sum to a linear function.

### Curved and Variable-Width Tunnels

For tunnels that curve or change width along the path, the general form of the Steering Law uses an integral:

$$T = a + b \cdot \int_C \frac{ds}{W(s)}$$

where $C$ is the path, $ds$ is an infinitesimal arc length element, and $W(s)$ is the tunnel width at position $s$. Narrow segments contribute disproportionately to the total time — a brief bottleneck in an otherwise wide path can dominate the entire interaction cost.

This integral form reveals a key insight: **the hardest part of the path determines the overall difficulty**. A 200px-long tunnel that is 40px wide for 190px but narrows to 5px for the last 10px will be far slower than a uniformly 30px-wide tunnel of the same length, because the narrow segment contributes $10/5 = 2.0$ while the wide segment contributes $190/40 = 4.75$, for a total $D/W_{\text{eff}} = 6.75$. Compare that to the uniform tunnel: $200/30 = 6.67$ — nearly the same, despite the wide tunnel feeling easier.

### Relationship to Fitts's Law

The Steering Law and Fitts's Law are mathematically related. Accot and Zhai showed that Fitts's Law can be derived as a special case of a more general "pointing-and-steering" framework. A point-and-click task is a degenerate tunnel of zero length — the user only needs to be inside the target at the moment of the click. A steering task requires being inside the target for the entire traversal. This is why steering is always slower than pointing for equivalent dimensions.

## Design Implications

- **Avoid long, narrow constrained paths.** Cascading dropdown menus are the canonical offender: the user must steer the cursor horizontally through a narrow menu item (the height of the item), then vertically through the submenu — all without leaving the active region. If the cursor strays, the submenu closes. This creates a high $D/W$ ratio.
- **Wider tunnels are disproportionately easier.** Because the relationship is linear in $D/W$, doubling the width halves the steering difficulty. Increasing a cascading menu item's height from 24px to 36px reduces steering time by 33%.
- **Mega-menus eliminate the steering penalty.** Instead of cascading submenus that require steering through narrow channels, a mega-menu reveals all options in a single large panel. The user makes a single Fitts's Law point-and-click (logarithmic cost) instead of a steering task (linear cost). This is why Amazon, Microsoft, and most major sites have abandoned cascading menus for mega-menus.
- **Scrollbar width matters.** Dragging a scrollbar thumb is a vertical steering task. A 12px-wide scrollbar with a 500px travel distance has $D/W = 41.7$. Widening it to 18px reduces this to $D/W = 27.8$ — a 33% improvement. This is one reason why modern thin scrollbars that expand on hover are a compromise: they look clean but are harder to use when narrow.
- **Add "triangle zones" or delay buffers for diagonal paths.** When moving from a menu item to its submenu, the user must move diagonally. Without accommodation, any vertical deviation closes the parent menu item's highlight. The solution — used by Amazon, macOS, and many UI frameworks — is to define a triangular "safe zone" between the menu item and the submenu, or to add a 200-300ms delay before closing the submenu. This effectively widens the tunnel during the diagonal traversal.

## The Evidence

Accot and Zhai's 1997 study at IBM Almaden Research Center is the foundational work. They designed a series of **tunnel steering tasks**: participants used a stylus on a graphics tablet to move through straight rectangular tunnels of varying width $W$ (8, 16, 32, 64 pixels) and length $D$ (100, 200, 400, 800 pixels). The cursor had to stay within the tunnel boundaries for the entire traversal; touching a wall was counted as an error, and the trial was discarded and repeated.

The results were decisive. When task time was plotted against $D/W$, the data fell on a straight line with very high correlation ($r^2 > 0.98$). When plotted against $\log_2(D/W)$ — the Fitts-like formulation — the fit was substantially worse. This confirmed the linear model: steering difficulty scales linearly with the length-to-width ratio, not logarithmically.

The slope $b$ was approximately **120-150 ms per unit of $D/W$**, though this varied with input device (stylus vs. mouse). The intercept $a$ was small (~50-100 ms), representing the time to initiate and terminate the movement.

Accot and Zhai followed up in **2001** with a study of **scale effects**, demonstrating that the Steering Law held across different physical scales — from small tunnels requiring fine motor control to large tunnels requiring gross arm movements. In **2003**, they extended the law to **curved tunnels and 2D steering**, confirming the integral formulation $T = a + b \int ds/W(s)$ for arbitrary paths.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p>Accot and Zhai's experimental design was carefully constructed to isolate steering from pointing. Participants were instructed to move through the tunnel as quickly as possible without touching the walls. Error trials (wall touches) were excluded from the time analysis, ensuring that the MT data reflected successful steering at a consistent accuracy criterion.</p>

<p>They used a within-subjects design with 12 participants, each performing all 16 conditions ($4 \times 4$ combinations of $D$ and $W$). Each condition was repeated 10 times per participant, yielding stable mean times. The order of conditions was counterbalanced using a Latin square design.</p>

<p><strong>Key methodological details:</strong></p>

<ul>
<li>The tunnels were presented on a computer display, and participants used a Wacom stylus tablet for input. The stylus provides higher resolution and lower latency than a mouse, reducing measurement noise.</li>
<li>The dependent variable was <strong>movement time</strong> from entering the tunnel at one end to exiting at the other. Initiation time (moving to the tunnel entrance) was not included.</li>
<li>The critical comparison was between the linear model $T = a + b(D/W)$ and the logarithmic model $T = a + b \log_2(D/W + 1)$. The linear model consistently achieved higher $r^2$ values (0.98+ vs. 0.92-0.95 for the log model).</li>
</ul>

<p><strong>Accot and Zhai (2001)</strong> tested the law at different physical scales by varying both the display zoom level and the control-display gain. They found that the Steering Law held at all scales, but that very small tunnels (requiring sub-millimeter precision) showed slightly elevated times, suggesting a lower bound on motor resolution.</p>

<p><strong>Accot and Zhai (2003)</strong> extended the law to two dimensions by having participants steer through curved tunnels (arcs and S-curves). The integral form $T = a + b \int ds/W(s)$ fitted the data well for smooth curves. For paths with sharp corners, an additional "corner cost" was needed because the user must decelerate, reorient, and accelerate — a process not captured by the width-based integral alone.</p>

</details>

## Related Studies

**Pastel (2006)** — Studied cascading menu performance and confirmed that steering through nested submenus follows the Steering Law. Found that adding a 300ms delay before closing parent items reduced errors by 40% without noticeably slowing experienced users, because the delay fell within the normal submenu-approach time.

**Cockburn and Brewster (2005)** — Compared cascading menus, mega-menus, and fisheye menus. Mega-menus were fastest for large option sets because they replaced steering with pointing. Fisheye menus (which enlarge items near the cursor) improved performance for moderate-sized menus by effectively increasing $W$ during the approach.

**Zhao and Balakrishnan (2004)** — Extended the Steering Law to pen-based interaction on tablets, testing both straight and circular tunnel steering. They confirmed the linear model and found that pen steering was faster than mouse steering, consistent with the higher bandwidth of direct stylus input.

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Kulikov, MacKenzie, and Stuerzlinger (2005)</strong> examined the Steering Law for mouse-based steering tasks and found that the law held but with a higher slope $b$ than for stylus input, reflecting the mouse's lower control bandwidth for continuous tasks. They also found that very narrow tunnels ($W < 8$ px) produced disproportionately high error rates, suggesting a practical lower limit on tunnel width for mouse-based interfaces.</p>

<p><strong>Dennerlein, Martin, and Hasser (2000)</strong> applied the Steering Law to force-feedback pointing devices, showing that haptic guidance (virtual walls that resist the cursor leaving the tunnel) reduced steering time by approximately 20%. This research informs the design of assistive technologies and "snap-to" guides in drawing applications.</p>

<p><strong>Yamanaka and Miyashita (2016)</strong> investigated the Steering Law in the context of touch input, where the finger's width creates a fundamental minimum tunnel width. They found that for touch steering, the effective tunnel width should be reduced by the finger's contact width (~10mm), meaning that tunnels narrower than about 15mm are impractical for finger-based steering.</p>

<p><strong>Quinn and Cockburn (2020)</strong> revisited the cascading menu problem with modern UI patterns. They found that "aim-aware" menus — which use cursor trajectory prediction to keep submenus open when the user is clearly heading toward them — outperformed both static delay and triangle-zone approaches. The aim-aware approach effectively makes the steering tunnel infinitely wide along the predicted trajectory, reducing the task to a simple Fitts's Law pointing movement.</p>

</details>

## See Also

- [Fitts's Law](../lessons/10-fitts-law.md) — the discrete-movement counterpart; steering is the continuous extension
- [Hick's Law](../lessons/09-hicks-law.md) — decision time within menus interacts with steering time between menu levels

## Try It

<details>
<summary>Exercise: Compare Cascading Menu vs. Mega-Menu</summary>

<p>A website navigation has 8 top-level categories, each with 6 subcategories. Consider two designs:</p>

<p><strong>Design A — Cascading dropdown:</strong> Each top-level item opens a vertical submenu to its right. The submenu items are 200px wide and 32px tall. The user must steer horizontally ~200px across the parent item, then vertically through up to 6 items (total vertical travel: $6 \times 32 = 192$ px through a 200px-wide vertical tunnel).</p>

<p><strong>Design B — Mega-menu:</strong> Each top-level item opens a single large panel showing all 6 subcategories in a grid. The user makes a single diagonal Fitts's Law movement from the top-level item to the desired subcategory.</p>

<p><strong>Analysis of Design A (cascading):</strong></p>

<p>Horizontal steering through the parent item to reach the submenu: The parent item is approximately 120px wide (the tunnel length) and 32px tall (the tunnel width). Steering time: $T_1 = a + b \cdot (120/32) = a + 3.75b$.</p>

<p>Vertical pointing to the desired submenu item (assume 4th item, so $D = 3.5 \times 32 = 112$ px, $W = 32$ px): This is a Fitts's Law task within the submenu: $T_2 = a + b \cdot \log_2(112/32 + 1) = a + b \cdot \log_2(4.5) = a + 2.17b$.</p>

<p>Total: $T_A \approx 2a + 5.92b$.</p>

<p><strong>Analysis of Design B (mega-menu):</strong></p>

<p>Single Fitts's Law movement from the top-level item to the target subcategory. Assume $D = 150$ px (diagonal distance into the mega-menu panel) and $W = 80$ px (large clickable area for each subcategory): $T_B = a + b \cdot \log_2(150/80 + 1) = a + b \cdot \log_2(2.875) = a + 1.52b$.</p>

<p>The mega-menu is approximately <strong>twice as fast</strong>: it replaces a steering + pointing sequence ($2a + 5.92b$) with a single pointing movement ($a + 1.52b$). With $a = 100$ ms and $b = 150$ ms: $T_A \approx 1088$ ms vs. $T_B \approx 328$ ms.</p>

<p><strong>Takeaway:</strong> The linear scaling of the Steering Law makes cascading menus disproportionately expensive. Mega-menus convert a steering problem into a pointing problem, replacing linear cost with logarithmic cost.</p>

</details>
