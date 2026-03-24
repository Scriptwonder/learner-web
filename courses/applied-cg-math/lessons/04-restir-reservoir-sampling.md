# ReSTIR and Reservoir Sampling

Real-time path tracing demands rendering complex lighting — potentially millions of light sources — with only a handful of rays per pixel per frame. **ReSTIR** (Reservoir-based SpatioTemporal Importance Resampling) achieves this by combining **Resampled Importance Sampling** (RIS) with **weighted reservoir sampling** and **spatiotemporal reuse**. Introduced by Bitterli et al. (2020) for direct illumination and extended to full global illumination (Ouyang et al. 2021, Lin et al. 2022), ReSTIR has become the foundational algorithm for real-time path-traced rendering on modern GPUs.

## The Problem: Many Lights in Real Time

Consider a scene with $N$ light sources (possibly millions of emissive triangles). At each pixel, we need to estimate:

$$L_\text{direct}(\mathbf{x}, \omega_o) = \sum_{i=1}^{N} \frac{f_r(\mathbf{x}, \omega_i, \omega_o) \, L_{e,i} \, G(\mathbf{x}, \mathbf{y}_i)}{p(i)}$$

Evaluating all $N$ lights is impossible in real time. Uniform random selection ($p(i) = 1/N$) wastes samples on lights that contribute nothing. We need a way to sample proportional to each light's actual contribution — without evaluating all of them.

## Resampled Importance Sampling (RIS)

RIS (Talbot et al. 2005) is a technique for approximately sampling from a target distribution $\hat{p}$ when we can only cheaply sample from a simpler source distribution $q$.

### The RIS Algorithm

1. Draw $M$ **candidate samples** $x_1, \ldots, x_M$ from a source distribution $q(x)$
2. Compute **weights** for each candidate:

$$w_i = \frac{\hat{p}(x_i)}{q(x_i)}$$

where $\hat{p}(x)$ is the (unnormalized) target distribution proportional to the integrand

3. Select one candidate $x_z$ with probability proportional to its weight:

$$P(\text{select } x_z) = \frac{w_z}{\sum_{j=1}^{M} w_j}$$

4. The selected sample has an effective PDF:

$$p_\text{RIS}(x_z) = \frac{1}{M} \sum_{j=1}^{M} \frac{\hat{p}(x_z)}{w_j} \cdot q(x_j) \quad \to \quad \text{(simplified)} \quad p_\text{RIS} \approx \frac{\hat{p}(x_z)}{W}$$

where $W = \frac{1}{M}\sum_{j=1}^{M} w_j$ is the average weight.

### The 1-Sample RIS Estimator

The unbiased estimator for the integral $\int f(x) \, dx$ using the selected sample $x_z$ is:

$$\langle I \rangle_\text{RIS} = \frac{f(x_z)}{\hat{p}(x_z)} \cdot W = \frac{f(x_z)}{\hat{p}(x_z)} \cdot \frac{1}{M}\sum_{j=1}^{M} w_j$$

**Key insight:** As $M$ increases, the effective sampling distribution approaches $\hat{p}$. With $M$ candidates, we get importance sampling quality approaching the ideal target distribution, even though we only evaluate the full integrand for one sample.

For lighting, $\hat{p}(x)$ approximates $f_r \cdot L_e \cdot G$, and $q(x)$ might be uniform selection or power-based selection among lights. Even $M = 32$ candidates dramatically outperforms a single uniform sample.

## Weighted Reservoir Sampling

The critical algorithmic building block is **weighted reservoir sampling** (Vitter 1985, Chao 1982), which selects a weighted random sample from a stream in a single pass using $O(1)$ memory.

### The Reservoir Data Structure

A reservoir maintains a single selected sample and its running weight sum:

```python
@dataclass
class Reservoir:
    y: any = None        # the selected sample
    w_sum: float = 0.0   # running sum of weights
    M: int = 0           # number of candidates seen
    W: float = 0.0       # stored weight for reuse

    def update(self, x_new, w_new):
        """Process a new candidate with weight w_new."""
        self.w_sum += w_new
        self.M += 1
        # Replace current sample with probability w_new / w_sum
        if random() < (w_new / self.w_sum):
            self.y = x_new

    def finalize(self, p_hat_y):
        """Compute the output weight W for the selected sample."""
        # W is the inverse effective PDF, used in the final estimator
        self.W = self.w_sum / (self.M * p_hat_y) if p_hat_y > 0 else 0
```

### Why This Works

After processing $M$ candidates with weights $w_1, \ldots, w_M$, the probability that candidate $x_i$ is the selected sample is:

$$P(y = x_i) = \frac{w_i}{\sum_{j=1}^{M} w_j}$$

This is exactly proportional to the weights, achieving the RIS selection in a **streaming** fashion — we never need to store all $M$ candidates simultaneously.

### Combining Reservoirs

A key property: two reservoirs can be **merged** in constant time. If reservoir $A$ selected from $M_A$ candidates and reservoir $B$ from $M_B$ candidates:

```python
def combine_reservoirs(r_a, r_b, p_hat):
    """Merge two reservoirs into one."""
    r_combined = Reservoir()
    # Feed each reservoir's selected sample as a candidate
    r_combined.update(r_a.y, p_hat(r_a.y) * r_a.W * r_a.M)
    r_combined.update(r_b.y, p_hat(r_b.y) * r_b.W * r_b.M)
    r_combined.M = r_a.M + r_b.M
    r_combined.finalize(p_hat(r_combined.y))
    return r_combined
```

The combined reservoir effectively represents a selection from all $M_A + M_B$ original candidates — without having stored them.

## ReSTIR DI: Direct Illumination (Bitterli et al. 2020)

ReSTIR DI applies reservoir sampling to the many-lights problem with **spatiotemporal reuse**, dramatically increasing the effective candidate count.

### Algorithm Overview

The algorithm runs in three stages per frame:

#### Stage 1: Initial Candidate Generation

For each pixel $q$, generate $M$ candidate light samples and select one via reservoir sampling:

```python
def generate_initial_candidates(pixel, scene, M=32):
    """Stage 1: RIS with M candidates from source distribution."""
    r = Reservoir()
    for _ in range(M):
        # Sample a light from source distribution q (e.g., power-based)
        light_idx = sample_light_source(scene)
        y = sample_point_on_light(light_idx)

        # Target function: f_r * Le * G (unshadowed contribution)
        p_hat = evaluate_target(pixel.hit, y)
        q_pdf = source_pdf(light_idx, y)
        w = p_hat / q_pdf
        r.update(y, w)

    # Shadow ray test only for the selected sample
    r.finalize(evaluate_target(pixel.hit, r.y))
    return r
```

**Key optimization:** Only one shadow ray is traced (for the winning sample), not $M$. This is what makes the algorithm real-time viable.

#### Stage 2: Temporal Reuse

Combine the current frame's reservoir with the previous frame's reservoir for the same pixel (reprojected):

```python
def temporal_reuse(r_current, r_previous, pixel, max_M=20):
    """Stage 2: Combine with temporal neighbor."""
    if r_previous is not None:
        # Clamp temporal history to prevent stale samples
        r_previous.M = min(r_previous.M, max_M * r_current.M)
        r_combined = combine_reservoirs(r_current, r_previous,
                                        lambda y: evaluate_target(pixel.hit, y))
        return r_combined
    return r_current
```

The temporal history cap (e.g., $M_\text{max} = 20 \times M_\text{current}$) prevents very old samples from dominating.

#### Stage 3: Spatial Reuse

Combine with reservoirs from $k$ random neighboring pixels:

```python
def spatial_reuse(r, pixel, neighbors, num_spatial=5):
    """Stage 3: Combine with spatial neighbors."""
    r_combined = Reservoir()
    # Include self
    r_combined.update(r.y, evaluate_target(pixel.hit, r.y) * r.W * r.M)
    r_combined.M = r.M

    for _ in range(num_spatial):
        q = random_neighbor(pixel, radius=30)  # 30-pixel radius
        r_neighbor = neighbors[q]
        # Re-evaluate target at current pixel's shading point
        p_hat_here = evaluate_target(pixel.hit, r_neighbor.y)
        r_combined.update(r_neighbor.y, p_hat_here * r_neighbor.W * r_neighbor.M)
        r_combined.M += r_neighbor.M

    r_combined.finalize(evaluate_target(pixel.hit, r_combined.y))
    return r_combined
```

### Effective Sample Count

With $M = 32$ initial candidates, temporal reuse over $T = 20$ frames, and $k = 5$ spatial neighbors:

$$M_\text{effective} \approx M \times T \times (k + 1) = 32 \times 20 \times 6 = 3{,}840 \text{ candidates}$$

This is equivalent to evaluating nearly 4,000 light candidates per pixel, while actually generating only 32 new candidates per frame. The result: near-perfect importance sampling of direct illumination from millions of lights.

### Unbiased vs. Biased Variants

- **Unbiased** ($1/M$ MIS weights): Uses correct MIS weights that account for the fact that a neighbor's sample may not be valid at the current pixel (e.g., due to different geometry). Requires evaluating the target function at all contributing pixels.
- **Biased** ($1/Z$ normalization): Assumes all neighbors see the same lighting, producing slightly incorrect results near geometric discontinuities (silhouettes, corners) but with much lower noise. The bias manifests as subtle darkening near edges.

In practice, the biased variant is preferred for real-time use because the bias is small and the variance reduction is substantial.

## ReSTIR GI: Path Resampling (Ouyang et al. 2021)

ReSTIR GI extends the reservoir resampling framework from direct illumination to **multi-bounce indirect illumination**.

### Key Idea

Instead of resampling light source samples, ReSTIR GI resamples **path suffixes**. At each pixel:

1. Trace a short path (1-2 bounces) from the camera
2. At the first diffuse hit, the "sample" stored in the reservoir is the **indirect radiance** arriving from the secondary ray direction
3. Reuse this information across pixels and frames

### Algorithm

```python
@dataclass
class GISample:
    """A sample for ReSTIR GI: stores a path suffix."""
    secondary_hit: np.ndarray   # position of second bounce
    secondary_normal: np.ndarray
    Lo: np.ndarray              # outgoing radiance at secondary hit
    direction: np.ndarray       # direction from primary to secondary

def restir_gi_per_pixel(pixel, scene, prev_reservoirs, neighbor_reservoirs):
    """ReSTIR GI: resample indirect illumination paths."""
    # Step 1: Trace an initial path from the camera
    hit = pixel.primary_hit
    wi, pdf_brdf = hit.brdf.sample(-pixel.ray.direction, hit.normal)
    secondary_hit = scene.intersect(Ray(hit.position, wi))

    if secondary_hit is None:
        return scene.environment(wi)

    # Compute indirect radiance at secondary hit (e.g., via NEE)
    Lo_secondary = compute_direct(secondary_hit, scene)

    sample = GISample(secondary_hit.position, secondary_hit.normal,
                      Lo_secondary, wi)

    # Target function: how much this path contributes to current pixel
    p_hat = evaluate_gi_target(hit, sample)

    # Step 2: Build reservoir with initial sample
    r = Reservoir()
    r.update(sample, p_hat / pdf_brdf)
    r.finalize(p_hat)

    # Step 3: Temporal reuse
    r = temporal_reuse_gi(r, prev_reservoirs[pixel], hit)

    # Step 4: Spatial reuse
    r = spatial_reuse_gi(r, neighbor_reservoirs, pixel, hit)

    # Step 5: Final contribution
    f = hit.brdf.eval(-pixel.ray.direction, r.y.direction, hit.normal)
    cos_theta = max(np.dot(hit.normal, r.y.direction), 0)
    return f * r.y.Lo * cos_theta * r.W
```

### Results

ReSTIR GI achieves **9x to 166x MSE reduction** compared to standard path tracing at 1 spp, enabling real-time indirect illumination with denoising on RTX hardware.

## ReSTIR PT: Full Path Resampling (Lin et al. 2022)

**Generalized Resampled Importance Sampling** (GRIS), introduced by Lin et al. (2022), provides a rigorous theoretical framework that generalizes RIS to handle:

- **Correlated samples** (from spatiotemporal neighbors)
- **Different domains** (paths of different lengths, different surface types)
- **Unknown PDFs** (samples from previous frames whose generation PDF is lost)

### ReSTIR PT Algorithm

ReSTIR PT applies GRIS to full path tracing, resampling entire paths:

1. Each pixel traces a complete path (multiple bounces)
2. The full path is stored in a reservoir
3. Paths are resampled across pixels and frames, with MIS weights derived from GRIS theory

The target function $\hat{p}(\bar{x})$ is the full path contribution:

$$\hat{p}(\bar{x}) = L_e(\mathbf{x}_n) \prod_{k=0}^{n-1} f_r(\mathbf{x}_k) \cos\theta_k \cdot G(\mathbf{x}_k, \mathbf{x}_{k+1})$$

### Shift Mapping

When reusing a path from a neighboring pixel, the path must be **shifted** to account for the different camera origin. ReSTIR PT defines shift operators:

- **Reconnection shift**: Keep the suffix of the path, reconnect at a bounce vertex
- **Hybrid shift**: Use reconnection for diffuse vertices, random replay for specular vertices

The shift mapping Jacobian must be included in the resampling weight to maintain correctness.

## Conditional ReSTIR (Kettunen et al. 2023)

**Conditional Resampled Importance Sampling** (CRIS) by Kettunen et al. (2023) extends the GRIS framework by conditioning on shared sub-paths, reducing the effective dimensionality of the resampling problem and enabling better sample reuse.

## Recent Extensions (2024-2025)

The ReSTIR family continues to expand:

- **ReSTIR for volumes** (2023): Spatiotemporal resampling for participating media (fog, clouds)
- **World-space ReSTIR** (2023): Reservoir reuse in world space rather than screen space, improving robustness under camera motion
- **ReSTIR BDPT** (2025): Combines bidirectional path tracing with reservoir resampling, enabling efficient caustic rendering in real time
- **NVIDIA RTX Kit** (2025): Production implementation of ReSTIR PT in the NvRTX branch of Unreal Engine, demonstrated in the Zorah tech demo for RTX 50-series GPUs

### The Reservoir Update Algorithm (Complete)

Here is the complete reservoir sampling algorithm as used in ReSTIR, with all stages:

```python
def restir_full_pipeline(scene, camera, width, height, prev_frame_data):
    """Complete ReSTIR pipeline for one frame."""
    reservoirs = [[Reservoir() for _ in range(width)] for _ in range(height)]
    output = np.zeros((height, width, 3))

    # === Stage 1: Initial candidates ===
    for y in range(height):
        for x in range(width):
            pixel = trace_primary_ray(camera, x, y, scene)
            if pixel.hit is None:
                continue

            r = Reservoir()
            for _ in range(32):  # M = 32 candidates
                light_sample = scene.sample_light_source()
                p_hat = target_function(pixel.hit, light_sample)
                q = source_pdf(light_sample)
                r.update(light_sample, p_hat / q)

            # One shadow ray for the winner
            if not scene.occluded(pixel.hit.position, r.y):
                r.finalize(target_function(pixel.hit, r.y))
            else:
                r = Reservoir()  # occluded, discard

            reservoirs[y][x] = r

    # === Stage 2: Temporal reuse ===
    for y in range(height):
        for x in range(width):
            if prev_frame_data is None:
                continue
            px, py = reproject(x, y, prev_frame_data.motion_vectors)
            if 0 <= px < width and 0 <= py < height:
                r_prev = prev_frame_data.reservoirs[py][px]
                pixel = trace_primary_ray(camera, x, y, scene)
                # Clamp history length
                r_prev_clamped = Reservoir()
                r_prev_clamped.y = r_prev.y
                r_prev_clamped.M = min(r_prev.M, 20 * reservoirs[y][x].M)
                r_prev_clamped.W = r_prev.W
                r_prev_clamped.w_sum = r_prev.w_sum

                reservoirs[y][x] = combine_reservoirs(
                    reservoirs[y][x], r_prev_clamped,
                    lambda s: target_function(pixel.hit, s))

    # === Stage 3: Spatial reuse ===
    spatial_out = [[Reservoir() for _ in range(width)] for _ in range(height)]
    for y in range(height):
        for x in range(width):
            pixel = trace_primary_ray(camera, x, y, scene)
            r = reservoirs[y][x]
            r_out = Reservoir()
            p_hat_self = target_function(pixel.hit, r.y) if r.y else 0
            r_out.update(r.y, p_hat_self * r.W * r.M)
            r_out.M = r.M

            for _ in range(5):  # 5 spatial neighbors
                nx = x + randint(-30, 30)
                ny = y + randint(-30, 30)
                nx, ny = clamp(nx, 0, width-1), clamp(ny, 0, height-1)
                r_n = reservoirs[ny][nx]
                if r_n.y is None:
                    continue
                # Re-evaluate at current pixel
                p_hat_here = target_function(pixel.hit, r_n.y)
                r_out.update(r_n.y, p_hat_here * r_n.W * r_n.M)
                r_out.M += r_n.M

            if r_out.y is not None:
                r_out.finalize(target_function(pixel.hit, r_out.y))
            spatial_out[y][x] = r_out

    # === Final shading ===
    for y in range(height):
        for x in range(width):
            r = spatial_out[y][x]
            if r.y is not None and r.W > 0:
                pixel = trace_primary_ray(camera, x, y, scene)
                f = evaluate_brdf(pixel.hit, r.y)
                output[y, x] = f * r.W

    return output, spatial_out  # spatial_out becomes next frame's prev_data
```

<details>
<summary>Exercise: Reservoir sampling by hand</summary>
<p>Process these 4 candidates through a reservoir with weights $w = [3, 1, 5, 2]$. Show the state of the reservoir after each update, assuming the random numbers drawn are $\xi = [0.8, 0.3, 0.6, 0.9]$.</p>
<p><strong>Solution:</strong></p>
<p><em>After candidate 1:</em> $w_\text{sum} = 3$, replace if $\xi_1 < 3/3 = 1.0$. Since $0.8 < 1.0$, select candidate 1. $y = x_1$, $M = 1$.</p>
<p><em>After candidate 2:</em> $w_\text{sum} = 4$, replace if $\xi_2 < 1/4 = 0.25$. Since $0.3 > 0.25$, keep $x_1$. $y = x_1$, $M = 2$.</p>
<p><em>After candidate 3:</em> $w_\text{sum} = 9$, replace if $\xi_3 < 5/9 = 0.556$. Since $0.6 > 0.556$, keep $x_1$. $y = x_1$, $M = 3$.</p>
<p><em>After candidate 4:</em> $w_\text{sum} = 11$, replace if $\xi_4 < 2/11 = 0.182$. Since $0.9 > 0.182$, keep $x_1$. $y = x_1$, $M = 4$.</p>
<p>Final: $y = x_1$, $w_\text{sum} = 11$, $M = 4$. The output weight is $W = w_\text{sum} / (M \cdot \hat{p}(y)) = 11 / (4 \hat{p}(x_1))$.</p>
<p>Note: candidate 3 with weight 5 had the highest weight but was not selected due to the random draw. Over many runs, it would be selected $5/11 \approx 45\%$ of the time.</p>
</details>

<details>
<summary>Exercise: Compute effective sample count</summary>
<p>A ReSTIR pipeline uses $M = 16$ initial candidates, temporal reuse over $T = 30$ frames (capped at $20 \times M$), and $k = 3$ spatial neighbors. What is the effective candidate count per pixel? How does this compare to brute-force evaluation of all candidates?</p>
<p><strong>Solution:</strong></p>
<p>Temporal cap: $M_\text{temporal} = \min(M \times T, 20 \times M) = \min(480, 320) = 320$.</p>
<p>After temporal reuse, each pixel's reservoir represents $M_\text{after\_temporal} = M + M_\text{temporal} = 16 + 320 = 336$ candidates.</p>
<p>Spatial reuse combines $k + 1 = 4$ reservoirs (self + 3 neighbors), each representing ~336 candidates:</p>
<p>$M_\text{effective} = 4 \times 336 = 1{,}344$ candidates.</p>
<p>For a scene with $N = 1{,}000{,}000$ lights, brute-force would require evaluating all 1M lights. ReSTIR achieves similar quality with only 16 new light evaluations per frame (plus 1 shadow ray), a speedup of $\sim 62{,}500\times$ in light evaluations.</p>
<p>In practice, the effective sample count is an upper bound — correlated neighbors and geometric dissimilarity reduce the actual benefit.</p>
</details>

<details>
<summary>Exercise: Why clamp temporal history?</summary>
<p>ReSTIR DI clamps the temporal reservoir's $M$ count to a maximum (e.g., $20 \times M_\text{current}$). What happens if you remove this clamp? Describe the artifact.</p>
<p><strong>Solution:</strong></p>
<p>Without clamping, the temporal reservoir's $M$ count grows without bound over frames. After hundreds of frames, the temporal reservoir might claim $M = 10{,}000+$ candidates. When combined with the current frame's $M = 32$, the temporal sample dominates with weight $\sim 10{,}000 / 10{,}032 \approx 99.7\%$.</p>
<p>If the lighting changes (a light moves, turns on/off, or the object is now in shadow), the stale temporal sample persists for many frames because it almost always wins the reservoir combination. This manifests as <strong>temporal lag</strong> or <strong>ghosting</strong> — lights appear to "stick" or leave bright trails when the camera or lights move.</p>
<p>The clamp limits the temporal influence, ensuring new samples can replace stale ones within a bounded number of frames.</p>
</details>

## Key Takeaways

- **Resampled Importance Sampling** (RIS) draws $M$ candidates from a cheap source distribution and selects one proportional to the target distribution, effectively achieving high-quality importance sampling with minimal evaluations.
- **Weighted reservoir sampling** implements RIS in a streaming fashion with $O(1)$ memory, and reservoirs can be merged in constant time.
- **ReSTIR DI** (Bitterli et al. 2020) applies reservoir sampling to the many-lights problem with spatiotemporal reuse, achieving effective sample counts of thousands from just 32 new candidates per frame.
- **ReSTIR GI** (Ouyang et al. 2021) extends the framework to indirect illumination by resampling path suffixes, achieving 9x-166x MSE reduction over standard 1-spp path tracing.
- **ReSTIR PT / GRIS** (Lin et al. 2022) provides rigorous theoretical foundations for resampling correlated samples across different domains, enabling full path resampling.
- **Spatiotemporal reuse** is the key insight: by sharing samples across neighboring pixels and frames, each pixel benefits from thousands of candidates while generating only a few dozen new ones.
- The biased variant trades a small amount of energy loss at geometric edges for dramatically lower noise, making it practical for real-time rendering.
- References: Vitter (1985), Talbot et al. (2005), Bitterli et al. (2020), Ouyang et al. (2021), Lin et al. (2022), Kettunen et al. (2023).
