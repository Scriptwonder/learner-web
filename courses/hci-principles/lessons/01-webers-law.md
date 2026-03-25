# Weber's Law & Just-Noticeable Difference

Every time you adjust font size, tweak padding, or animate a transition, your users' ability to notice the change is governed by a 190-year-old psychophysical law. Weber's Law tells us that the smallest detectable change in a stimulus is not a fixed amount — it is a constant proportion of the original stimulus. Understanding this principle is the foundation of perceptual design: it determines when a UI change is visible and when it vanishes beneath the threshold of awareness.

## The Principle

In 1834, the German physiologist Ernst Heinrich Weber conducted a deceptively simple experiment. He asked participants to hold a weight in each hand and report which was heavier. By methodically varying the difference between the two weights, he discovered a striking regularity: the smallest difference a person could reliably detect — the **just-noticeable difference (JND)** — was not a fixed number of grams. Instead, it was a fixed *ratio* of the reference weight.

This relationship is expressed as:

$$\frac{\Delta I}{I} = k$$

where $I$ is the intensity of the original stimulus, $\Delta I$ is the just-noticeable difference, and $k$ is the **Weber fraction** — a constant that depends on the sensory modality.

For lifted weights, Weber found $k \approx 1/40$, or about 2.5%. This means if you are holding a 400 g weight, you need at least a 10 g difference to notice. If you are holding 1000 g, you need 25 g. The absolute threshold grows, but the ratio stays the same.

### Weber Fractions Across Senses

Different senses have dramatically different Weber fractions:

| Sense | Stimulus | Weber Fraction ($k$) |
|---|---|---|
| Pitch | Sound frequency | ~0.3% |
| Weight | Lifted mass | ~2% |
| Length | Line segments | ~3% |
| Brightness | Light intensity | ~8% |
| Loudness | Sound pressure | ~5% |
| Spatial extent | Padding, spacing | ~8% |

Lower fractions mean higher sensitivity — we are exquisitely sensitive to pitch changes but much less so to brightness changes.

### Fechner's Formalization

Gustav Fechner, Weber's student, extended the finding into a general law of sensation in 1860. If each JND step represents one subjective unit of perceived intensity, then perceived intensity $\psi$ grows as the logarithm of the physical stimulus:

$$\psi = k \ln\left(\frac{I}{I_0}\right)$$

where $I_0$ is the detection threshold. This logarithmic relationship explains why we perceive a jump from 1 to 2 candles as a large change, but 101 to 102 candles as negligible — even though the physical change is identical.

### Stevens' Power Law

In 1957, S. S. Stevens proposed a more general model that replaced Fechner's logarithm with a power function:

$$\psi = k \cdot S^n$$

where $S$ is the stimulus magnitude and $n$ is an exponent that varies by modality. When $n = 1$, perception is linear; when $n < 1$ (brightness, $n \approx 0.33$), perception compresses large values; when $n > 1$ (electric shock, $n \approx 3.5$), perception expands. Stevens' law handles a wider range of phenomena, but Weber's law remains the essential insight for UI work: proportional change is what matters.

## Design Implications

- **Contrast must scale with baseline.** A 1px border on a small element is visible; a 1px border on a 600px panel is invisible. Borders, shadows, and highlights need to grow proportionally with element size.
- **Animation easing follows Weber's Law.** Linear animations feel wrong because equal increments of position produce diminishing perceptual impact at higher speeds. Ease-in-out curves roughly compensate for Weber-like perception of velocity.
- **Padding and spacing changes must be proportional.** Increasing padding from 8px to 12px (50%) is clearly visible. Increasing from 48px to 52px (8%) is near the JND for spatial extent — users may not notice the change at all.
- **Slider precision should match JND.** A brightness slider with 256 discrete steps is overkill for most of the range. At high brightness, steps could be larger without the user noticing. Perceptually uniform sliders use logarithmic or power-law mappings.
- **Progressive disclosure thresholds.** When revealing additional information on hover or scroll, the visual change needs to exceed the JND for the relevant channel (opacity, size, position) to be noticed at all.

## The Evidence

Weber's original experiments (1834) used a two-alternative forced-choice (2AFC) paradigm with lifted weights. Blindfolded participants held a reference weight in one hand and a comparison weight in the other, then reported which felt heavier. Weber systematically varied the comparison weight across hundreds of trials to find the threshold at which participants could discriminate correctly approximately 75% of the time — the just-noticeable difference.

For a reference weight of 32 ounces, Weber found a JND of approximately 0.8 ounces — a ratio of 1/40. Crucially, when the reference weight doubled to 64 ounces, the JND also doubled to approximately 1.6 ounces. The ratio $\Delta I / I$ remained constant across a wide range of reference intensities.

The result was convincing for several reasons. First, the regularity held across many participants and many reference magnitudes. Second, Weber replicated the pattern across different senses — he found analogous constant ratios for line length discrimination and pitch discrimination, establishing that proportional sensitivity was a general feature of human perception, not a quirk of the weight-lifting task. Third, the simplicity of the relationship — a single constant per sense modality — suggested a deep organizing principle of the nervous system.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p>Weber's methodology was remarkable for its time. The two-alternative forced-choice (2AFC) design — where the participant <strong>must</strong> choose one of two options on every trial — eliminates response bias. Even if a participant tends to say "heavier," the forced choice means their accuracy still reflects genuine discriminability.</p>

<p>The threshold was typically defined using the method of limits: the comparison stimulus was gradually increased from below the reference (ascending series) or decreased from above it (descending series), and the point of transition was averaged. Modern psychophysics uses more sophisticated methods — the method of constant stimuli, adaptive staircases (QUEST, PEST), and signal detection theory — but Weber's conclusions have survived all of them.</p>

<p><strong>Key replications and refinements:</strong></p>

<ul>
<li>Fechner (1860) replicated Weber's weight experiments and extended the paradigm to brightness, showing $k \approx 0.08$ for luminance discrimination. He formalized the results into Fechner's Law: $\psi = k \ln(I/I_0)$.</li>
<li>Teghtsoonian (1971) compiled Weber fractions across dozens of modalities and confirmed the constant-ratio finding for most senses, while noting that Weber's Law breaks down at very low stimulus intensities near the absolute threshold.</li>
<li>In a modern context, Rouder & Lu (2005) applied Bayesian hierarchical models to Weber fraction estimation, showing that individual Weber fractions vary but the proportional relationship is robust at the population level.</li>
</ul>

<p>The law's limitations are important. Near the absolute threshold (very dim lights, very quiet sounds), the JND is relatively larger than Weber's Law predicts — a correction term is needed. The modified Weber's Law adds a constant: $\Delta I = k \cdot I + a$, where $a$ accounts for sensory noise at low intensities. For UI design, this is rarely an issue because most stimuli are well above threshold.</p>

</details>

## Related Studies

**Fechner (1860)** — *Elemente der Psychophysik* formalized Weber's empirical findings into the first quantitative law of psychology. Fechner introduced the concept of measuring sensation on a scale, invented the psychophysical methods still used today, and derived the logarithmic relationship between stimulus and perception.

**Stevens (1957)** — Challenged Fechner's logarithmic law with magnitude estimation experiments, where participants assigned numbers to perceived intensity. Found power functions ($\psi = k \cdot S^n$) fit better than logarithms across many modalities. This work is the basis for perceptually uniform color spaces like CIELAB.

**Teghtsoonian (1971)** — Conducted a comprehensive survey of Weber fractions across 30+ sensory continua. Confirmed the general proportionality principle while documenting that Weber fractions span roughly two orders of magnitude, from ~0.3% (pitch) to ~15% (taste intensity).

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Kingdom & Prins (2010)</strong> wrote the modern standard reference on psychophysics, <em>Psychophysics: A Practical Introduction</em>. They provide software (Palamedes toolbox) for fitting psychometric functions and estimating JNDs using maximum-likelihood methods. Their treatment shows that Weber's constant $k$ can be extracted from the slope of the psychometric function at the 75% correct threshold.</p>

<p><strong>Gescheider (1997)</strong> in <em>Psychophysics: The Fundamentals</em> reviews signal detection theory (SDT), which separates perceptual sensitivity ($d'$) from response bias ($\beta$). SDT reframed Weber's Law: the Weber fraction corresponds to a constant $d'$ criterion. This clarified that Weber's Law describes genuine sensitivity, not decision strategy.</p>

<p><strong>Stone (2012)</strong> connected psychophysics to UI design in <em>User Interface Design and Evaluation</em>, showing that contrast sensitivity functions and Weber fractions directly inform minimum contrast ratios, animation speed thresholds, and feedback timing. The WCAG 2.0 contrast ratio guidelines (4.5:1 for normal text) implicitly encode Weber-like proportional thresholds for luminance discrimination.</p>

<p><strong>Dehaene (2003)</strong> showed that Weber's Law extends to numerical cognition — humans' ability to discriminate quantities follows the same proportional rule. This finding has implications for data visualization: bar chart comparisons become harder as values get larger, consistent with Weber's Law applied to length perception.</p>

</details>

## See Also

- [Preattentive Processing](../lessons/02-preattentive-processing.md) — preattentive channels each have their own Weber fractions, determining what differences pop out
- [Feedback & Response Time](../lessons/15-feedback-response-time.md) — perceived delay thresholds follow Weber-like proportional rules

## Try It

<details>
<summary>Exercise: Calculate the Minimum Noticeable Padding Change</summary>

<p>A card component has 12px of internal padding on all sides. The design team proposes increasing it to 13px to create "a slightly more spacious feel." Will users notice the change?</p>

<p><strong>Solution:</strong></p>

<p>The Weber fraction for spatial extent is approximately $k = 0.08$ (8%).</p>

<p>Compute the JND:</p>

<p>$$\Delta I = k \times I = 0.08 \times 12\text{px} = 0.96\text{px}$$</p>

<p>A 1px change is $\Delta I / I = 1/12 \approx 8.3\%$, which just barely exceeds the Weber fraction. In theory, the change is at the threshold of detectability — some users might notice it in a side-by-side comparison, but almost no one would notice it in isolation.</p>

<p><strong>To make a clearly visible change,</strong> aim for 2-3 times the JND. That means increasing padding to at least 14px ($\Delta = 2\text{px}$, or ~17%) for users to reliably perceive the difference without a direct comparison.</p>

<p>Now consider: if the card had 48px padding, the same 1px increase would be $\Delta I / I = 1/48 \approx 2.1\%$ — well below the 8% threshold. You would need at least a 4px increase ($48 \times 0.08 = 3.84$px) for the change to be noticeable.</p>

</details>
