# Sampling and Monte Carlo Methods

Evaluating the rendering equation analytically is impossible for all but the simplest scenes. Monte Carlo integration provides the general-purpose numerical solution: estimate integrals by averaging random samples. This lesson covers the probability foundations, hemisphere sampling strategies, importance sampling, multiple importance sampling, low-discrepancy sequences, and the structure of a practical path tracer.

## The Numerical Integration Problem

The rendering equation requires evaluating an integral over the hemisphere at every shading point:

$$L_o(\mathbf{p}, \omega_o) = \int_{\Omega} f_r(\mathbf{p}, \omega_i, \omega_o) \, L_i(\mathbf{p}, \omega_i) \, \cos\theta_i \, d\omega_i$$

This integral has no closed-form solution for general scenes. Traditional quadrature (e.g., Simpson's rule) works poorly in high dimensions — the number of sample points grows exponentially with dimension (the "curse of dimensionality"). Monte Carlo methods avoid this by using random sampling with a convergence rate independent of dimension.

## The Monte Carlo Estimator

Given an integral $I = \int_a^b g(x) \, dx$, the Monte Carlo estimator draws $N$ random samples $x_1, \ldots, x_N$ from a probability distribution $p(x)$ and computes:

$$\langle I \rangle_N = \frac{1}{N} \sum_{i=1}^{N} \frac{g(x_i)}{p(x_i)}$$

**Properties:**
- **Unbiased:** $E[\langle I \rangle_N] = I$ regardless of $N$.
- **Convergence rate:** The standard error decreases as $O(1/\sqrt{N})$. To halve the noise, you need 4x the samples.
- **Dimension-independent:** The $O(1/\sqrt{N})$ rate holds whether the integral is 1D or 1000D.

The division by $p(x_i)$ is critical — it corrects for the non-uniform distribution of samples. If samples are drawn uniformly over $[a,b]$, then $p(x) = \frac{1}{b-a}$ and the estimator reduces to $(b-a) \cdot \frac{1}{N}\sum g(x_i)$.

## Probability Essentials

### Probability Density Function (PDF)

A PDF $p(x)$ describes the relative likelihood of drawing value $x$. It satisfies:

- $p(x) \geq 0$ for all $x$
- $\int_{-\infty}^{\infty} p(x) \, dx = 1$

### Cumulative Distribution Function (CDF)

$$P(x) = \int_{-\infty}^{x} p(t) \, dt$$

The CDF gives the probability that a random variable takes a value $\leq x$. It ranges from 0 to 1 and is monotonically non-decreasing.

### Inverse Transform Sampling

To generate samples from a distribution with CDF $P(x)$:

1. Draw $\xi \sim \text{Uniform}(0, 1)$
2. Return $x = P^{-1}(\xi)$

This is the fundamental technique for generating non-uniform random samples from uniform ones. It works because $P^{-1}(\xi)$ is distributed according to $p(x)$.

## Uniform Hemisphere Sampling

The simplest approach: distribute sample directions uniformly over the hemisphere $\Omega$.

In spherical coordinates $(\theta, \phi)$ where $\theta \in [0, \pi/2]$ is the polar angle and $\phi \in [0, 2\pi)$ is the azimuthal angle, the solid angle measure is $d\omega = \sin\theta \, d\theta \, d\phi$.

The uniform PDF over the hemisphere is:

$$p(\omega) = \frac{1}{2\pi}$$

(since the hemisphere has solid angle $2\pi$ steradians).

Applying inverse transform sampling to the marginal and conditional distributions:

$$\theta = \arccos(\xi_1), \qquad \phi = 2\pi \xi_2$$

where $\xi_1, \xi_2$ are independent uniform random numbers in $[0,1)$.

Converting to Cartesian coordinates:

```glsl
// Uniform hemisphere sampling
vec3 sampleHemisphereUniform(float xi1, float xi2) {
    float cosTheta = xi1;
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    float phi = 2.0 * PI * xi2;
    return vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
}
// PDF = 1 / (2 * PI)
```

**Problem:** Uniform sampling wastes many samples on directions that contribute little to the integral. Directions near the horizon ($\theta \approx 90°$) contribute almost nothing because $\cos\theta \approx 0$, yet they receive equal sampling density.

## Cosine-Weighted Hemisphere Sampling

Since the rendering equation always includes a $\cos\theta$ factor, we can draw samples proportional to $\cos\theta$ — this is **cosine-weighted sampling**.

### Derivation

We want $p(\omega) \propto \cos\theta$. Normalizing over the hemisphere:

$$\int_{\Omega} c \cos\theta \, d\omega = c \int_0^{2\pi}\int_0^{\pi/2} \cos\theta \sin\theta \, d\theta \, d\phi = c \cdot 2\pi \cdot \frac{1}{2} = c\pi = 1$$

So $c = \frac{1}{\pi}$ and:

$$p(\theta, \phi) = \frac{\cos\theta \sin\theta}{\pi}$$

Applying inverse transform sampling to the marginal PDF $p(\theta) = 2\cos\theta\sin\theta = \sin(2\theta)$:

$$P(\theta) = \int_0^{\theta} \sin(2t) \, dt = \frac{1 - \cos(2\theta)}{2} = \sin^2\theta$$

Setting $\xi_1 = \sin^2\theta$ gives $\sin\theta = \sqrt{\xi_1}$ and $\cos\theta = \sqrt{1 - \xi_1}$.

$$\theta = \arccos(\sqrt{1 - \xi_1}), \qquad \phi = 2\pi\xi_2$$

### Malley's Method

An elegant alternative: generate a uniform random point on the unit disk, then project it up onto the hemisphere. If $(u, v)$ is uniform on the disk (using concentric mapping or rejection):

$$x = u, \quad y = v, \quad z = \sqrt{1 - u^2 - v^2}$$

The $z$ component naturally follows a cosine distribution. This avoids trigonometric functions entirely.

```glsl
// Cosine-weighted hemisphere sampling (Malley's method)
vec3 sampleHemisphereCosine(float xi1, float xi2) {
    // Concentric disk mapping (Shirley & Chiu 1997)
    float r = sqrt(xi1);
    float phi = 2.0 * PI * xi2;
    float x = r * cos(phi);
    float y = r * sin(phi);
    float z = sqrt(max(0.0, 1.0 - xi1));
    return vec3(x, y, z);
}
// PDF = cos(theta) / PI
```

## Importance Sampling

The key idea: if we can choose a sampling PDF $p(\omega)$ that is proportional to the integrand, the variance of the Monte Carlo estimator is minimized. In the ideal case where $p(\omega) = \frac{g(\omega)}{\int g}$ exactly, the variance is **zero** — every sample gives the exact answer.

### Why It Reduces Variance

Consider estimating $I = \int g(x) \, dx$. The variance of the Monte Carlo estimator is:

$$\text{Var}\left[\frac{g(X)}{p(X)}\right] = \int \left(\frac{g(x)}{p(x)} - I\right)^2 p(x) \, dx$$

When $p(x)$ is proportional to $|g(x)|$, the ratio $g(x)/p(x)$ becomes nearly constant, making the integrand of the variance expression small.

### BRDF Importance Sampling

For the GGX microfacet model, we sample the NDF $D(\mathbf{h})$ by generating half-vectors:

$$\theta_h = \arctan\left(\alpha \sqrt{\frac{\xi_1}{1 - \xi_1}}\right), \qquad \phi_h = 2\pi\xi_2$$

The half-vector $\mathbf{h}$ is then reflected about the view direction to obtain $\omega_i$. The PDF in terms of $\omega_i$ includes a Jacobian:

$$p(\omega_i) = \frac{D(\mathbf{h}) \, (\mathbf{n} \cdot \mathbf{h})}{4 \, (\omega_i \cdot \mathbf{h})}$$

```glsl
// GGX importance sampling: generate half-vector
vec3 importanceSampleGGX(float xi1, float xi2, float roughness) {
    float a = roughness * roughness;
    float cosTheta = sqrt((1.0 - xi1) / (1.0 + (a * a - 1.0) * xi1));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    float phi = 2.0 * PI * xi2;
    // Half-vector in tangent space
    return vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
}
```

## Multiple Importance Sampling (MIS)

In path tracing, we often have multiple reasonable sampling strategies:

- **BRDF sampling** — good when the surface is glossy and the highlight is narrow
- **Light sampling** — good when lights are small relative to the BRDF lobe

Neither strategy alone works well in all cases. Veach (1995) introduced **Multiple Importance Sampling** to combine them optimally.

### The MIS Estimator

Given $n$ sampling techniques with PDFs $p_1, \ldots, p_n$ drawing $N_1, \ldots, N_n$ samples respectively:

$$\langle I \rangle = \sum_{i=1}^{n} \frac{1}{N_i} \sum_{j=1}^{N_i} w_i(X_{i,j}) \frac{f(X_{i,j})}{p_i(X_{i,j})}$$

where $w_i(x)$ are weighting functions satisfying $\sum_i w_i(x) = 1$ whenever $f(x) \neq 0$.

### The Balance Heuristic

Veach proved the **balance heuristic** is provably good (within a constant factor of optimal):

$$w_i(x) = \frac{N_i \, p_i(x)}{\sum_{k=1}^{n} N_k \, p_k(x)}$$

For the common case $N_1 = N_2 = 1$ (one sample per strategy):

$$w_i(x) = \frac{p_i(x)}{p_1(x) + p_2(x)}$$

### The Power Heuristic

In practice, the **power heuristic** (with exponent $\beta = 2$) often performs slightly better by suppressing contributions from poor strategies:

$$w_i(x) = \frac{p_i(x)^2}{\sum_{k} p_k(x)^2}$$

### MIS in a Path Tracer

```python
def shade_direct(hit, wo, light, rng):
    """Direct lighting with MIS (one BRDF sample + one light sample)."""
    result = vec3(0)

    # -- Strategy 1: Light sampling --
    light_sample = light.sample(hit.pos, rng)
    if not shadow_ray_blocked(hit.pos, light_sample.dir):
        f_val = brdf.eval(wo, light_sample.dir, hit)
        cos_theta = max(dot(hit.normal, light_sample.dir), 0)
        pdf_light = light_sample.pdf
        pdf_brdf  = brdf.pdf(wo, light_sample.dir, hit)
        w = power_heuristic(pdf_light, pdf_brdf)
        result += f_val * light_sample.Li * cos_theta * w / pdf_light

    # -- Strategy 2: BRDF sampling --
    brdf_sample = brdf.sample(wo, hit, rng)
    if not shadow_ray_blocked(hit.pos, brdf_sample.dir):
        Li = light.eval(hit.pos, brdf_sample.dir)
        cos_theta = max(dot(hit.normal, brdf_sample.dir), 0)
        pdf_brdf  = brdf_sample.pdf
        pdf_light = light.pdf(hit.pos, brdf_sample.dir)
        w = power_heuristic(pdf_brdf, pdf_light)
        result += brdf_sample.f * Li * cos_theta * w / pdf_brdf

    return result

def power_heuristic(pdf_a, pdf_b):
    a2 = pdf_a * pdf_a
    return a2 / (a2 + pdf_b * pdf_b)
```

## Low-Discrepancy Sequences

Purely random samples can clump, leaving gaps in the domain. **Low-discrepancy sequences** (quasi-random numbers) spread points more evenly while retaining the averaging framework of Monte Carlo.

### Halton Sequence

The Halton sequence in base $b$ constructs the $i$-th point by reflecting the digits of $i$ in base $b$ about the decimal point. For multidimensional sampling, use a different prime base per dimension.

```python
def halton(index, base):
    """Halton sequence: radical inverse in given base."""
    result = 0.0
    f = 1.0 / base
    i = index
    while i > 0:
        result += f * (i % base)
        i = i // base
        f /= base
    return result

# 2D Halton: base 2 for x, base 3 for y
point = (halton(i, 2), halton(i, 3))
```

### Sobol Sequence

Sobol sequences achieve better uniformity through direction numbers derived from primitive polynomials over GF(2). They are the standard choice in production renderers. Modern engines use **Owen-scrambled Sobol** for decorrelation between pixels.

### Convergence Rate

Quasi-Monte Carlo with $N$ points from a low-discrepancy sequence converges at $O((\log N)^d / N)$ for a $d$-dimensional integral, which is significantly faster than the $O(1/\sqrt{N})$ rate of plain Monte Carlo for moderate dimensions.

## Stratified Sampling

A simple but effective variance reduction technique: divide the sampling domain into a regular grid of $N$ strata, and draw one random sample per stratum.

For 2D sampling with an $M \times M$ grid:

$$\xi_1 = \frac{j + u}{M}, \qquad \xi_2 = \frac{k + v}{M}$$

where $j, k \in \{0, \ldots, M-1\}$ are the stratum indices and $u, v \sim \text{Uniform}(0,1)$ are jittered offsets within each cell.

Stratified sampling guarantees at least one sample per stratum, preventing clumping. The variance reduction is proportional to the inter-stratum variance.

```glsl
// Stratified 2D sampling (M x M grid)
vec2 stratifiedSample(int j, int k, int M, float u, float v) {
    return vec2((float(j) + u) / float(M),
                (float(k) + v) / float(M));
}
```

## Practical Path Tracer Structure

Combining these techniques, a modern path tracer follows this structure:

```python
def render_pixel(x, y, spp):
    """Render a single pixel with spp samples."""
    color = vec3(0)

    for s in range(spp):
        # Stratified camera ray with sub-pixel jitter
        u = (x + halton(s, 2)) / width
        v = (y + halton(s, 3)) / height
        ray = camera.generate_ray(u, v)

        color += trace_path(ray, max_depth=8)

    return color / spp

def trace_path(ray, max_depth):
    """Iterative path tracing with Russian roulette."""
    throughput = vec3(1)
    radiance   = vec3(0)

    for depth in range(max_depth):
        hit = scene.intersect(ray)
        if not hit:
            radiance += throughput * sample_environment(ray.dir)
            break

        if hit.is_emissive:
            radiance += throughput * hit.emission
            break

        # Direct lighting with MIS
        radiance += throughput * shade_direct(hit, -ray.dir, scene.lights)

        # Sample BRDF for next bounce
        sample = hit.material.sample(-ray.dir, hit, rng)
        if sample.pdf < 1e-8:
            break

        throughput *= sample.f * abs(dot(hit.normal, sample.dir)) / sample.pdf
        ray = Ray(hit.pos + hit.normal * 1e-4, sample.dir)

        # Russian roulette: probabilistic path termination
        if depth > 3:
            q = max(throughput.r, throughput.g, throughput.b)
            q = min(q, 0.95)  # cap survival probability
            if rng.uniform() > q:
                break
            throughput /= q  # compensate for terminated paths

    return radiance
```

**Russian roulette** is an unbiased technique for terminating low-contribution paths early. Rather than clamping throughput to zero (which introduces bias), we terminate with probability $1 - q$ and divide by $q$ when continuing. This keeps the estimator unbiased: $E[X/q \cdot \mathbb{1}_{U < q}] = E[X]$.

## ReSTIR: Real-Time Resampling (2020-2025)

**Reservoir-based SpatioTemporal Importance Resampling** (Bitterli et al. 2020) enables real-time path tracing with just 1-2 rays per pixel by reusing samples across pixels and frames.

**Key ideas:**
- **Resampled Importance Sampling (RIS):** Draw $M$ candidate samples, then select one proportional to its target contribution. This effectively achieves importance sampling from a distribution closer to the integrand than any single sampling strategy.
- **Reservoir sampling:** Maintain a fixed-size "reservoir" per pixel that can incorporate new candidates in constant time.
- **Spatiotemporal reuse:** Share reservoir data with neighboring pixels and the same pixel from the previous frame, dramatically increasing the effective sample count.

Recent extensions include **ReSTIR GI** (2021) for global illumination path reuse, **ReSTIR PT** (2022) for full path resampling, and **ReSTIR BDPT** (2025) for bidirectional path tracing with caustic support. These techniques have made real-time path tracing practical on consumer GPUs.

<details>
<summary>Exercise: Monte Carlo estimation of pi</summary>
<p>Use Monte Carlo integration to estimate $\pi$ by evaluating $\int_0^1 \frac{4}{1+x^2} dx$ (which equals $\pi$). Write the estimator formula for $N$ uniform samples on $[0,1]$ and compute the estimate for $N=4$ with samples $x_i \in \{0.1, 0.35, 0.6, 0.85\}$.</p>
<p><strong>Solution:</strong></p>
<p>With uniform PDF $p(x) = 1$ on $[0,1]$, the estimator is:</p>
<p>$\hat{\pi} = \frac{1}{N}\sum_{i=1}^{N}\frac{4}{1+x_i^2}$</p>
<p>$= \frac{1}{4}\left(\frac{4}{1.01} + \frac{4}{1.1225} + \frac{4}{1.36} + \frac{4}{1.7225}\right)$</p>
<p>$= \frac{1}{4}(3.960 + 3.564 + 2.941 + 2.322)$</p>
<p>$= \frac{12.787}{4} = 3.197$</p>
<p>Close to $\pi \approx 3.14159$. With more samples, the estimate converges.</p>
</details>

<details>
<summary>Exercise: Derive the cosine-weighted PDF normalization</summary>
<p>Prove that the cosine-weighted PDF $p(\omega) = \frac{\cos\theta}{\pi}$ integrates to 1 over the hemisphere.</p>
<p><strong>Solution:</strong></p>
<p>$\int_\Omega p(\omega)\,d\omega = \int_0^{2\pi}\int_0^{\pi/2} \frac{\cos\theta}{\pi}\sin\theta\,d\theta\,d\phi$</p>
<p>$= \frac{1}{\pi}\int_0^{2\pi}d\phi\int_0^{\pi/2}\cos\theta\sin\theta\,d\theta$</p>
<p>$= \frac{1}{\pi}\cdot 2\pi \cdot \int_0^{\pi/2}\frac{1}{2}\sin(2\theta)\,d\theta$</p>
<p>$= 2 \cdot \left[-\frac{1}{4}\cos(2\theta)\right]_0^{\pi/2}$</p>
<p>$= 2 \cdot \left(-\frac{1}{4}(-1) + \frac{1}{4}(1)\right) = 2 \cdot \frac{1}{2} = 1$ &#10004;</p>
</details>

<details>
<summary>Exercise: Compare uniform vs. cosine-weighted sampling</summary>
<p>You are evaluating a purely Lambertian BRDF ($f_r = \frac{\rho}{\pi}$) under a constant environment ($L_i = 1$). Show that cosine-weighted sampling gives zero-variance estimates for this case.</p>
<p><strong>Solution:</strong></p>
<p>The integrand is $g(\omega) = \frac{\rho}{\pi} \cdot 1 \cdot \cos\theta = \frac{\rho \cos\theta}{\pi}$.</p>
<p>With cosine-weighted sampling, $p(\omega) = \frac{\cos\theta}{\pi}$.</p>
<p>The Monte Carlo ratio is $\frac{g(\omega)}{p(\omega)} = \frac{\rho\cos\theta / \pi}{\cos\theta / \pi} = \rho$.</p>
<p>This is a constant independent of the sample direction! Every sample returns exactly $\rho$, so the variance is zero. This demonstrates why matching the PDF to the integrand is so effective.</p>
</details>

## Key Takeaways

- Monte Carlo integration estimates integrals by averaging random samples weighted by $1/p(x)$, converging at $O(1/\sqrt{N})$ regardless of dimension.
- **Cosine-weighted hemisphere sampling** reduces variance by matching the $\cos\theta$ term always present in the rendering equation. Malley's method implements it via disk-to-hemisphere projection.
- **Importance sampling** concentrates samples where the integrand is large. Perfect importance sampling achieves zero variance.
- **Multiple Importance Sampling** (Veach 1995) robustly combines multiple sampling strategies using the balance or power heuristic, preventing catastrophic failure of any single strategy.
- **Low-discrepancy sequences** (Halton, Sobol) spread samples more uniformly than pure random numbers, improving convergence.
- **Russian roulette** provides unbiased path termination — it compensates for terminated paths by boosting surviving ones.
- **ReSTIR** (2020-2025) enables real-time path tracing by resampling and reusing candidates across pixels and frames.
