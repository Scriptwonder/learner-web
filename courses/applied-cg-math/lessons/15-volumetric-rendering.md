# Volumetric Rendering

Not all scenes are made of hard surfaces. Fog, clouds, smoke, fire, oceans, skin, marble -- these all involve light traveling *through* matter, being absorbed, scattered, and sometimes re-emitted along the way. **Volumetric rendering** (or participating media rendering) simulates this transport, extending the rendering equation from surfaces into 3D volumes. This lesson covers the core math -- the Beer-Lambert law, the volume rendering equation, phase functions -- and the practical algorithms used to evaluate them: ray marching, delta tracking, and the recent advances in null-scattering estimators that have transformed production cloud rendering.

## Participating Media

A **participating medium** is any region of space where light interacts with matter distributed throughout a volume (rather than concentrated on a surface). Three interactions can occur at any point:

### Absorption

Light is converted to heat. Characterized by the **absorption coefficient** $\sigma_a(\mathbf{x})$ (units: $\text{m}^{-1}$). Higher $\sigma_a$ means the medium absorbs more light per unit distance.

### Out-Scattering

Light is deflected away from its current direction. Characterized by the **scattering coefficient** $\sigma_s(\mathbf{x})$. The light is not destroyed -- it continues in a new direction.

### Emission

The medium itself radiates light (e.g., fire, hot gas, bioluminescence). Characterized by an emission term $L_e(\mathbf{x}, \omega)$.

### Extinction Coefficient

The combined rate of light loss is the **extinction coefficient**:

$$\sigma_t(\mathbf{x}) = \sigma_a(\mathbf{x}) + \sigma_s(\mathbf{x})$$

The **single-scattering albedo** $\alpha = \sigma_s / \sigma_t$ gives the probability that an extinction event is scattering (rather than absorption). For clouds, $\alpha \approx 0.999$ (almost pure scattering); for smoke, $\alpha \approx 0.3$--$0.9$.

## Beer-Lambert Law

For a ray traveling through a homogeneous medium with extinction $\sigma_t$ over distance $d$, the fraction of light that survives (the **transmittance**) is:

$$T(d) = e^{-\sigma_t \, d}$$

For a heterogeneous medium where $\sigma_t$ varies along the ray:

$$T(a, b) = \exp\!\left(-\int_a^b \sigma_t(\mathbf{r}(t)) \, dt\right)$$

The integral $\tau(a,b) = \int_a^b \sigma_t(\mathbf{r}(t))\,dt$ is called the **optical depth** (or optical thickness). When $\tau \gg 1$, the medium is **optically thick** (opaque); when $\tau \ll 1$, it is **optically thin** (transparent).

## The Volume Rendering Equation

The full radiance along a ray $\mathbf{r}(t) = \mathbf{o} + t\hat{\omega}$ through a participating medium is:

$$L(\mathbf{o}, \hat{\omega}) = \underbrace{T(0, t_{\text{max}}) \, L_{\text{surface}}}_{\text{attenuated background}} + \int_0^{t_{\text{max}}} T(0, t) \left[ \underbrace{\sigma_a(\mathbf{r}(t)) \, L_e(\mathbf{r}(t), \hat{\omega})}_{\text{emission}} + \underbrace{\sigma_s(\mathbf{r}(t)) \, L_i(\mathbf{r}(t), \hat{\omega})}_{\text{in-scattering}} \right] dt$$

where the **in-scattered radiance** gathers light from all directions:

$$L_i(\mathbf{x}, \hat{\omega}) = \int_{S^2} f_p(\mathbf{x}, \hat{\omega}', \hat{\omega}) \, L(\mathbf{x}, \hat{\omega}') \, d\hat{\omega}'$$

Here $f_p$ is the **phase function** -- the volumetric analogue of the BRDF.

## Phase Functions

The phase function $f_p(\hat{\omega}', \hat{\omega})$ describes the angular distribution of scattered light. It must be normalized:

$$\int_{S^2} f_p(\hat{\omega}', \hat{\omega}) \, d\hat{\omega}' = 1$$

### Isotropic

$$f_p = \frac{1}{4\pi}$$

Light scatters equally in all directions. Unrealistic for most natural media but useful as a baseline.

### Rayleigh Scattering

$$f_p(\cos\theta) = \frac{3}{16\pi}(1 + \cos^2\theta)$$

Models scattering by particles much smaller than the wavelength (air molecules). The $\lambda^{-4}$ cross-section dependence (not in the phase function itself, but in $\sigma_s$) makes blue light scatter more, producing blue skies and red sunsets.

### Henyey-Greenstein (HG)

The workhorse of volumetric rendering:

$$f_{\text{HG}}(\cos\theta; g) = \frac{1}{4\pi} \cdot \frac{1 - g^2}{(1 + g^2 - 2g\cos\theta)^{3/2}}$$

The **asymmetry parameter** $g \in (-1, 1)$ controls the scattering:

| $g$ value | Behavior |
|-----------|----------|
| $g = 0$ | Isotropic |
| $g \to 1$ | Strong forward scattering |
| $g \to -1$ | Strong backward scattering |
| $g \approx 0.8$ | Typical for clouds |
| $g \approx 0.85$ | Typical for fog/haze |

**Key property**: the HG phase function is analytically invertible, making it efficient to importance-sample in Monte Carlo rendering:

$$\cos\theta = \frac{1}{2g}\left(1 + g^2 - \left(\frac{1 - g^2}{1 - g + 2g\xi}\right)^2\right)$$

where $\xi \in [0, 1)$ is a uniform random number.

### Double Henyey-Greenstein

A mixture of forward and backward HG lobes, used for more realistic cloud scattering:

$$f_{\text{dHG}} = w \cdot f_{\text{HG}}(\cos\theta; g_1) + (1 - w) \cdot f_{\text{HG}}(\cos\theta; g_2)$$

Typical values: $g_1 = 0.8$ (forward), $g_2 = -0.3$ (backward), $w = 0.7$.

## Single Scattering Approximation

The full VRE is recursive (scattered light can scatter again, and again...). The **single-scattering approximation** assumes light scatters at most once:

$$L_{\text{single}}(\mathbf{o}, \hat{\omega}) = \int_0^{t_{\max}} T(0, t) \, \sigma_s(\mathbf{r}(t)) \left[\sum_{\text{lights}} f_p(\hat{\omega}_L, \hat{\omega}) \, V(\mathbf{r}(t), \mathbf{p}_L) \, L_{\text{light}} \, T(\mathbf{r}(t), \mathbf{p}_L)\right] dt$$

where $V$ is a visibility test to the light and $T(\mathbf{r}(t), \mathbf{p}_L)$ is the transmittance from the scatter point to the light. This is a good approximation for thin media (fog, haze) but fails for optically thick media (dense clouds, milk) where multiple scattering dominates.

## Ray Marching

### Basic Algorithm

The simplest way to evaluate the volume rendering integral: step along the ray at fixed intervals $\Delta t$, accumulating transmittance and in-scattering:

```
T_accumulated = 1.0
L_accumulated = 0.0

for each step t along the ray:
    sigma_t = sample_extinction(r(t))
    sigma_s = sample_scattering(r(t))

    # Transmittance through this step
    T_step = exp(-sigma_t * dt)

    # In-scattering (single scattering to light)
    L_in = sigma_s * phase(w_light, w_ray) * light_visibility(r(t))

    # Accumulate
    L_accumulated += T_accumulated * (1 - T_step) * L_in / sigma_t
    T_accumulated *= T_step

    # Early termination
    if T_accumulated < 0.001:
        break
```

### Step Size Selection

- Too large: misses density variations, produces banding artifacts
- Too small: wastes computation in empty regions
- Adaptive: use larger steps in low-density regions, smaller steps near surfaces

### Practical: GLSL Volumetric Fog Shader

```glsl
// Volumetric fog ray marching - single scattering
// Assumes a constant-density fog slab from y=0 to y=fogHeight

uniform vec3 lightDir;       // normalized direction to light
uniform vec3 lightColor;     // light RGB intensity
uniform float fogDensity;    // sigma_t (extinction coefficient)
uniform float fogAlbedo;     // sigma_s / sigma_t
uniform float fogHeight;     // height of fog slab
uniform float hgG;           // Henyey-Greenstein g parameter
uniform int   numSteps;      // ray march step count

// Henyey-Greenstein phase function
float phaseHG(float cosTheta, float g) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * cosTheta;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(denom, 1.5));
}

// Beer-Lambert transmittance
float transmittance(float sigmaT, float dist) {
    return exp(-sigmaT * dist);
}

// Check if point is inside the fog slab
float fogDensityAt(vec3 p) {
    return (p.y >= 0.0 && p.y <= fogHeight) ? fogDensity : 0.0;
}

// Main volumetric ray march
vec4 raymarchFog(vec3 rayOrigin, vec3 rayDir, float tNear, float tFar) {
    float dt = (tFar - tNear) / float(numSteps);
    float cosTheta = dot(rayDir, lightDir);
    float phase = phaseHG(cosTheta, hgG);

    float T = 1.0;           // accumulated transmittance
    vec3  L = vec3(0.0);     // accumulated in-scattered radiance

    for (int i = 0; i < numSteps; i++) {
        float t = tNear + (float(i) + 0.5) * dt;
        vec3 pos = rayOrigin + t * rayDir;

        float sigmaT = fogDensityAt(pos);
        if (sigmaT < 0.001) continue;

        float sigmaS = sigmaT * fogAlbedo;

        // Transmittance through this step
        float Tstep = transmittance(sigmaT, dt);

        // Shadow ray: transmittance from scatter point to top of fog
        float shadowDist = (fogHeight - pos.y) / max(lightDir.y, 0.001);
        float Tshadow = transmittance(sigmaT, max(shadowDist, 0.0));

        // In-scattering contribution
        vec3 Lin = sigmaS * phase * lightColor * Tshadow;

        // Integrate: energy deposited in this step
        // Using exact integration: (1 - exp(-sigma_t * dt)) / sigma_t
        float integFactor = (1.0 - Tstep) / max(sigmaT, 0.001);
        L += T * Lin * integFactor;

        // Update transmittance
        T *= Tstep;

        // Early exit if almost fully opaque
        if (T < 0.001) break;
    }

    return vec4(L, 1.0 - T);  // rgb = in-scattered light, a = opacity
}
```

## Delta Tracking (Woodcock Tracking)

Ray marching with fixed steps is biased (it misses features between samples) and inefficient (uniform steps waste work in empty regions). **Delta tracking** is an unbiased, stochastic alternative.

### Core Idea

1. Choose a **majorant** $\bar{\sigma}_t \geq \max_{\mathbf{x}} \sigma_t(\mathbf{x})$ -- an upper bound on the extinction
2. Sample a free-flight distance: $t_{\text{free}} = -\frac{\ln \xi}{\bar{\sigma}_t}$, where $\xi \sim U(0,1)$
3. At the sampled point $\mathbf{r}(t)$, compute the **null-collision probability**: $P_{\text{null}} = 1 - \frac{\sigma_t(\mathbf{r}(t))}{\bar{\sigma}_t}$
4. With probability $P_{\text{null}}$, the collision is **fictitious** (null scattering) -- continue tracking. Otherwise, a **real** interaction occurs.

This effectively "homogenizes" the medium by adding fictitious matter that does not affect light transport. The result is mathematically equivalent to sampling from the true heterogeneous medium, but uses the simple exponential free-flight distribution of a homogeneous medium.

```python
def delta_tracking(ray, sigma_t_field, majorant):
    """
    Unbiased free-flight sampling in heterogeneous media.
    Returns: (t, did_scatter) -- distance and whether real scatter occurred
    """
    t = 0.0
    while True:
        # Sample free-flight distance from homogeneous distribution
        t += -math.log(random.random()) / majorant

        if t > ray.t_max:
            return ray.t_max, False  # escaped the medium

        # Accept/reject: is this a real or null collision?
        sigma_t_local = sigma_t_field.evaluate(ray.at(t))
        if random.random() < sigma_t_local / majorant:
            return t, True  # real collision
        # else: null collision, continue tracking
```

### The Majorant Problem

If $\bar{\sigma}_t \gg \sigma_t(\mathbf{x})$ (the bound is too loose), most collisions are null -- wasting computation. Solutions:

- **Spatial decomposition**: divide the volume into cells, each with a local majorant
- **Brick maps**: hierarchical spatial structure with tight per-brick bounds
- **Super-voxels**: used in production cloud rendering (Weta, Pixar)

## Advanced Tracking Methods

### Ratio Tracking (Novak et al. 2014)

Instead of accept/reject, ratio tracking **accumulates** a weight at each sample point:

$$T(a, b) \approx \prod_{i} \left(1 - \frac{\sigma_t(\mathbf{r}(t_i))}{\bar{\sigma}_t}\right)$$

where $t_i$ are sampled at rate $\bar{\sigma}_t$. This produces a **continuous estimate** of transmittance without branching, making it ideal for shadow rays.

### Residual Ratio Tracking (Novak et al. 2014)

Combines an analytic transmittance from a **control density** $\sigma_c$ with ratio tracking on the residual:

$$T(a, b) = \underbrace{e^{-\sigma_c \cdot (b-a)}}_{\text{analytic control}} \cdot \underbrace{\prod_i \left(1 - \frac{\sigma_t(\mathbf{r}(t_i)) - \sigma_c}{\bar{\sigma}_t - \sigma_c}\right)}_{\text{ratio tracking on residual}}$$

Choosing $\sigma_c$ close to the average density dramatically reduces variance.

### Progressive Null-Tracking (Misso et al. 2023)

A SIGGRAPH 2023 contribution: instead of requiring a known majorant, this method **progressively updates** the majorant estimate as the renderer explores the volume. If the majorant underestimates the true density, the method detects this and corrects, ensuring the running average converges to the correct result. This eliminates the need for a conservative preprocessing pass to find the global maximum density.

### Spectral and Decomposition Tracking (Kutz et al. 2017)

For spectrally-varying media, decomposition tracking separates the extinction into analytic and residual components per wavelength, allowing efficient spectral volume rendering.

## Worked Example: Ray March Through a Constant-Density Fog Slab

A camera ray enters a fog slab ($\sigma_t = 0.5\,\text{m}^{-1}$, $\sigma_s = 0.45\,\text{m}^{-1}$, albedo $= 0.9$) at $t = 0$ and exits at $t = 10\,\text{m}$. A directional light shines from directly above with intensity $I_L = 1.0$. The phase function is HG with $g = 0.8$. The ray direction makes an angle of $60°$ with the light direction. Compute the accumulated in-scattering and transmittance using 5 steps.

### Setup

- Step size: $\Delta t = 10 / 5 = 2\,\text{m}$
- Sample points: $t = 1, 3, 5, 7, 9$ (midpoints)
- $\cos\theta = \cos(60°) = 0.5$
- Phase: $f_{\text{HG}}(0.5; 0.8) = \frac{1 - 0.64}{4\pi(1 + 0.64 - 0.8)^{3/2}} = \frac{0.36}{4\pi(0.84)^{3/2}} = \frac{0.36}{4\pi \cdot 0.7699} = \frac{0.36}{9.671} = 0.03723$

### Step-by-Step

For constant density, $T(0, t) = e^{-0.5 t}$ and $T_{\text{shadow}} = 1.0$ (light from above, thin slab).

The in-scattering per step: $\Delta L = T(0, t_i) \cdot \sigma_s \cdot f_{\text{HG}} \cdot I_L \cdot T_{\text{shadow}} \cdot \Delta t$

| Step | $t_i$ | $T(0, t_i)$ | $\Delta L$ |
|------|--------|-------------|-----------|
| 1 | 1 m | $e^{-0.5}$ = 0.6065 | $0.6065 \times 0.45 \times 0.03723 \times 1.0 \times 2 = 0.02032$ |
| 2 | 3 m | $e^{-1.5}$ = 0.2231 | $0.2231 \times 0.45 \times 0.03723 \times 1.0 \times 2 = 0.00748$ |
| 3 | 5 m | $e^{-2.5}$ = 0.0821 | $0.0821 \times 0.45 \times 0.03723 \times 1.0 \times 2 = 0.00275$ |
| 4 | 7 m | $e^{-3.5}$ = 0.0302 | $0.0302 \times 0.45 \times 0.03723 \times 1.0 \times 2 = 0.00101$ |
| 5 | 9 m | $e^{-4.5}$ = 0.0111 | $0.0111 \times 0.45 \times 0.03723 \times 1.0 \times 2 = 0.00037$ |

**Total in-scattering**: $L = 0.02032 + 0.00748 + 0.00275 + 0.00101 + 0.00037 = \mathbf{0.03193}$

**Final transmittance**: $T(0, 10) = e^{-5.0} = \mathbf{0.00674}$ (99.3% of background light is absorbed)

The fog is optically thick ($\tau = 5.0$), so very little background light survives, and most of the visible radiance comes from in-scattering in the first few meters.

<details>
<summary><strong>Exercise 1</strong>: Beer-Lambert Transmittance</summary>

A laser beam ($\lambda = 532\,\text{nm}$) passes through 20 cm of murky water with $\sigma_t = 8.0\,\text{m}^{-1}$. What fraction of the beam reaches the other side?

**Solution**:

$$T = e^{-\sigma_t \cdot d} = e^{-8.0 \times 0.20} = e^{-1.6} = 0.2019$$

About 20.2% of the light survives. The optical depth is $\tau = 1.6$, which is moderate.
</details>

<details>
<summary><strong>Exercise 2</strong>: HG Phase Function Values</summary>

Compute $f_{\text{HG}}(\cos\theta; g)$ for:
(a) $g = 0$, any $\theta$ (isotropic)
(b) $g = 0.8$, $\theta = 0°$ (forward)
(c) $g = 0.8$, $\theta = 180°$ (backward)

**Solution**:

(a) $f_{\text{HG}}(\cos\theta; 0) = \frac{1 - 0}{4\pi(1 + 0 - 0)^{3/2}} = \frac{1}{4\pi} \approx 0.0796$

(b) $\cos 0° = 1$: $f_{\text{HG}}(1; 0.8) = \frac{1 - 0.64}{4\pi(1 + 0.64 - 1.6)^{3/2}} = \frac{0.36}{4\pi(0.04)^{3/2}} = \frac{0.36}{4\pi \cdot 0.008} = \frac{0.36}{0.1005} = 3.582$

(c) $\cos 180° = -1$: $f_{\text{HG}}(-1; 0.8) = \frac{0.36}{4\pi(1 + 0.64 + 1.6)^{3/2}} = \frac{0.36}{4\pi(3.24)^{3/2}} = \frac{0.36}{4\pi \cdot 5.832} = \frac{0.36}{73.24} = 0.00492$

The ratio forward/backward = $3.582 / 0.00492 \approx 728$. With $g = 0.8$, light is overwhelmingly scattered forward.
</details>

<details>
<summary><strong>Exercise 3</strong>: Delta Tracking Expected Null Collisions</summary>

A medium has $\sigma_t = 0.3\,\text{m}^{-1}$ and the majorant is $\bar{\sigma}_t = 1.0\,\text{m}^{-1}$. On average, what fraction of delta-tracking collisions will be null?

**Solution**:

$$P_{\text{null}} = 1 - \frac{\sigma_t}{\bar{\sigma}_t} = 1 - \frac{0.3}{1.0} = 0.7$$

On average, 70% of collisions are null. This means 70% of the work is wasted. A tighter majorant (e.g., local per-cell bounds) would reduce this dramatically.
</details>

<details>
<summary><strong>Exercise 4</strong>: Optical Depth of Atmosphere</summary>

The Earth's atmosphere has approximately $\sigma_t \approx 0.012\,\text{km}^{-1}$ for red light at sea level, with an exponential density falloff: $\sigma_t(h) = \sigma_0 e^{-h / H}$ where $H = 8.5\,\text{km}$ (scale height). Compute the optical depth looking straight up from sea level to space.

**Solution**:

$$\tau = \int_0^{\infty} \sigma_0 \, e^{-h/H} \, dh = \sigma_0 \, H = 0.012 \times 8.5 = 0.102$$

Since $\tau = 0.102 \ll 1$, the atmosphere is optically thin for red light looking up (transmittance $T = e^{-0.102} = 0.903$, so 90.3% of starlight in the red band reaches the ground). For blue light, $\sigma_0$ is ~4x larger ($\propto \lambda^{-4}$), giving $\tau \approx 0.41$ and $T \approx 0.66$.
</details>

## Key Takeaways

- **Participating media** absorb, scatter, and emit light throughout a volume, governed by coefficients $\sigma_a$, $\sigma_s$, and $\sigma_t = \sigma_a + \sigma_s$
- **Beer-Lambert law**: transmittance $T = e^{-\sigma_t d}$ (exponential decay with optical depth)
- The **volume rendering equation** integrates emission and in-scattering along the ray, weighted by transmittance
- The **Henyey-Greenstein phase function** models anisotropic scattering with a single parameter $g$; clouds use $g \approx 0.8$ (strong forward scattering)
- **Ray marching** evaluates the VRE by stepping through the volume; fixed steps are simple but biased and can miss features
- **Delta tracking** (Woodcock tracking) is an unbiased stochastic method that "homogenizes" the medium with null collisions
- **Ratio tracking** estimates transmittance without branching; **residual ratio tracking** reduces variance with a control density
- **Progressive null-tracking** (Misso et al. 2023) eliminates the need for a precomputed majorant by updating it on the fly
- Production renderers (Manuka, RenderMan, Arnold) use hierarchical spatial structures with per-cell majorants for efficient cloud and atmosphere rendering
