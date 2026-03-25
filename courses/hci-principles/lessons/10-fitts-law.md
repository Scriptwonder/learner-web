# Fitts's Law

Every time a user moves a cursor to click a button, taps a touchscreen target, or reaches for a menu item, the time it takes is governed by a precise logarithmic relationship between the distance to the target and the target's size. Fitts's Law is the most empirically validated model of aimed movement in all of human factors — and it has direct, measurable consequences for every interactive layout you design.

## The Principle

In 1954, Paul Fitts, an American psychologist and pioneer of human factors engineering, published a study that established the foundational law of motor performance in HCI. He showed that the time to move to a target depends on the ratio of distance to target width, not on either quantity alone.

Fitts's original formulation:

$$MT = a + b \cdot \log_2\!\left(\frac{2D}{W}\right)$$

where $MT$ is the movement time, $D$ is the distance from the starting position to the center of the target, $W$ is the width of the target along the axis of movement, $a$ is the intercept (start/stop overhead), and $b$ is the slope (inverse of motor bandwidth).

The quantity inside the logarithm defines the **Index of Difficulty (ID):**

$$ID = \log_2\!\left(\frac{2D}{W}\right) \quad \text{bits}$$

### Shannon Formulation

In 1992, Scott MacKenzie proposed a refinement based on Shannon's information theorem that provides a better statistical fit across a wider range of conditions:

$$MT = a + b \cdot \log_2\!\left(\frac{D}{W} + 1\right)$$

$$ID = \log_2\!\left(\frac{D}{W} + 1\right) \quad \text{bits}$$

The $+1$ ensures that $ID$ is always non-negative (when $D = 0$, $ID = 0$). This formulation is now the standard in ISO 9241-411 for evaluating pointing devices.

### Throughput

**Throughput (TP)** measures how efficiently a pointing system converts effort into aimed movements:

$$TP = \frac{ID}{MT} \quad \text{bits/s}$$

A mouse typically achieves 3.7-4.9 bits/s; a finger on a touchscreen achieves 5-7 bits/s; a trackpad typically falls between 2.5-4.0 bits/s. Throughput is the standard metric for comparing input devices and techniques.

```mermaid
flowchart LR
    A["Distance D, Width W"] --> B["ID = log₂(D/W + 1)"]
    B --> C["MT = a + b · ID"]
    C --> D["TP = ID / MT"]
```

### Edge and Corner Targeting

One of Fitts's Law's most powerful implications: targets at screen edges and corners have **effectively infinite width** along the axis of approach, because the cursor stops at the screen boundary. This means:

- A button at the screen edge: $W \to \infty$ along that axis, so $ID \to 0$
- A button in a screen corner: infinite width along **two** axes, making it the fastest possible target

This is why the macOS menu bar (at the top edge) is faster to target than a floating menu bar inset from the edge, and why the Windows Start button (in a corner) is so efficient.

## Design Implications

- **Make clickable targets large enough.** Apple's Human Interface Guidelines recommend a minimum of $44 \times 44$ points for touch targets. For mouse interfaces, the minimum effective target should be at least $24 \times 24$ px. Remember that padding counts as target area if it is part of the clickable region.
- **Place frequent actions near the cursor's rest position.** Context menus (right-click) spawn at the cursor, so $D \approx 0$ and the only cost is the target width. This is why context menus are faster than menu bars for frequent actions.
- **Exploit screen edges and corners.** Toolbars, docks, and menus placed at screen edges benefit from effectively infinite width. Do not inset interactive elements from the screen boundary by even a few pixels — the cost is disproportionate.
- **Reduce distance for common workflows.** If a user repeatedly clicks between two interface elements, bringing them closer together reduces $D$ and thus $MT$ for every interaction. Inline editing (clicking a value to edit it in place) eliminates $D$ almost entirely.
- **Padding is target area.** A 12px text label inside a 44px clickable region has an effective $W$ of 44px, not 12px. Always extend the hit area beyond the visible content. On the web, this means generous `padding` on `<a>` and `<button>` elements, not just `margin`.

## The Evidence

Fitts's 1954 study used a **reciprocal tapping** paradigm. Participants held a stylus and tapped back and forth between two metal plates as quickly as possible. Fitts systematically varied two factors: the **width** $W$ of the target plates (0.25, 0.5, 1, and 2 inches) and the **distance** $D$ between their centers (2, 4, 8, and 16 inches). This produced 16 conditions spanning a wide range of difficulty.

Fitts measured two things: movement time per tap and error rate. He found that $MT$ increased linearly with $\log_2(2D/W)$, with a correlation above $r = 0.99$. The fit was so tight that Fitts called the result "the information capacity of the human motor system" — drawing an explicit analogy to Shannon's channel capacity theorem.

The key numerical finding: participants could sustain approximately **10 bits per second** of motor information throughput. Whether the target was large and close (easy) or small and far (hard), the ratio $ID/MT$ was roughly constant. This meant the motor system behaves like a communication channel with a fixed bandwidth.

**Fitts and Peterson (1964)** extended the paradigm to **discrete** (single) movements rather than reciprocal tapping, confirming that the law held for individual aimed movements, not just rhythmic alternation.

**MacKenzie (1992)** showed that the Shannon formulation $ID = \log_2(D/W + 1)$ produced a superior fit by testing across multiple datasets. The Shannon form had higher $r^2$ values and produced more consistent throughput estimates across conditions. This formulation became the ISO standard.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p>Fitts's reciprocal tapping task was chosen for its <strong>ecological validity</strong> and <strong>statistical power</strong>. By having participants tap back and forth continuously for a fixed duration (typically 15-20 seconds per condition), he collected dozens of movements per condition per participant, yielding highly stable mean MTs.</p>

<p>The task had a built-in speed-accuracy tradeoff: participants were instructed to move "as quickly as possible while keeping errors below 4%." When error rates exceeded this threshold, the condition was re-run. This ensured that the MT data reflected a consistent accuracy criterion across conditions.</p>

<p><strong>Welford (1968)</strong> proposed an alternative formulation: $ID = \log_2(D/W + 0.5)$, which better handled cases where $W > D$. This was used for decades before MacKenzie's Shannon formulation superseded it.</p>

<p><strong>Card, English, and Burr (1978)</strong> conducted the first major application of Fitts's Law to computer input devices. They compared a mouse, a joystick, step keys, and text keys for a screen pointing task. The mouse achieved the highest throughput (~3.9 bits/s), establishing its dominance as a pointing device. Their work directly influenced the adoption of the mouse by Xerox PARC and later Apple.</p>

<p><strong>MacKenzie and Buxton (1992)</strong> extended Fitts's Law to two-dimensional targets, showing that for rectangular targets, the width $W$ in the Fitts model should be the target's extent along the approach axis, not the minimum dimension. This has practical implications: a wide horizontal button is easier to hit from the left or right than a tall narrow button, even if their areas are equal.</p>

<p><strong>Accuracy and the effective width correction:</strong> The ISO 9241-411 standard recommends computing <strong>effective width</strong> $W_e$ from the observed spread of endpoint distributions: $W_e = 4.133 \times SD_x$, where $SD_x$ is the standard deviation of hit coordinates along the task axis. This adjusts for the fact that participants may trade speed for accuracy differently than instructed. Using $W_e$ in place of the nominal $W$ yields more stable throughput estimates.</p>

</details>

## Related Studies

**ISO 9241-411 (formerly ISO 9241-9)** — The international standard for evaluating pointing devices. It mandates the Shannon formulation and the multi-directional tapping test as the reference task for measuring throughput. Any input device comparison in the research literature now uses this standard.

**Accot and Zhai (2003)** — Extended Fitts's Law to two-dimensional targets of arbitrary shape, developing the "Pointing in 2D" model. They showed that target shape (circle vs. rectangle vs. triangle) affects performance in ways not fully captured by a single width parameter.

**Bi, Li, and Zhai (2013)** — Developed **FFitts** (Finger-Fitts), a model for touchscreen pointing that accounts for the "fat finger problem" — the finger's contact area occludes the target. Their model adds a term for absolute pointing accuracy that is independent of target size, explaining why very small touch targets are disproportionately harder than Fitts's Law alone predicts.

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Soukoreff and MacKenzie (2004)</strong> provided a comprehensive review of Fitts's Law research, cataloging over 100 studies. They standardized throughput computation methods and showed that many published studies had methodological issues (e.g., computing throughput per condition rather than per participant, inflating estimates). Their corrected analyses place mouse throughput at approximately 4.0-4.5 bits/s for typical desktop tasks.</p>

<p><strong>Zhai (2004)</strong> analyzed the theoretical relationship between Fitts's Law and the speed-accuracy tradeoff, showing that the logarithmic form arises naturally from a model where the motor system makes iterative corrections, each reducing the remaining distance by a constant fraction. This "iterative corrections" model explains why Fitts's Law holds across such a wide range of tasks and effectors.</p>

<p><strong>Guiard and Beaudouin-Lafon (2004)</strong> explored the concept of Fitts's Law in the context of multi-scale interfaces (e.g., zooming UIs). They showed that when the user can zoom in, the effective $D/W$ ratio changes, and that well-designed zoomable interfaces can reduce the total Fitts-predicted time for distant small targets by allowing the user to first zoom (reducing $D$) and then point (at a now-larger $W$).</p>

<p><strong>Cockburn and Brock (2006)</strong> examined how Fitts's Law interacts with target prediction and expansion. They found that targets that expand as the cursor approaches them reduce $MT$ even though the expansion happens during the movement. This is the basis for "fisheye" menus and dock magnification effects (like the macOS Dock).</p>

</details>

## See Also

- [Hick's Law](../lessons/09-hicks-law.md) — decision time before the movement begins; together with Fitts's Law, models the full select-and-act cycle
- [Steering Law](../lessons/11-steering-law.md) — extends Fitts's Law to constrained path movements through tunnels
- [Keystroke-Level Model](../lessons/17-keystroke-level-model.md) — uses Fitts's Law as one component of total task time prediction

## Try It

<details>
<summary>Exercise: Compare Two Button Layouts</summary>

<p>A dialog box has an "OK" button and a "Cancel" button. In Design A, both buttons are 80px wide and positioned 400px from the cursor's rest position (center of the dialog). In Design B, the "OK" button is 120px wide and positioned 200px from the cursor's rest position (near the bottom-right of the dialog, close to where the cursor naturally ends up after reading).</p>

<p><strong>Calculate the Index of Difficulty for each design (Shannon formulation):</strong></p>

<p>Design A (OK button): $ID_A = \log_2(400/80 + 1) = \log_2(6) \approx 2.58$ bits</p>

<p>Design B (OK button): $ID_B = \log_2(200/120 + 1) = \log_2(2.67) \approx 1.42$ bits</p>

<p>Design B's OK button has an ID that is <strong>45% lower</strong> than Design A's. If we assume $a = 50$ ms and $b = 150$ ms/bit:</p>

<p>$MT_A = 50 + 150 \times 2.58 = 437$ ms</p>
<p>$MT_B = 50 + 150 \times 1.42 = 263$ ms</p>

<p>Design B saves approximately <strong>174 ms per click</strong> on the OK button. For a dialog that appears 50 times per day, that is nearly 9 seconds saved daily — and more importantly, the interaction <strong>feels</strong> more fluid.</p>

<p><strong>Takeaway:</strong> Both reducing distance $D$ and increasing width $W$ improve performance, but the effects combine inside the logarithm. Optimizing both simultaneously yields the largest gains.</p>

</details>
