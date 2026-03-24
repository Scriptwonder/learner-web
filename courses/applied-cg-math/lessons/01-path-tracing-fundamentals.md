# Path Tracing Fundamentals

Path tracing is the workhorse of physically-based rendering. It solves the **rendering equation** (Kajiya 1986) by stochastically simulating light transport along random walks from camera to light sources. This lesson covers the full rendering equation, the recursive path tracing algorithm, throughput accumulation, Russian roulette termination, next-event estimation, multiple importance sampling in path tracing, convergence properties, and a complete Python pseudocode path tracer.

## The Rendering Equation

James Kajiya (1986) formulated the rendering equation as an energy-balance integral over the hemisphere:

$$L_o(\mathbf{x}, \omega_o) = L_e(\mathbf{x}, \omega_o) + \int_{\Omega} f_r(\mathbf{x}, \omega_i, \omega_o) \, L_i(\mathbf{x}, \omega_i) \, \cos\theta_i \, d\omega_i$$

where:

- $L_o(\mathbf{x}, \omega_o)$ is the outgoing radiance from point $\mathbf{x}$ in direction $\omega_o$
- $L_e(\mathbf{x}, \omega_o)$ is emitted radiance (nonzero only for light sources)
- $f_r(\mathbf{x}, \omega_i, \omega_o)$ is the BRDF (bidirectional reflectance distribution function)
- $L_i(\mathbf{x}, \omega_i)$ is the incoming radiance from direction $\omega_i$
- $\cos\theta_i = \langle \omega_i, \mathbf{n} \rangle$ is the foreshortening factor
- $\Omega$ is the upper hemisphere oriented by the surface normal $\mathbf{n}$

The key difficulty: $L_i$ at one point depends on $L_o$ at another point, making this a **Fredholm integral equation of the second kind**. There is no closed-form solution for general scenes.

### Area Formulation

An equivalent formulation integrates over all scene surfaces $A$ instead of directions:

$$L_o(\mathbf{x}, \omega_o) = L_e(\mathbf{x}, \omega_o) + \int_{A} f_r(\mathbf{x}, \omega_{\mathbf{x} \to \mathbf{y}}, \omega_o) \, L_o(\mathbf{y}, \omega_{\mathbf{y} \to \mathbf{x}}) \, G(\mathbf{x}, \mathbf{y}) \, dA(\mathbf{y})$$

where the **geometry term** is:

$$G(\mathbf{x}, \mathbf{y}) = V(\mathbf{x}, \mathbf{y}) \frac{\cos\theta_\mathbf{x} \cos\theta_\mathbf{y}}{\|\mathbf{x} - \mathbf{y}\|^2}$$

and $V(\mathbf{x}, \mathbf{y})$ is the binary visibility function (1 if unoccluded, 0 otherwise). This area formulation is essential for light source sampling and bidirectional methods.

## Recursive Path Tracing Algorithm

A path tracer estimates $L_o$ by recursively tracing random paths. At each bounce, we sample one direction from the BRDF, trace a ray, and recurse:

$$L_o(\mathbf{x}, \omega_o) \approx L_e(\mathbf{x}, \omega_o) + \frac{f_r(\mathbf{x}, \omega_i, \omega_o) \, L_i(\mathbf{x}, \omega_i) \, \cos\theta_i}{p(\omega_i)}$$

where $\omega_i$ is sampled from PDF $p(\omega_i)$. This is a single-sample Monte Carlo estimate of the hemisphere integral. The recursion bottoms out when the ray misses all geometry (background) or is terminated.

### Throughput Accumulation

Rather than implementing deep recursion, practical path tracers use an iterative loop that accumulates a **throughput** weight:

$$\text{throughput} = \prod_{k=0}^{n-1} \frac{f_r(\mathbf{x}_k, \omega_{k+1}, \omega_k) \, \cos\theta_{k+1}}{p(\omega_{k+1})}$$

The final contribution to the pixel is $\text{throughput} \times L_e(\mathbf{x}_n, -\omega_n)$ when the path hits an emitter at vertex $\mathbf{x}_n$. This avoids stack overflow and is more cache-friendly.

At each bounce $k$:

1. Sample direction $\omega_{k+1}$ from BRDF with PDF $p(\omega_{k+1})$
2. Update: $\text{throughput} \mathrel{*}= \frac{f_r \cos\theta}{p(\omega)}$
3. Trace ray, find next intersection $\mathbf{x}_{k+1}$
4. If $\mathbf{x}_{k+1}$ is emissive, accumulate $\text{throughput} \times L_e$

## Russian Roulette Termination

Paths cannot recurse forever. A fixed maximum depth introduces **bias** (energy loss). **Russian roulette** provides an unbiased alternative:

At each bounce, choose a continuation probability $q$ (typically based on the maximum component of the throughput, or the surface albedo). Then:

- With probability $q$: **continue** the path, but divide throughput by $q$
- With probability $1 - q$: **terminate** the path

This is unbiased because the expected value is preserved:

$$E\left[\frac{X}{q} \cdot \mathbb{1}_{U < q}\right] = \frac{X}{q} \cdot q = X$$

The division by $q$ compensates exactly for the terminated paths. Low-throughput paths are terminated more often, saving computation without introducing systematic error.

```python
# Russian roulette after a minimum number of bounces
if bounce >= min_bounces:
    q = min(max(throughput.r, throughput.g, throughput.b), 0.95)
    if random() > q:
        break  # terminate path
    throughput /= q  # boost surviving paths
```

The cap at $0.95$ prevents extremely bright paths from never terminating. Some implementations use the surface albedo directly: $q = \max(\rho_r, \rho_g, \rho_b)$.

## Next-Event Estimation (Direct Light Sampling)

A naive path tracer only accumulates radiance when a path randomly hits a light source. For small lights, this is extremely unlikely, leading to high variance (noisy images).

**Next-event estimation** (NEE), also called **direct light sampling**, explicitly samples the light sources at every bounce:

1. At each shading point $\mathbf{x}_k$, sample a point $\mathbf{y}$ on a light source with PDF $p_\text{light}(\mathbf{y})$
2. Trace a shadow ray from $\mathbf{x}_k$ to $\mathbf{y}$
3. If unoccluded, compute the direct illumination contribution:

$$L_\text{direct} = \frac{f_r(\mathbf{x}_k, \omega_\mathbf{y}, \omega_o) \, L_e(\mathbf{y}, -\omega_\mathbf{y}) \, G(\mathbf{x}_k, \mathbf{y})}{p_\text{light}(\mathbf{y})}$$

4. Add $\text{throughput} \times L_\text{direct}$ to the pixel
5. Continue the path for indirect illumination via BRDF sampling

**Critical detail:** When using NEE, you must **not** also count direct emission when the BRDF-sampled ray hits a light. Otherwise you double-count direct illumination. Either:
- Exclude emitter hits on BRDF-sampled rays (simple but loses some paths), or
- Use **Multiple Importance Sampling** to combine both strategies (preferred)

## Multiple Importance Sampling in Path Tracing

Veach's MIS (1995) combines light sampling and BRDF sampling using the **balance heuristic** or **power heuristic**. For a single light sample and a single BRDF sample at each bounce:

### Balance Heuristic

$$w_\text{light}(\mathbf{y}) = \frac{p_\text{light}(\mathbf{y})}{p_\text{light}(\mathbf{y}) + p_\text{BRDF}(\mathbf{y})}$$

$$w_\text{BRDF}(\omega_i) = \frac{p_\text{BRDF}(\omega_i)}{p_\text{light}(\omega_i) + p_\text{BRDF}(\omega_i)}$$

### Power Heuristic ($\beta = 2$)

$$w_\text{light}(\mathbf{y}) = \frac{p_\text{light}(\mathbf{y})^2}{p_\text{light}(\mathbf{y})^2 + p_\text{BRDF}(\mathbf{y})^2}$$

In practice, the power heuristic with $\beta = 2$ is almost universally used because it slightly reduces variance compared to the balance heuristic.

**When does each strategy win?**

| Scenario | Best strategy |
|----------|--------------|
| Large diffuse surfaces, small lights | Light sampling |
| Glossy/specular surfaces, large area lights | BRDF sampling |
| Mixed scenes | MIS combines both optimally |

MIS ensures that neither strategy can catastrophically fail. Even if one strategy assigns near-zero probability to an important contribution, the other strategy picks up the slack.

## Convergence and Noise

Path tracing converges at the standard Monte Carlo rate: the **root mean squared error** (RMSE) decreases as $O(1/\sqrt{N})$ where $N$ is the number of samples per pixel (spp).

| Samples per pixel | Relative noise |
|-------------------|---------------|
| 1 spp | 1.0 |
| 4 spp | 0.5 |
| 16 spp | 0.25 |
| 64 spp | 0.125 |
| 256 spp | 0.0625 |
| 1024 spp | 0.03125 |

**Variance reduction is key** — halving the noise requires 4x the samples, so algorithmic improvements (importance sampling, NEE, MIS) are far more effective than brute-force sampling.

### Sources of High Variance

- **Small light sources**: Direct illumination is hard to find by random BRDF sampling
- **Caustics**: Light reflected/refracted through specular surfaces onto diffuse surfaces (SDS paths)
- **Indirect illumination**: Deep bounces contribute less but still matter
- **Near-specular BRDFs**: The BRDF lobe is narrow, requiring well-matched sampling

## Complete Path Tracer Pseudocode

```python
import numpy as np
from dataclasses import dataclass

@dataclass
class Ray:
    origin: np.ndarray
    direction: np.ndarray

@dataclass
class Hit:
    position: np.ndarray
    normal: np.ndarray
    brdf: object        # BRDF at the hit point
    emission: np.ndarray  # Le if emissive, else (0,0,0)

def trace_path(ray, scene, max_bounces=64, min_bounces=3):
    """Trace a single path and return radiance estimate."""
    radiance = np.zeros(3)       # accumulated radiance for this path
    throughput = np.ones(3)      # current path throughput

    for bounce in range(max_bounces):
        hit = scene.intersect(ray)
        if hit is None:
            radiance += throughput * scene.environment(ray.direction)
            break

        # --- Next-event estimation (direct light sampling) ---
        light_point, light_normal, Le, pdf_light = scene.sample_light(hit.position)
        shadow_dir = light_point - hit.position
        dist = np.linalg.norm(shadow_dir)
        shadow_dir /= dist

        if not scene.occluded(hit.position, light_point):
            cos_theta_hit = max(np.dot(hit.normal, shadow_dir), 0)
            cos_theta_light = max(np.dot(light_normal, -shadow_dir), 0)
            G = cos_theta_hit * cos_theta_light / (dist * dist)

            f = hit.brdf.eval(ray.direction, shadow_dir, hit.normal)
            # MIS weight (power heuristic)
            pdf_brdf = hit.brdf.pdf(ray.direction, shadow_dir, hit.normal)
            w = (pdf_light ** 2) / (pdf_light ** 2 + pdf_brdf ** 2 + 1e-10)

            if pdf_light > 0:
                direct = f * Le * G / pdf_light * w
                radiance += throughput * direct

        # --- BRDF sampling for continuation ---
        wi, pdf_brdf = hit.brdf.sample(ray.direction, hit.normal)
        if pdf_brdf < 1e-10:
            break

        cos_theta = max(np.dot(hit.normal, wi), 0)
        f = hit.brdf.eval(ray.direction, wi, hit.normal)
        throughput *= f * cos_theta / pdf_brdf

        # MIS weight for BRDF-sampled ray hitting emitter
        next_ray = Ray(hit.position + wi * 1e-4, wi)
        next_hit = scene.intersect(next_ray)
        if next_hit is not None and np.any(next_hit.emission > 0):
            pdf_light_at_hit = scene.pdf_light(next_hit.position, hit.position)
            w_brdf = (pdf_brdf ** 2) / (pdf_brdf ** 2 + pdf_light_at_hit ** 2 + 1e-10)
            radiance += throughput * next_hit.emission * w_brdf

        # --- Russian roulette ---
        if bounce >= min_bounces:
            q = min(max(throughput.max(), 0.05), 0.95)
            if np.random.random() > q:
                break
            throughput /= q

        ray = next_ray

    return radiance

def render(scene, camera, width, height, spp):
    """Render an image with spp samples per pixel."""
    image = np.zeros((height, width, 3))
    for y in range(height):
        for x in range(width):
            for s in range(spp):
                # Jittered sub-pixel offset
                u = (x + np.random.random()) / width
                v = (y + np.random.random()) / height
                ray = camera.generate_ray(u, v)
                image[y, x] += trace_path(ray, scene)
            image[y, x] /= spp
    return image
```

## Worked Example: 2-Bounce Path in a Cornell Box

Consider a classic Cornell box: a closed room with a white ceiling light, red left wall, green right wall, white floor and back wall, and a Lambertian BRDF $f_r = \rho / \pi$ everywhere.

**Setup:**
- Light: area light on ceiling, $L_e = (10, 10, 10)$ W/sr/m$^2$, area $A_L = 0.1$ m$^2$
- Floor albedo: $\rho = 0.8$ (white)
- Left wall albedo: $\rho = (0.63, 0.06, 0.04)$ (red)

**Path:** Camera $\to$ floor point $\mathbf{x}_0$ $\to$ left wall point $\mathbf{x}_1$ $\to$ light point $\mathbf{x}_2$.

### Bounce 0: Camera to Floor

The camera ray hits the floor at $\mathbf{x}_0 = (0.3, 0, 0.5)$ with normal $\mathbf{n}_0 = (0, 1, 0)$.

We sample a direction using cosine-weighted sampling: $\omega_1 = (-0.6, 0.7, 0.3)$ (toward left wall), with PDF:

$$p(\omega_1) = \frac{\cos\theta_1}{\pi} = \frac{0.7}{\pi} \approx 0.2228$$

Throughput update:

$$\text{throughput} = \frac{f_r \cos\theta_1}{p(\omega_1)} = \frac{(0.8/\pi) \times 0.7}{0.7/\pi} = 0.8$$

This simplification (throughput = albedo) always occurs with cosine-weighted sampling of Lambertian surfaces.

### Bounce 1: Floor to Left Wall

The ray hits the left wall at $\mathbf{x}_1 = (-1.0, 0.7, 0.65)$ with normal $\mathbf{n}_1 = (1, 0, 0)$.

**Next-event estimation:** Sample a point $\mathbf{y}$ on the ceiling light. Suppose $\mathbf{y} = (0.0, 1.0, 0.5)$.

Direction from $\mathbf{x}_1$ to $\mathbf{y}$: $\mathbf{d} = (1.0, 0.3, -0.15)$, $|\mathbf{d}| \approx 1.053$.

$$\cos\theta_{\mathbf{x}_1} = \langle \mathbf{n}_1, \hat{\mathbf{d}} \rangle = \frac{1.0}{1.053} \approx 0.950$$

$$\cos\theta_\text{light} = \langle \mathbf{n}_\text{light}, -\hat{\mathbf{d}} \rangle = \frac{0.3}{1.053} \approx 0.285$$

PDF for uniform light sampling: $p_\text{light} = 1/A_L = 10$.

Geometry term:

$$G = \frac{0.950 \times 0.285}{1.053^2} = \frac{0.2708}{1.109} \approx 0.244$$

Shadow ray is unoccluded, so direct illumination:

$$L_\text{direct} = \frac{f_r \times L_e \times G}{p_\text{light}} = \frac{(0.63/\pi, 0.06/\pi, 0.04/\pi) \times 10 \times 0.244}{10}$$

$$= (0.2006 \times 0.244,\; 0.0191 \times 0.244,\; 0.0127 \times 0.244)$$

$$= (0.0489,\; 0.00466,\; 0.00310)$$

Pixel contribution from this NEE sample:

$$\text{radiance} = \text{throughput} \times L_\text{direct} = 0.8 \times (0.0489, 0.00466, 0.00310) = (0.0391, 0.00373, 0.00248)$$

This gives the characteristic red tint of light bouncing off the left wall — the color bleeding effect that makes global illumination visually compelling.

<details>
<summary>Exercise: Compute throughput for a 3-bounce path</summary>
<p>A path traces: camera $\to$ white floor ($\rho = 0.8$) $\to$ green right wall ($\rho = (0.15, 0.45, 0.09)$) $\to$ white back wall ($\rho = 0.8$) $\to$ light. Using cosine-weighted sampling at each bounce, what is the path throughput at each vertex?</p>
<p><strong>Solution:</strong></p>
<p>With cosine-weighted sampling on Lambertian surfaces, throughput at each bounce simply multiplies by the albedo:</p>
<p>After bounce 0 (floor): $T_0 = (0.8, 0.8, 0.8)$</p>
<p>After bounce 1 (green wall): $T_1 = (0.8 \times 0.15, 0.8 \times 0.45, 0.8 \times 0.09) = (0.12, 0.36, 0.072)$</p>
<p>After bounce 2 (back wall): $T_2 = (0.12 \times 0.8, 0.36 \times 0.8, 0.072 \times 0.8) = (0.096, 0.288, 0.0576)$</p>
<p>If we apply Russian roulette with $q = \max(T_2) = 0.288$, the boosted throughput becomes $T_2 / q = (0.333, 1.0, 0.2)$.</p>
</details>

<details>
<summary>Exercise: Verify Russian roulette is unbiased</summary>
<p>A path has throughput $T = 0.3$ after 4 bounces. Russian roulette continues with probability $q = 0.3$. Over 1000 independent trials, what is the expected average of the (possibly terminated) contributions?</p>
<p><strong>Solution:</strong></p>
<p>In each trial, with probability $q = 0.3$ we continue and the throughput becomes $T/q = 0.3/0.3 = 1.0$. With probability $0.7$ the path is terminated (contribution = 0).</p>
<p>Expected value: $E = q \times (T/q) + (1-q) \times 0 = T = 0.3$</p>
<p>Over 1000 trials: about 300 will contribute $1.0$, 700 will contribute $0$. Average $\approx 300/1000 = 0.3 = T$. Unbiased.</p>
<p>The variance is $\text{Var} = q \times (1/q - 1)^2 \times T^2 + (1-q) \times T^2 = T^2(1/q - 1) = 0.09 \times (10/3 - 1) = 0.21$. Russian roulette adds variance but zero bias.</p>
</details>

<details>
<summary>Exercise: MIS weight calculation</summary>
<p>At a shading point, a BRDF sample hits a light with $p_\text{BRDF} = 0.5$ and the light-sampling PDF for that same point is $p_\text{light} = 2.0$. Compute the power heuristic MIS weight ($\beta = 2$) for the BRDF sample.</p>
<p><strong>Solution:</strong></p>
<p>$$w_\text{BRDF} = \frac{p_\text{BRDF}^2}{p_\text{BRDF}^2 + p_\text{light}^2} = \frac{0.25}{0.25 + 4.0} = \frac{0.25}{4.25} \approx 0.0588$$</p>
<p>The BRDF sample gets very low weight because the light-sampling strategy has much higher probability for this point. MIS correctly down-weights the BRDF sample here, preventing double-counting.</p>
</details>

## Key Takeaways

- The **rendering equation** (Kajiya 1986) is a recursive integral that path tracing solves stochastically by sampling random light paths from camera to light sources.
- **Throughput accumulation** converts recursive path tracing into an efficient iterative loop, multiplying BRDF-cosine-over-PDF at each bounce.
- **Russian roulette** provides unbiased path termination by probabilistically killing low-contribution paths and boosting survivors to compensate.
- **Next-event estimation** dramatically reduces variance for small light sources by explicitly sampling the lights at every shading point.
- **Multiple importance sampling** (Veach 1995) combines BRDF and light sampling via the power heuristic, ensuring robustness across all material and lighting combinations.
- Path tracing converges at $O(1/\sqrt{N})$ — halving the noise costs 4x the samples, making variance reduction techniques essential.
- References: Kajiya (1986), Veach thesis (1997), Pharr, Jakob, and Humphreys, *Physically Based Rendering* (PBRT, 4th ed. 2023).
