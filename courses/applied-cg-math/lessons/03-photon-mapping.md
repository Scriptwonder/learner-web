# Photon Mapping

Photon mapping, introduced by Henrik Wann Jensen (1996), is a two-pass global illumination algorithm that excels at rendering **caustics** and other light paths that standard path tracing handles poorly. The first pass traces photons from light sources and stores them in a spatial data structure; the second pass uses density estimation to reconstruct radiance at visible points. This lesson covers the full algorithm, kd-tree storage, radiance estimation, progressive variants, and practical implementation.

## Motivation: Why Photon Mapping?

Recall from the light transport notation lesson that **caustic paths** ($LS^+DE$) require light to pass through specular surfaces before hitting diffuse surfaces. Path tracing builds paths from the eye and cannot efficiently find the specular chain leading back to the light.

Photon mapping solves this by **tracing from the light side**: photons naturally flow through specular chains and deposit energy wherever they hit diffuse surfaces. The stored photon distribution directly represents the irradiance field, including caustics.

## The Two-Pass Algorithm

### Pass 1: Photon Tracing

Emit photons from light sources and trace them through the scene, storing them when they interact with diffuse surfaces.

```python
def photon_tracing_pass(scene, num_photons):
    """Pass 1: Trace photons from lights and store in photon maps."""
    caustic_map = PhotonMap()
    global_map = PhotonMap()

    for i in range(num_photons):
        # Emit a photon from a random light source
        light, pdf_light = scene.sample_light()
        origin, direction, Le, pdf_dir = light.emit_photon()
        power = Le / (pdf_light * pdf_dir * num_photons)

        prev_specular = False
        for bounce in range(max_bounces):
            hit = scene.intersect(Ray(origin, direction))
            if hit is None:
                break

            if hit.is_diffuse():
                # Store photon at diffuse surfaces
                photon = Photon(hit.position, direction, power)
                if prev_specular:
                    caustic_map.store(photon)   # LS+D path
                global_map.store(photon)        # any L...D path

            # Russian roulette for continuation
            albedo = hit.brdf.albedo()
            if random() > max(albedo):
                break
            power *= hit.brdf.eval(direction, wi) / max(albedo)

            # Sample next direction from BRDF
            wi, pdf = hit.brdf.sample(-direction, hit.normal)
            prev_specular = hit.is_specular()
            origin = hit.position + wi * 1e-4
            direction = wi

    # Build kd-trees for efficient lookup
    caustic_map.build_kd_tree()
    global_map.build_kd_tree()
    return caustic_map, global_map
```

**Key details:**

- **Photon power** is the flux ($\Phi$) carried by each photon, not radiance. The total emitted power is distributed equally among all photons.
- **Separate maps**: The **caustic photon map** stores only photons that underwent at least one specular interaction before hitting a diffuse surface. The **global photon map** stores all photons at diffuse surfaces.
- **Specular surfaces** do not store photons — they redirect them. Only diffuse interactions create stored photons.
- **Russian roulette** controls path termination, with continuation probability based on surface albedo.

### Pass 2: Rendering (Final Gather)

For each visible point, estimate radiance using the stored photons.

```python
def render_with_photon_map(scene, camera, caustic_map, global_map,
                           width, height, spp, k_nearest=100):
    """Pass 2: Render using photon map radiance estimates."""
    image = np.zeros((height, width, 3))

    for y in range(height):
        for x in range(width):
            for s in range(spp):
                ray = camera.generate_ray((x + random()) / width,
                                          (y + random()) / height)
                hit = scene.intersect(ray)
                if hit is None:
                    image[y, x] += scene.environment(ray.direction)
                    continue

                color = np.zeros(3)

                # Direct illumination (standard NEE)
                color += compute_direct(hit, scene)

                # Caustics from caustic photon map (high-res estimate)
                color += estimate_radiance(caustic_map, hit, k=60)

                # Indirect illumination via final gather
                color += final_gather(hit, scene, global_map, k_nearest)

                image[y, x] += color
            image[y, x] /= spp
    return image
```

The rendering pass typically combines:

1. **Direct illumination**: Computed analytically or via shadow rays (not from the photon map)
2. **Caustics**: Estimated directly from the caustic photon map with high photon density
3. **Indirect diffuse**: Computed via **final gather** — shoot secondary rays and use the global photon map at secondary hit points

## Photon Storage in a Kd-Tree

Photons are stored in a **kd-tree** (k-dimensional tree, with $k = 3$ for 3D positions), which enables efficient nearest-neighbor queries.

### Building the Kd-Tree

1. Choose the splitting axis: cycle through $x, y, z$, or use the axis of maximum extent
2. Find the median photon along the splitting axis
3. Place the median at the current node
4. Recursively build left and right subtrees

A **balanced** kd-tree has $O(\log n)$ depth and enables $O(\log n + k)$ nearest-neighbor queries, where $k$ is the number of neighbors found.

### Kd-Tree Node Structure

```python
@dataclass
class KdNode:
    photon: Photon          # stored photon (position, direction, power)
    split_axis: int         # 0 = x, 1 = y, 2 = z
    left: 'KdNode' = None
    right: 'KdNode' = None

def build_kd_tree(photons, depth=0):
    if len(photons) == 0:
        return None
    axis = depth % 3
    photons.sort(key=lambda p: p.position[axis])
    mid = len(photons) // 2
    return KdNode(
        photon=photons[mid],
        split_axis=axis,
        left=build_kd_tree(photons[:mid], depth + 1),
        right=build_kd_tree(photons[mid+1:], depth + 1)
    )
```

### K-Nearest Neighbor Query

To estimate radiance at a point $\mathbf{x}$, we find the $k$ nearest photons using a priority queue bounded by the maximum search radius:

```python
def knn_query(node, query_point, k, max_dist_sq, heap):
    """Find k nearest photons to query_point."""
    if node is None:
        return

    axis = node.split_axis
    dist_sq = np.sum((node.photon.position - query_point) ** 2)

    if dist_sq < max_dist_sq:
        if len(heap) < k:
            heapq.heappush(heap, (-dist_sq, node.photon))
        elif dist_sq < -heap[0][0]:
            heapq.heapreplace(heap, (-dist_sq, node.photon))
            max_dist_sq = -heap[0][0]  # shrink search radius

    # Determine which side of the split plane to search first
    delta = query_point[axis] - node.photon.position[axis]
    near = node.left if delta < 0 else node.right
    far = node.right if delta < 0 else node.left

    knn_query(near, query_point, k, max_dist_sq, heap)
    if delta * delta < max_dist_sq:
        knn_query(far, query_point, k, max_dist_sq, heap)
```

## Radiance Estimation via Kernel Density Estimation

Given $k$ nearest photons $\{p_1, \ldots, p_k\}$ around a surface point $\mathbf{x}$ with normal $\mathbf{n}$, the radiance estimate is:

$$L_r(\mathbf{x}, \omega_o) \approx \frac{1}{\pi r^2} \sum_{j=1}^{k} f_r(\mathbf{x}, \omega_{p_j}, \omega_o) \, \Phi_j \, K\!\left(\frac{\|\mathbf{x} - \mathbf{x}_{p_j}\|}{r}\right)$$

where:

- $r$ is the distance to the $k$-th nearest photon (the search radius)
- $\Phi_j$ is the power (flux) carried by photon $j$
- $\omega_{p_j}$ is the incoming direction of photon $j$
- $K(d/r)$ is a **kernel function** that weights photons by distance
- $\pi r^2$ is the projected area of the search disk on the surface

### Kernel Functions

| Kernel | $K(t)$ for $t \in [0, 1]$ | Properties |
|--------|--------------------------|------------|
| Box (flat) | $K(t) = 1$ | Simple but discontinuous at boundary |
| Cone | $K(t) = 1 - t$ | Reduces boundary bias |
| Gaussian | $K(t) = e^{-\alpha t^2}$ ($\alpha \approx 1.818$) | Smooth, minimal boundary artifacts |
| Epanechnikov | $K(t) = 1 - t^2$ | Statistically optimal for density estimation |

The denominator $\pi r^2$ comes from the area of the disk enclosing the $k$ photons, projected onto the surface plane. More precisely, for a non-flat kernel, the normalization ensures the estimate is unbiased in the limit.

### Bias-Variance Trade-off

- **Large $k$** (many photons, large radius): Low variance (smooth) but high bias (blurry details)
- **Small $k$** (few photons, small radius): Low bias (sharp) but high variance (noisy)
- Typical values: $k \in [50, 500]$ depending on scene complexity

The photon map radiance estimate is **biased** — it blurs the true radiance over the search radius. This bias decreases as the photon count increases and the search radius shrinks. In the limit of infinite photons with radius $\to 0$, the estimate converges to the true radiance.

## Worked Example: Irradiance Estimation from 5 Photons

**Setup:** Estimate the irradiance at point $\mathbf{x}$ on a Lambertian surface ($f_r = \rho/\pi = 0.8/\pi$) using $k = 5$ nearest photons. We use a flat (box) kernel for simplicity.

| Photon $j$ | Distance $d_j$ (m) | Power $\Phi_j$ (W) |
|------------|--------------------|--------------------|
| 1 | 0.02 | 0.005 |
| 2 | 0.04 | 0.008 |
| 3 | 0.06 | 0.003 |
| 4 | 0.07 | 0.006 |
| 5 | 0.10 | 0.004 |

The search radius is $r = d_5 = 0.10$ m (distance to the farthest of the 5 photons).

**Step 1: Compute irradiance estimate.**

The irradiance (incident flux per unit area) is estimated by:

$$E(\mathbf{x}) \approx \frac{1}{\pi r^2} \sum_{j=1}^{k} \Phi_j$$

$$= \frac{1}{\pi (0.10)^2} (0.005 + 0.008 + 0.003 + 0.006 + 0.004)$$

$$= \frac{0.026}{\pi \times 0.01}$$

$$= \frac{0.026}{0.03142} \approx 0.827 \text{ W/m}^2$$

**Step 2: Convert to reflected radiance.**

For a Lambertian surface with albedo $\rho = 0.8$:

$$L_r(\mathbf{x}) = \frac{\rho}{\pi} \times E(\mathbf{x}) = \frac{0.8}{\pi} \times 0.827 = 0.2546 \times 0.827 \approx 0.211 \text{ W/(m}^2\text{sr)}$$

**Step 3: With a cone kernel** ($K(t) = 1 - t/r$), the estimate becomes:

$$E(\mathbf{x}) \approx \frac{1}{\pi r^2} \sum_{j=1}^{k} \Phi_j \left(1 - \frac{d_j}{r}\right) \cdot \frac{3}{1}$$

The factor of 3 is the normalization constant for the cone kernel (so that $\int_0^1 K(t) \cdot 2t \, dt = 1$ in 2D). Applying:

$$= \frac{3}{\pi (0.01)} \left[0.005(0.8) + 0.008(0.6) + 0.003(0.4) + 0.006(0.3) + 0.004(0.0)\right]$$

$$= \frac{3}{0.03142} \left[0.004 + 0.0048 + 0.0012 + 0.0018 + 0\right]$$

$$= 95.49 \times 0.0118 = 1.127 \text{ W/m}^2$$

The cone kernel gives higher weight to closer photons, which in this case increases the estimate because the nearby photons carry more power per unit area.

## Progressive Photon Mapping

Standard photon mapping requires storing all photons in memory, which can be prohibitive for high-quality renders. **Progressive Photon Mapping** (PPM, Hachisuka et al. 2008) solves this by iteratively refining the estimate without storing the full photon map.

### Algorithm

1. **Ray tracing pass**: Trace paths from the camera and store visible diffuse hit points with their accumulated throughput
2. **Photon pass**: Emit photons from lights, trace them through the scene
3. **Accumulation**: For each stored hit point, find nearby photons and update the running radiance estimate
4. **Radius reduction**: After each photon pass, shrink the search radius:

$$r_{i+1} = r_i \sqrt{\frac{N_i + \alpha M_i}{N_i + M_i}}$$

where $N_i$ is the accumulated photon count, $M_i$ is the new photon count in this pass, and $\alpha \in (0, 1)$ controls the reduction rate (typically $\alpha = 2/3$).

5. **Repeat** from step 2 with fresh photons

### Convergence

As iterations increase:
- The search radius $r \to 0$
- The accumulated photon count $\to \infty$
- The bias $\to 0$ (sharper details)
- The variance $\to 0$ (smoother image)
- The estimate **converges to the correct result**

This is in contrast to standard photon mapping, where the bias never fully disappears for a fixed photon count.

### Update Rule

At each hit point, maintain running statistics $(\tau_i, N_i, r_i)$:

```python
def update_hit_point(hp, new_photons, alpha=2.0/3.0):
    """Progressive photon mapping update for one hit point."""
    M = len(new_photons)  # new photons within radius r
    if M == 0:
        return

    # Compute flux from new photons
    new_flux = sum(hp.brdf_eval(p.direction) * p.power for p in new_photons)

    # Progressive update
    N_new = hp.N + alpha * M
    r_new = hp.r * np.sqrt(N_new / (hp.N + M))

    # Update accumulated flux (scaled by area ratio)
    hp.tau = (hp.tau + new_flux) * (r_new / hp.r) ** 2
    hp.N = N_new
    hp.r = r_new

    # Radiance estimate at this point after i passes:
    # L = tau / (pi * r^2 * total_emitted_photons)
```

## Stochastic Progressive Photon Mapping (SPPM)

**Stochastic Progressive Photon Mapping** (Hachisuka and Jensen 2009) extends PPM by re-tracing the eye paths in each iteration with new random samples. This means:

- Each iteration uses **different** camera ray jitter and BRDF samples
- Hit points vary between iterations (not fixed as in PPM)
- The algorithm handles **distributed effects**: depth of field, motion blur, glossy reflections

SPPM is a **consistent** estimator — it converges to the correct result as the number of iterations approaches infinity, for any scene. This property makes it one of the most robust global illumination algorithms, though convergence can be slow.

### Recent Advances

- **Neural-accelerated SPPM** (2021): Deep neural networks predict kernel functions for photon aggregation, achieving high-quality caustics with an order of magnitude fewer photons
- **Denoising SPPM** (Zheng et al. 2020): Multi-residual networks denoise intermediate SPPM renders while preserving caustic detail
- **Manifold-based photon mapping** (Zeltner et al. 2020): Handles specular-diffuse-specular paths by exploiting the manifold structure of specular chains

<details>
<summary>Exercise: Compute irradiance from 3 photons with Gaussian kernel</summary>
<p>Three photons are found near a surface point with distances $d_1 = 0.01$ m, $d_2 = 0.03$ m, $d_3 = 0.05$ m and powers $\Phi_1 = 0.01$ W, $\Phi_2 = 0.02$ W, $\Phi_3 = 0.015$ W. The search radius is $r = 0.05$ m. Using a Gaussian kernel $K(t) = e^{-2t^2}$, estimate the irradiance.</p>
<p><strong>Solution:</strong></p>
<p>Compute normalized distances: $t_1 = 0.01/0.05 = 0.2$, $t_2 = 0.03/0.05 = 0.6$, $t_3 = 0.05/0.05 = 1.0$.</p>
<p>Kernel weights: $K(0.2) = e^{-0.08} = 0.923$, $K(0.6) = e^{-0.72} = 0.487$, $K(1.0) = e^{-2.0} = 0.135$.</p>
<p>Weighted flux sum: $0.01 \times 0.923 + 0.02 \times 0.487 + 0.015 \times 0.135 = 0.00923 + 0.00974 + 0.00203 = 0.0210$ W.</p>
<p>Normalization factor (for Gaussian in 2D): $C = \frac{1}{(1 - e^{-2}) \pi r^2} \approx \frac{1}{0.8647 \times 0.007854} = \frac{1}{0.006790} = 147.3$.</p>
<p>Irradiance: $E \approx 147.3 \times 0.0210 = 3.09$ W/m$^2$.</p>
</details>

<details>
<summary>Exercise: Progressive radius reduction</summary>
<p>A hit point starts with radius $r_0 = 0.1$ m and $N_0 = 0$ accumulated photons. After the first photon pass, $M_1 = 12$ photons land within the radius. Using $\alpha = 2/3$, compute the new radius $r_1$ and the accumulated count $N_1$. Then, if the second pass adds $M_2 = 18$ photons, compute $r_2$ and $N_2$.</p>
<p><strong>Solution:</strong></p>
<p><em>After pass 1:</em></p>
<p>$N_1 = N_0 + \alpha M_1 = 0 + (2/3)(12) = 8$</p>
<p>$r_1 = r_0 \sqrt{\frac{N_1}{N_0 + M_1}} = 0.1 \sqrt{\frac{8}{12}} = 0.1 \sqrt{0.667} = 0.1 \times 0.8165 = 0.0816$ m</p>
<p><em>After pass 2:</em></p>
<p>$N_2 = N_1 + \alpha M_2 = 8 + (2/3)(18) = 8 + 12 = 20$</p>
<p>$r_2 = r_1 \sqrt{\frac{N_2}{N_1 + M_2}} = 0.0816 \sqrt{\frac{20}{26}} = 0.0816 \sqrt{0.769} = 0.0816 \times 0.877 = 0.0716$ m</p>
<p>The radius steadily shrinks, reducing bias while the photon count grows.</p>
</details>

<details>
<summary>Exercise: Why separate caustic and global photon maps?</summary>
<p>Jensen recommends using two separate photon maps: a high-resolution caustic map and a lower-resolution global map. Explain why this separation improves quality, and what would happen if you used a single map for everything.</p>
<p><strong>Solution:</strong></p>
<p>Caustics are localized, high-frequency features — a bright focused spot on a small area. To resolve them accurately, you need many photons per unit area in the caustic region, requiring a dense photon map visualized directly (no final gather).</p>
<p>Indirect diffuse illumination is smooth and low-frequency, so it can tolerate a sparser photon map combined with a final gather step (shooting secondary rays and averaging photon map lookups).</p>
<p>With a single map, you face a dilemma: if you use enough photons for caustics, you waste memory and query time on the smooth indirect component. If you use final gather everywhere, the caustics get blurred because final gather averages over a spatial neighborhood. The separation lets each component be handled with the appropriate resolution and estimation technique.</p>
</details>

## Key Takeaways

- **Photon mapping** (Jensen 1996) is a two-pass algorithm: trace photons from lights (building photon maps), then estimate radiance at visible points using density estimation.
- Photons are stored in a **kd-tree** for efficient $k$-nearest-neighbor queries in $O(\log n + k)$ time.
- **Radiance estimation** divides the total photon power by the search area $\pi r^2$, weighted by a kernel function. This is a **biased** estimator that trades sharpness for smoothness.
- **Separate caustic and global photon maps** allow high-resolution caustics without wasting resources on smooth indirect illumination.
- **Progressive Photon Mapping** (Hachisuka 2008) iteratively refines the estimate, shrinking the search radius to eliminate bias — the estimate **converges** to the correct result.
- **SPPM** (Hachisuka-Jensen 2009) re-randomizes eye paths each iteration, handling distributed effects and guaranteeing consistency.
- References: Jensen (1996), Hachisuka, Ogaki, Jensen (2008), Hachisuka and Jensen (2009), Pharr et al. PBRT 4th ed. (2023).
