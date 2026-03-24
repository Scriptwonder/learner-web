# Spectral Rendering

Standard renderers work with three color channels -- red, green, blue. This is a convenient lie. Light in the real world is a continuous distribution of energy across wavelengths, and reducing it to three numbers *before* simulating light transport introduces systematic errors. **Spectral rendering** operates on full spectral power distributions, producing physically correct results for phenomena that RGB rendering gets fundamentally wrong: dispersion through glass, thin-film iridescence, fluorescence, and subtle color shifts from multiple surface interactions. Weta FX's Manuka renderer demonstrated the production viability of spectral rendering on *Avatar: The Way of Water* (2022), and the technique has since become the standard in high-end VFX.

## Why RGB Is Insufficient

### Metamerism

Two spectral power distributions (SPDs) that appear identical to the human eye under one illuminant can appear different under another. These are called **metamers**. RGB rendering collapses all metameric spectra to the same triple, losing the information needed to predict appearance under illuminant changes.

### Physically Wrong Color Mixing

When light bounces off a colored surface and then passes through a colored filter, the correct result is:

$$L_{\text{out}}(\lambda) = L_{\text{in}}(\lambda) \cdot R_{\text{surface}}(\lambda) \cdot T_{\text{filter}}(\lambda)$$

In RGB, this becomes component-wise multiplication of the three channels, which is only correct if the spectral curves can be exactly represented by the RGB basis functions. In general, they cannot. The error accumulates with each interaction, and after several bounces the color can be noticeably wrong.

### Wavelength-Dependent Phenomena

Some effects are *impossible* to represent in RGB:

| Phenomenon | Requires |
|-----------|----------|
| Dispersion | Wavelength-dependent index of refraction |
| Thin-film interference | Phase differences at specific wavelengths |
| Fluorescence | Absorption at one wavelength, emission at another |
| Atmospheric scattering | Rayleigh $\propto \lambda^{-4}$ |

## The Electromagnetic Spectrum for Rendering

Human vision spans approximately **380 nm** (violet) to **780 nm** (deep red). A spectral renderer discretizes this range into $N$ bins (commonly $N = 4$ to $N = 80$, depending on the application).

### Spectral Power Distribution (SPD)

An SPD $\Phi(\lambda)$ describes the power per unit wavelength emitted by a light source. Examples:

- **Daylight (D65)**: broad, roughly uniform with a peak near 460 nm
- **Sodium lamp**: sharp spike at 589 nm
- **LED**: narrow-band peaks with phosphor-broadened emission

### Spectral Reflectance

A surface's reflectance $R(\lambda) \in [0, 1]$ specifies the fraction of incident light reflected at each wavelength. A "red" apple has $R(\lambda)$ near 1 for $\lambda > 600\,\text{nm}$ and near 0 for $\lambda < 550\,\text{nm}$.

## CIE XYZ Color Matching Functions

To convert a spectral result to a displayable color, we integrate against the **CIE 1931 color matching functions** $\bar{x}(\lambda)$, $\bar{y}(\lambda)$, $\bar{z}(\lambda)$:

$$X = \int_{380}^{780} \Phi(\lambda) \, \bar{x}(\lambda) \, d\lambda, \quad
Y = \int_{380}^{780} \Phi(\lambda) \, \bar{y}(\lambda) \, d\lambda, \quad
Z = \int_{380}^{780} \Phi(\lambda) \, \bar{z}(\lambda) \, d\lambda$$

The resulting $(X, Y, Z)$ tristimulus values are then converted to a display color space (e.g., sRGB) via a $3 \times 3$ matrix:

$$\begin{bmatrix} R_{\text{linear}} \\ G_{\text{linear}} \\ B_{\text{linear}} \end{bmatrix}
= \mathbf{M}_{\text{XYZ} \to \text{sRGB}}
\begin{bmatrix} X \\ Y \\ Z \end{bmatrix}$$

followed by gamma correction.

## Dispersion: Wavelength-Dependent Refraction

### Snell's Law (Spectral)

When light enters a medium, the refraction angle depends on the wavelength-dependent index of refraction $n(\lambda)$:

$$n_1(\lambda) \sin \theta_1 = n_2(\lambda) \sin \theta_2(\lambda)$$

### Cauchy's Equation

A simple empirical model for $n(\lambda)$:

$$n(\lambda) = A + \frac{B}{\lambda^2} + \frac{C}{\lambda^4}$$

For BK7 glass: $A = 1.5046$, $B = 4.20 \times 10^{-3}\,\mu\text{m}^2$, $C \approx 0$. Shorter wavelengths (blue) refract more than longer wavelengths (red).

### Sellmeier Equation

More accurate over a wider range:

$$n^2(\lambda) = 1 + \sum_{i=1}^{k} \frac{B_i \lambda^2}{\lambda^2 - C_i}$$

where $B_i$ and $C_i$ are material-specific constants (typically $k = 3$). This is the standard in optical engineering and production rendering.

## Thin-Film Interference

A thin film of thickness $d$ and refractive index $n_f$ creates constructive or destructive interference depending on the optical path difference:

$$\Delta = 2 \, n_f \, d \, \cos \theta_t$$

where $\theta_t$ is the refraction angle inside the film. Constructive interference occurs when:

$$\Delta = m \lambda, \quad m = 0, 1, 2, \ldots$$

(accounting for phase shifts at interfaces). The reflectance at each wavelength oscillates:

$$R(\lambda) \propto \cos^2\!\left(\frac{\pi \, \Delta}{\lambda}\right)$$

This produces the iridescent colors seen in soap bubbles, oil slicks, and beetle shells. Each wavelength experiences a different phase relationship, so the reflected color varies with thickness $d$ and viewing angle $\theta$.

## Fluorescence

Fluorescent materials absorb photons at one wavelength and re-emit them at a **longer** wavelength (the **Stokes shift**). This is fundamentally a spectral phenomenon -- an RGB renderer cannot represent energy transfer between color channels.

### Reradiation Matrix

Fluorescence is described by a **reradiation matrix** $\mathbf{F}(\lambda_{\text{out}}, \lambda_{\text{in}})$ where entry $(i, j)$ gives the probability that a photon absorbed at wavelength $\lambda_j$ is re-emitted at wavelength $\lambda_i$:

$$L_{\text{out}}(\lambda_i) = \sum_j \mathbf{F}(\lambda_i, \lambda_j) \, L_{\text{in}}(\lambda_j)$$

The Stokes shift constraint means $\mathbf{F}$ is lower-triangular (emission wavelength $\geq$ absorption wavelength). Common examples: UV-brightened paper, fluorescent dyes, coral reef organisms under blue light.

## Spectral Upsampling

Most existing texture assets are in RGB. **Spectral upsampling** converts them to plausible spectral reflectance curves.

### Jakob & Hanika (2019)

The key insight: parameterize spectral reflectance as a **sigmoid of a polynomial** evaluated at each wavelength:

$$R(\lambda) = \frac{1}{2} + \frac{1}{2} \cdot \text{smoothstep}\!\left(\frac{c_0 \lambda^2 + c_1 \lambda + c_2}{k}\right)$$

The three coefficients $(c_0, c_1, c_2)$ are stored in a precomputed 3D lookup table indexed by sRGB. This is:

- **Compact**: 3 floats per texel (same as RGB)
- **Smooth**: produces band-limited spectra without ringing
- **Accurate**: round-trips through CIE XYZ to match the original RGB under the target illuminant

Mitsuba 3 and PBRT v4 both implement this method.

### Controlled Spectral Uplifting (Lian et al. 2024)

Presented at SIGGRAPH Asia 2024, this method extends spectral upsampling to control **indirect-light metamerism**: ensuring that upsampled spectra not only match under direct illumination but also behave correctly after interreflection in complex scenes.

## Hero Wavelength Sampling (Wilkie et al. 2014)

Tracing a separate ray for every wavelength bin would multiply rendering cost by $N$. **Hero wavelength sampling** is the standard solution:

1. **Sample one "hero" wavelength** $\lambda_h$ uniformly from the visible range
2. **Choose companion wavelengths** $\lambda_1, \lambda_2, \lambda_3$ equally spaced across the spectrum (e.g., $\lambda_h$, $\lambda_h + \frac{400}{4}$, $\lambda_h + \frac{2 \cdot 400}{4}$, $\lambda_h + \frac{3 \cdot 400}{4}$, all wrapped modulo the visible range)
3. **Trace one ray path** guided by the hero wavelength (all direction sampling, Russian roulette, etc. use $\lambda_h$)
4. **Evaluate all 4 wavelengths** along the same path using multiple importance sampling (MIS)

This gives a **4-wavelength spectral estimate** at the cost of a single path trace. The even spacing ensures that the visible spectrum is uniformly covered in expectation.

Weta FX's Manuka was the first major production renderer to adopt hero wavelength spectral sampling, using it on all shots of *Avatar: The Way of Water* (2022). PBRT v4 and Mitsuba 3 also implement this strategy.

## Worked Example: Dispersed Ray Directions Through a Glass Prism

A ray hits a glass prism at incidence angle $\theta_1 = 45°$. Compute the refracted direction for three wavelengths using the Cauchy equation with $A = 1.5220$, $B = 4.59 \times 10^{-3}\,\mu\text{m}^2$.

### Step 1: Compute Refractive Indices

For $\lambda = 450\,\text{nm}$ (blue), $550\,\text{nm}$ (green), $650\,\text{nm}$ (red):

$$n(\lambda) = A + \frac{B}{\lambda^2}$$

| Wavelength | $\lambda$ ($\mu$m) | $\lambda^2$ | $B / \lambda^2$ | $n(\lambda)$ |
|-----------|---------------------|-------------|-----------------|--------------|
| 450 nm | 0.450 | 0.2025 | 0.02267 | **1.5447** |
| 550 nm | 0.550 | 0.3025 | 0.01517 | **1.5372** |
| 650 nm | 0.650 | 0.4225 | 0.01087 | **1.5329** |

### Step 2: Apply Snell's Law

Entering from air ($n_1 = 1.0$), $\theta_1 = 45°$, $\sin\theta_1 = 0.7071$:

$$\sin \theta_2(\lambda) = \frac{\sin \theta_1}{n(\lambda)} = \frac{0.7071}{n(\lambda)}$$

| Wavelength | $n(\lambda)$ | $\sin \theta_2$ | $\theta_2$ |
|-----------|--------------|-----------------|-----------|
| 450 nm | 1.5447 | 0.4579 | **27.25°** |
| 550 nm | 1.5372 | 0.4601 | **27.39°** |
| 650 nm | 1.5329 | 0.4614 | **27.47°** |

### Step 3: Angular Spread (Dispersion)

$$\Delta\theta = \theta_{2,\text{red}} - \theta_{2,\text{blue}} = 27.47° - 27.25° = \mathbf{0.22°}$$

This small angular spread fans out further at the exit face, producing the familiar rainbow pattern. A spectral renderer traces each wavelength along its own refracted direction, while an RGB renderer would use a single average $n$ and miss the spread entirely.

```python
import numpy as np

def cauchy_n(wavelength_um, A=1.5220, B=4.59e-3):
    """Cauchy equation: n(lambda) = A + B / lambda^2"""
    return A + B / wavelength_um**2

def snell_refract(sin_theta_i, n1, n2):
    """Snell's law: returns sin(theta_t)"""
    return n1 * sin_theta_i / n2

wavelengths = [0.450, 0.550, 0.650]  # micrometers
theta_i = np.radians(45)

for wl in wavelengths:
    n = cauchy_n(wl)
    sin_t = snell_refract(np.sin(theta_i), 1.0, n)
    theta_t = np.degrees(np.arcsin(sin_t))
    print(f"λ = {wl*1000:.0f} nm: n = {n:.4f}, θ₂ = {theta_t:.2f}°")

# λ = 450 nm: n = 1.5447, θ₂ = 27.25°
# λ = 550 nm: n = 1.5372, θ₂ = 27.39°
# λ = 650 nm: n = 1.5329, θ₂ = 27.47°
```

<details>
<summary><strong>Exercise 1</strong>: CIE XYZ Conversion</summary>

A monochromatic light source at $\lambda = 550\,\text{nm}$ has spectral radiance $\Phi(\lambda) = \delta(\lambda - 550)$. Using approximate CIE values $\bar{x}(550) = 0.4334$, $\bar{y}(550) = 0.9950$, $\bar{z}(550) = 0.0087$, compute the XYZ tristimulus values.

**Solution**: Since $\Phi(\lambda) = \delta(\lambda - 550)$:

$$X = \bar{x}(550) = 0.4334, \quad Y = \bar{y}(550) = 0.9950, \quad Z = \bar{z}(550) = 0.0087$$

This is a nearly monochromatic green -- high $Y$ (luminance), moderate $X$, negligible $Z$.
</details>

<details>
<summary><strong>Exercise 2</strong>: Thin-Film Constructive Interference</summary>

A soap film has thickness $d = 300\,\text{nm}$ and refractive index $n_f = 1.33$. At normal incidence ($\theta_t = 0$), find the wavelengths of constructive interference in the visible range.

**Solution**: The optical path difference is $\Delta = 2 n_f d = 2 \times 1.33 \times 300 = 798\,\text{nm}$.

Including the $\lambda/2$ phase shift from the top surface reflection (going from low to high $n$):

Constructive: $\Delta = (m + \tfrac{1}{2})\lambda$, so $\lambda = \frac{798}{m + 0.5}$

- $m = 0$: $\lambda = 1596\,\text{nm}$ (infrared, invisible)
- $m = 1$: $\lambda = 532\,\text{nm}$ (green -- visible!)
- $m = 2$: $\lambda = 319\,\text{nm}$ (ultraviolet, invisible)

So the film appears **green** at normal incidence.
</details>

<details>
<summary><strong>Exercise 3</strong>: Hero Wavelength Spacing</summary>

The visible range is 380--780 nm (width 400 nm). A hero wavelength is sampled at $\lambda_h = 420\,\text{nm}$. Compute the four companion wavelengths using equal spacing with wrap-around.

**Solution**: Spacing = $400 / 4 = 100\,\text{nm}$. The four wavelengths:

- $\lambda_1 = 420\,\text{nm}$
- $\lambda_2 = 420 + 100 = 520\,\text{nm}$
- $\lambda_3 = 420 + 200 = 620\,\text{nm}$
- $\lambda_4 = 420 + 300 = 720\,\text{nm}$

All are within [380, 780], so no wrap-around needed. These four wavelengths evenly cover the visible range and will produce a low-variance spectral estimate.
</details>

<details>
<summary><strong>Exercise 4</strong>: Fluorescence Stokes Shift</summary>

A fluorescent material absorbs at $\lambda_{\text{abs}} = 365\,\text{nm}$ (UV) and emits at $\lambda_{\text{emit}} = 450\,\text{nm}$ (blue).

(a) Compute the energy of the absorbed and emitted photons ($E = hc/\lambda$, with $hc = 1240\,\text{eV}\cdot\text{nm}$).

(b) What fraction of the photon energy is lost as heat?

**Solution**:

(a) $E_{\text{abs}} = 1240 / 365 = 3.397\,\text{eV}$, $E_{\text{emit}} = 1240 / 450 = 2.756\,\text{eV}$

(b) Energy lost $= 3.397 - 2.756 = 0.641\,\text{eV}$. Fraction $= 0.641 / 3.397 = 18.9\%$.

This Stokes energy loss is always positive (emission wavelength > absorption wavelength) and is dissipated as heat in the material.
</details>

## Key Takeaways

- **RGB rendering is an approximation** that fails for dispersion, thin-film interference, fluorescence, and accurate multi-bounce color
- Light is characterized by its **spectral power distribution** $\Phi(\lambda)$; surfaces by their **spectral reflectance** $R(\lambda)$
- The **CIE XYZ color matching functions** convert spectral results to displayable colors
- **Dispersion** arises from wavelength-dependent $n(\lambda)$, modeled by the Cauchy or Sellmeier equations
- **Thin-film interference** produces iridescent colors from optical path differences in thin coatings
- **Fluorescence** requires a reradiation matrix to model wavelength-shifting absorption and emission
- **Spectral upsampling** (Jakob & Hanika 2019) converts RGB textures to spectra with minimal storage overhead
- **Hero wavelength sampling** (Wilkie et al. 2014) makes spectral path tracing practical by tracing one path for 4 stratified wavelengths
- Production adoption is growing: Weta FX's Manuka used spectral rendering throughout *Avatar: The Way of Water*
