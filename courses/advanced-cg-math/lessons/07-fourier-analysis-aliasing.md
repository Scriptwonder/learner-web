# Fourier Analysis and Aliasing

Every image on your screen is a sampled signal. When a triangle edge cuts diagonally across a pixel grid, the abrupt transition from foreground to background color contains infinitely high frequencies — but your pixel grid can only capture a finite number of samples per unit length. The mismatch between signal complexity and sampling rate is the root cause of aliasing: jagged edges, shimmering textures, and moiré patterns. Understanding aliasing requires Fourier analysis — the mathematical framework that decomposes signals into frequencies. This lesson builds that framework from scratch and applies it to the anti-aliasing techniques used in modern real-time rendering.

## Signals and Frequency: 1D Intuition

A **signal** is any function that varies over some domain. In CG, signals include:

- A row of pixels across a texture (1D spatial signal)
- A scanline of a rendered image (1D spatial signal)
- A sequence of frames over time (1D temporal signal)

The simplest signal is a sinusoid:

$$f(x) = A \sin(2\pi \nu x + \phi)$$

where $A$ is amplitude, $\nu$ is frequency (cycles per unit length), and $\phi$ is phase. A low-frequency sine wave varies slowly — think a gentle gradient. A high-frequency sine wave oscillates rapidly — think a fine checkerboard pattern.

**Key insight:** Any signal — no matter how complex — can be decomposed into a sum of sinusoids at different frequencies, amplitudes, and phases. This is the central idea of Fourier analysis.

## The Fourier Transform

The **Fourier transform** converts a signal from the **spatial domain** (where we see position) to the **frequency domain** (where we see which frequencies are present and how strong they are).

For a continuous 1D signal $f(x)$, the Fourier transform is:

$$F(\nu) = \int_{-\infty}^{\infty} f(x) \, e^{-2\pi i \nu x} \, dx$$

The result $F(\nu)$ is a complex-valued function of frequency $\nu$. Its magnitude $|F(\nu)|$ tells us the amplitude of frequency $\nu$ in the signal; its phase $\angle F(\nu)$ tells us the shift.

The **inverse Fourier transform** reconstructs the signal from its frequency components:

$$f(x) = \int_{-\infty}^{\infty} F(\nu) \, e^{2\pi i \nu x} \, d\nu$$

### Important Properties

| Property | Spatial Domain | Frequency Domain |
|---|---|---|
| Scaling | $f(ax)$ | $\frac{1}{|a|} F\!\left(\frac{\nu}{a}\right)$ |
| Shift | $f(x - x_0)$ | $e^{-2\pi i \nu x_0} F(\nu)$ |
| Convolution | $(f * g)(x)$ | $F(\nu) \cdot G(\nu)$ |
| Multiplication | $f(x) \cdot g(x)$ | $(F * G)(\nu)$ |

The **convolution theorem** is especially powerful: convolution in the spatial domain equals multiplication in the frequency domain, and vice versa. This is why filtering (convolution with a kernel) can be understood as shaping the frequency spectrum.

## The Sampling Theorem (Nyquist-Shannon)

When we render an image, we evaluate the continuous scene at discrete pixel locations. Mathematically, sampling a continuous signal $f(x)$ at interval $\Delta x$ produces a discrete sequence:

$$f_s[n] = f(n \cdot \Delta x), \quad n = 0, 1, 2, \ldots$$

The **sampling rate** is $f_s = \frac{1}{\Delta x}$ samples per unit length.

The **Nyquist-Shannon sampling theorem** states:

> A band-limited signal (one with no frequencies above $\nu_{\max}$) can be perfectly reconstructed from its samples if and only if the sampling rate satisfies $f_s > 2\nu_{\max}$.

The critical frequency $\nu_N = \frac{f_s}{2}$ is called the **Nyquist frequency**. Any frequency component above $\nu_N$ cannot be faithfully captured.

**Numeric example:** If your texture is sampled at 512 pixels across its width, the sampling rate is 512 samples/unit. The Nyquist frequency is 256 cycles/unit. Any pattern in the texture that oscillates faster than 256 cycles across the texture width will alias.

## Aliasing Explained

### What Happens in the Frequency Domain

Sampling in the spatial domain corresponds to **replication** (periodic copies) of the spectrum in the frequency domain. If you sample at rate $f_s$, the original spectrum $F(\nu)$ is replicated at every integer multiple of $f_s$:

$$F_s(\nu) = \frac{1}{\Delta x} \sum_{k=-\infty}^{\infty} F(\nu - k f_s)$$

When the signal is band-limited and $f_s > 2\nu_{\max}$, these copies do not overlap, and we can isolate the original spectrum with an ideal low-pass filter. When the signal contains frequencies above $\nu_N$, the copies **overlap** — this overlap is aliasing. The overlapping frequency components add together destructively, producing spurious low-frequency patterns that cannot be separated from the true signal.

### Visual Manifestation

```
Imagine a fine checkerboard texture viewed at a steep angle:

Original texture:  ████░░░░████░░░░████░░░░████░░░░
                   (high spatial frequency — many alternations)

Sampled at low rate: ████    ████    ████    ████
                     ↑       ↑       ↑       ↑
                     samples land on same color → appears solid!

With slight offset:  ░░░░    ████    ░░░░    ████
                     ↑       ↑       ↑       ↑
                     samples alternate → low-frequency stripe pattern
```

The high-frequency checkerboard has been misinterpreted as a low-frequency pattern — this is a moiré artifact, a textbook case of aliasing.

### Numeric Aliasing Example

Consider a 1D signal $f(x) = \sin(2\pi \cdot 5x)$ (5 Hz), sampled at $f_s = 8$ samples/second. The Nyquist frequency is 4 Hz. Since $5 > 4$, the signal aliases. The apparent frequency is:

$$\nu_{\text{alias}} = |5 - 8| = 3 \text{ Hz}$$

A 5 Hz sine, sampled at 8 Hz, appears identical to a 3 Hz sine. There is no way to tell them apart from the samples alone.

## Reconstruction Filters

After sampling, we need to **reconstruct** a continuous signal from discrete samples (e.g., to display a texture at arbitrary magnification). The ideal reconstruction filter in the frequency domain is a perfect rectangle (pass everything below $\nu_N$, block everything above). In the spatial domain, this corresponds to the **sinc function**:

$$\text{sinc}(x) = \frac{\sin(\pi x)}{\pi x}$$

### Practical Reconstruction Filters

The sinc function has infinite support — it extends forever in both directions — making it impractical. Real-time graphics uses finite approximations:

| Filter | Formula | Support | Quality | Cost |
|---|---|---|---|---|
| **Box (nearest)** | $1$ if $|x| < 0.5$, else $0$ | 1 pixel | Blocky, severe aliasing | Cheapest |
| **Tent (bilinear)** | $1 - |x|$ if $|x| < 1$, else $0$ | 2 pixels | Smooth but blurry | Cheap |
| **Sinc** | $\frac{\sin(\pi x)}{\pi x}$ | Infinite | Perfect (for band-limited) | Impossible |
| **Lanczos-$n$** | $\text{sinc}(x) \cdot \text{sinc}(x/n)$ if $|x| < n$ | $2n$ pixels | Excellent, slight ringing | Moderate |

**Lanczos** windows the sinc function with a wider sinc lobe, producing a filter that closely approximates the ideal low-pass while having finite support. Lanczos-2 (4-pixel support) and Lanczos-3 (6-pixel support) are common in offline rendering and image processing.

In the frequency domain:
- The **box filter** has a sinc-shaped spectrum — it passes some high frequencies and blocks some low ones (poor low-pass).
- The **tent filter** has a $\text{sinc}^2$ spectrum — better but still attenuates desired frequencies.
- **Lanczos** has a nearly rectangular passband with sharp cutoff — close to ideal.

### Frequency Domain View of Bilinear vs. Lanczos

```
Frequency response (magnitude):

1.0 |████████████████████████░░░░░░░░  ← Lanczos (sharp cutoff)
    |████████████████████░░░░░░░░░░░░
    |████████████████░░░░░░░░░░░░░░░░  ← Bilinear (gradual rolloff)
    |████████████░░░░░░░░░░░░░░░░░░░░
0.0 |░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    0        Nyquist freq        2× Nyquist
```

## Texture Filtering: Mipmaps

### The Minification Problem

When a textured surface is far from the camera, many texels map to a single screen pixel. This is extreme minification — the screen pixel must represent a large area of the texture. If you simply sample the texture at one point (nearest or bilinear), you are massively undersampling the texture signal, violating the Nyquist condition.

### Why Mipmaps Work (Frequency Domain View)

A **mipmap** is a precomputed pyramid of progressively lower-resolution copies of a texture, each half the width and height of the previous level:

- Level 0: $1024 \times 1024$ (original)
- Level 1: $512 \times 512$ (averaged $2\times 2$ blocks)
- Level 2: $256 \times 256$
- ...
- Level 10: $1 \times 1$

Each mipmap level is a **low-pass filtered** version of the original texture. By averaging $2\times 2$ blocks, we halve the maximum frequency at each level. When the GPU selects the appropriate mip level for a given screen-pixel-to-texel ratio, it is choosing a version of the texture where the highest frequency present is below the Nyquist limit for that sampling rate.

**In frequency domain terms:** mip level $k$ contains only frequencies up to $\frac{\nu_{\max}}{2^k}$. If the screen pixel covers $2^k \times 2^k$ texels, the sampling rate is $\frac{1}{2^k}$ of the original, and the Nyquist frequency is $\frac{\nu_{\max}}{2^k}$ — exactly matching the mipmap's bandwidth. Aliasing is eliminated because the prefilter has removed the offending high frequencies before sampling occurs.

**Trilinear filtering** interpolates between two adjacent mip levels, providing smooth LOD transitions and avoiding visible "mip bands."

### Anisotropic Filtering

Standard mipmaps assume **isotropic** minification — the texture is shrunk equally in both directions. But when a surface is viewed at a grazing angle, it may be compressed 8:1 horizontally but only 2:1 vertically. A single mip level that matches the maximum compression will be far too blurry in the less-compressed direction.

**Anisotropic filtering** samples multiple points along the axis of greatest compression, using a higher (sharper) mip level. This approximates a narrow, elongated reconstruction filter in texture space — sampling along the anisotropy axis while still prefiltering along the minification axis.

In frequency domain terms: the anisotropic filter applies different cutoff frequencies along different texture axes, matching the actual sampling density in each direction. This preserves detail along the axis with adequate sampling while suppressing aliasing along the axis with insufficient sampling.

Modern GPUs support 2x to 16x anisotropic filtering, with 16x sampling up to 128 texels per pixel along the anisotropy direction.

## Screen-Space Aliasing

### Jagged Edges as a High-Frequency Signal

A triangle edge crossing the pixel grid creates an abrupt transition — a step function from one color to another. A step function has infinite bandwidth (its Fourier transform decays as $\frac{1}{\nu}$ but never reaches zero). No finite sampling rate can capture it without aliasing.

The result is the familiar "staircase" or "jaggies" pattern on diagonal and curved edges. This is spatial aliasing in screen space.

### Frequency Interpretation of Jaggies

A perfectly smooth diagonal edge, when sampled on a pixel grid, produces a periodic staircase with spatial frequency related to the pixel grid spacing. The edge's true frequency content extends to infinity, but the sampling captures only frequencies below $\nu_N$, folding higher frequencies back as aliased staircase steps.

## Anti-Aliasing Techniques

### Supersampling (SSAA)

The brute-force approach: render at $N\times$ resolution, then downsample with a low-pass filter. This raises the Nyquist frequency by factor $N$, capturing more of the signal's bandwidth. Effective but extremely expensive ($4\times$ SSAA requires $4\times$ the shading work).

### MSAA (Multisample Anti-Aliasing)

MSAA takes multiple coverage samples per pixel but evaluates the fragment shader only once. Each sub-sample records whether it is inside or outside the triangle. The pixel color is the weighted average based on coverage.

**Frequency interpretation:** MSAA increases the sampling rate for geometric edges (coverage) without increasing it for shading. It effectively raises the Nyquist frequency for the binary coverage signal while keeping the shading sampling rate unchanged. This works well for edge aliasing but does nothing for aliasing within a shader (e.g., a procedural checkerboard).

Typical configurations: 2x, 4x, 8x MSAA with sample patterns optimized for common edge orientations.

### FXAA (Fast Approximate Anti-Aliasing)

FXAA is a post-process filter that detects edges in the final image by analyzing luminance gradients, then blurs along detected edges. It operates entirely in screen space on the finished frame.

**Frequency interpretation:** FXAA applies a spatially-varying low-pass filter. Along detected edges, it blurs (removes high frequencies); elsewhere, it preserves the signal. This is a heuristic approach — it cannot recover information lost to aliasing, only hide it by smoothing. The result can appear slightly soft.

### TAA (Temporal Anti-Aliasing)

TAA jitters the camera sub-pixel position each frame, accumulating samples over multiple frames. Frame $N$ might sample at offset $(+0.25, -0.125)$ pixels, frame $N+1$ at $(-0.375, +0.25)$, and so on, using patterns like Halton sequences.

**Frequency interpretation:** TAA effectively supersamples the image across time. Over $K$ frames with well-distributed jitter, the effective sampling rate approaches $K\times$ the single-frame rate. A temporal filter (typically exponential moving average with neighborhood clamping) reconstructs the high-resolution signal. The key challenge is handling motion — motion vectors must be used to reproject previous frames, and rejection/clamping heuristics prevent ghosting on disoccluded regions.

TAA has become the dominant AA technique in modern games because it amortizes the cost of supersampling across frames, approaching high sample counts essentially for free. However, it introduces temporal artifacts: ghosting (lagging detail), flickering in sub-pixel geometry, and blur on fast motion.

### DLSS, FSR, and Neural Reconstruction (2024-2026)

Modern upscaling technologies extend the TAA concept with learned reconstruction:

- **NVIDIA DLSS 4** (2025) uses a vision transformer model that replaces the previous CNN, taking the low-resolution rendered frame, motion vectors, and depth buffer to reconstruct a high-resolution output with reduced ghosting and improved temporal stability.
- **AMD FSR 4** (2025-2026) rebuilt its temporal super-resolution shader to better preserve fine geometry and suppress temporal artifacts like flicker and shimmer.
- **Intel XeSS** uses DP4a or XMX hardware for neural upscaling.

**Frequency interpretation:** These techniques are learned reconstruction filters. Where classical TAA uses a hand-tuned exponential moving average, DLSS/FSR train neural networks to optimally combine temporal information. The network learns a reconstruction filter that adapts to content — sharpening stable regions (boosting frequencies near Nyquist) while aggressively filtering unstable regions (suppressing ghosting frequencies). In essence, they implement a spatiotemporally adaptive Wiener filter, optimized via gradient descent on perceptual loss functions.

## Blue Noise vs. White Noise for Dithering

When rendering effects at low sample counts (stochastic transparency, ambient occlusion, volumetric fog), the choice of sampling noise pattern matters enormously.

### White Noise

White noise has a **flat power spectrum** — equal energy at all frequencies. Visually, white noise has clumps and gaps. Low-frequency variations cause objectionable blotchy patterns.

### Blue Noise

Blue noise has **no low-frequency content** — its power spectrum is zero near the origin and rises toward higher frequencies. Visually, blue noise samples are evenly distributed with no clumps or gaps.

```
Power spectrum:

|          ████████  ← Blue noise (energy only at high freq)
|        ██
|      ██
|    ░░
|  ░░
|░░
|████████████████████  ← White noise (flat spectrum)
+--→ frequency
  0      Nyquist
```

**Why blue noise looks better:** Human vision is most sensitive to low-frequency variations. By pushing all noise energy to high frequencies (which we perceive as a uniform "grain"), blue noise produces far less objectionable error. The perceptual quality improvement is dramatic — blue noise at 1 sample per pixel can look comparable to white noise at 4-8 samples per pixel.

**Spatiotemporal blue noise** (NVIDIA, SIGGRAPH 2022-2024) extends this concept across frames, ensuring blue noise properties hold both spatially within each frame and temporally across consecutive frames. This is critical for TAA-based denoisers, which can exploit the temporally decorrelated noise for faster convergence.

Applications include stochastic transparency, ray-traced soft shadows, ambient occlusion, and volumetric rendering. Recent work ("Blue noise for diffusion models," SIGGRAPH 2024) applies blue noise principles to diffuse Monte Carlo error in screen space.

## Code: 1D Sampling and Aliasing Demonstration

```python
import numpy as np

# Original signal: sum of two sinusoids
def signal(x):
    return np.sin(2 * np.pi * 3.0 * x) + 0.5 * np.sin(2 * np.pi * 7.0 * x)

# Sample at 10 Hz (Nyquist = 5 Hz)
# 3 Hz: below Nyquist → captured correctly
# 7 Hz: above Nyquist → aliases to |7 - 10| = 3 Hz
fs = 10.0
dt = 1.0 / fs
t_samples = np.arange(0, 1.0, dt)  # 10 samples over 1 second
y_samples = signal(t_samples)

# The 7 Hz component aliases to 3 Hz, reinforcing the 3 Hz component.
# What we reconstruct looks like a pure (amplified) 3 Hz signal —
# the 7 Hz information is irrecoverably lost.

# To avoid aliasing: sample at fs > 2 * 7 = 14 Hz minimum
fs_safe = 16.0
t_safe = np.arange(0, 1.0, 1.0 / fs_safe)
y_safe = signal(t_safe)  # Both components captured correctly
```

```glsl
// GLSL: Lanczos-2 reconstruction (1D)
float sinc(float x) {
    if (abs(x) < 1e-6) return 1.0;
    float px = 3.14159265 * x;
    return sin(px) / px;
}

float lanczos2(float x) {
    if (abs(x) >= 2.0) return 0.0;
    return sinc(x) * sinc(x / 2.0);
}

// Sample texture with Lanczos-2 filter (1D along u-axis)
vec4 sampleLanczos2(sampler2D tex, vec2 uv, float texelSize) {
    float center = uv.x / texelSize;
    int i0 = int(floor(center - 1.5));

    vec4 color = vec4(0.0);
    float weightSum = 0.0;

    for (int i = 0; i < 4; i++) {
        float samplePos = float(i0 + i) + 0.5;
        float w = lanczos2(center - samplePos);
        color += w * texture(tex, vec2(samplePos * texelSize, uv.y));
        weightSum += w;
    }

    return color / weightSum;
}
```

## Exercises

<details>
<summary>Exercise: Aliased Frequency Calculation</summary>

<p>A signal contains a frequency component at $12$ Hz. It is sampled at $f_s = 20$ Hz. What frequency will this component appear as in the sampled signal? Is there aliasing?</p>

<p><strong>Solution:</strong></p>

<p>The Nyquist frequency is $\nu_N = f_s / 2 = 10$ Hz. Since $12 > 10$, there is aliasing.</p>

<p>The aliased frequency is $\nu_{\text{alias}} = |12 - 20| = 8$ Hz. The 12 Hz component masquerades as an 8 Hz signal.</p>

<p>To capture 12 Hz faithfully, we would need $f_s > 24$ Hz.</p>
</details>

<details>
<summary>Exercise: Mipmap Level Selection</summary>

<p>A texture is $2048 \times 2048$ texels. At a certain distance, each screen pixel covers approximately $16 \times 16$ texels. Which mip level should the GPU select, and what is the effective resolution of that level?</p>

<p><strong>Solution:</strong></p>

<p>The pixel-to-texel ratio is $16:1$, so we need $2^k = 16$, giving $k = 4$. The GPU selects mip level 4.</p>

<p>Mip level 4 has resolution $\frac{2048}{2^4} = \frac{2048}{16} = 128 \times 128$ texels.</p>

<p>At this level, each texel in the mipmap corresponds to exactly one screen pixel, satisfying the Nyquist condition. The mipmap's prefiltering has removed all frequencies above $\frac{\nu_{\max}}{16}$, which matches the sampling rate.</p>
</details>

<details>
<summary>Exercise: Why MSAA Fails for Shader Aliasing</summary>

<p>A fragment shader computes a procedural checkerboard pattern with $\sin(100 \cdot u)$ where $u$ is a texture coordinate. Explain why 4x MSAA does not help with aliasing of this pattern, and what technique would work instead.</p>

<p><strong>Solution:</strong></p>

<p>4x MSAA evaluates the fragment shader only once per pixel (at the pixel center), then replicates that shaded value to all 4 sub-samples. MSAA only multi-samples the coverage test (inside/outside triangle), not the shading. Since the checkerboard aliasing is in the shading signal, not the geometric coverage, MSAA provides no benefit.</p>

<p>To fix shader aliasing, you need either: (1) analytical prefiltering — replace $\sin(100u)$ with its band-limited approximation by computing the screen-space derivatives $\frac{du}{dx}$, $\frac{du}{dy}$ and low-pass filtering the pattern; or (2) supersampling the shader (SSAA), which evaluates the shader at every sub-sample. In GLSL, the $\texttt{fwidth()}$ function provides the screen-space derivative magnitude, enabling adaptive filtering.</p>
</details>

## Key Takeaways

- The **Fourier transform** decomposes signals into frequency components; the convolution theorem links spatial filtering to frequency-domain multiplication
- The **Nyquist-Shannon theorem** requires sampling at more than $2\times$ the maximum frequency to avoid aliasing — violating this creates false low-frequency patterns
- **Aliasing** in CG appears as jagged edges (infinite-bandwidth step functions), moiré in textures (undersampled high frequencies), and temporal flicker (frame-rate too low for motion)
- **Mipmaps** are prefiltered texture pyramids that remove high frequencies before sampling, exactly matching the Nyquist limit at each LOD level
- **Anisotropic filtering** applies direction-dependent cutoff frequencies, preserving detail along well-sampled axes while filtering along under-sampled ones
- **MSAA** increases sampling for geometric edges but not shading; **FXAA** is a heuristic screen-space blur; **TAA** supersamples over time with sub-pixel jitter
- **DLSS/FSR** are learned reconstruction filters that implement content-adaptive spatiotemporal filtering, extending classical TAA with neural networks
- **Blue noise** concentrates error at high frequencies where human vision is insensitive, dramatically improving perceptual quality at low sample counts compared to white noise
