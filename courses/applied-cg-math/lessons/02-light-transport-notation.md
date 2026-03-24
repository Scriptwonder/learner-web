# Light Transport Notation and GI Algorithms

Understanding which global illumination algorithm handles which type of light path is essential for choosing the right technique for a given scene. Paul Heckbert (1990) introduced a compact **regular expression notation** for describing light paths, providing a powerful language for classifying and comparing GI algorithms. This lesson covers the notation, key path types, bidirectional path tracing, Metropolis Light Transport, and a systematic comparison of algorithms.

## Heckbert's Light Transport Notation

A light path is a sequence of vertices from a light source to the eye (camera). Each vertex is classified by the type of scattering event that occurs there:

| Symbol | Meaning | Examples |
|--------|---------|---------|
| $L$ | Light source (emission vertex) | Point light, area light, environment map |
| $E$ | Eye (camera vertex) | Pinhole, thin lens |
| $D$ | Diffuse scattering | Lambertian surface, rough dielectric |
| $S$ | Specular scattering | Mirror reflection, glass refraction |

A complete path always starts with $L$ and ends with $E$. Using regular expression operators:

| Operator | Meaning |
|----------|---------|
| $*$ | Zero or more repetitions |
| $+$ | One or more repetitions |
| $\|$ | OR (alternation) |
| $(\ )$ | Grouping |

### Examples

- $LE$ — direct emission (camera looks directly at a light)
- $LDE$ — direct diffuse illumination (one diffuse bounce)
- $LSE$ — direct specular illumination (mirror reflection of a light)
- $LDDE$ — one-bounce indirect diffuse (light $\to$ diffuse $\to$ diffuse $\to$ eye)
- $LSDE$ — caustic (light reflects/refracts specularly, then hits a diffuse surface)
- $LS^+DE$ — caustic via multiple specular bounces

## Key Path Categories

### Direct Illumination: $LD^*E$

Paths where light travels (possibly through diffuse bounces... but in practice we mean $LDE$) from a light to a diffuse surface to the eye without any specular interaction. Standard rasterization with shadow maps handles $LDE$.

More precisely, a single-bounce direct illumination path is $L(D|S)E$ — light reaches the eye through one surface interaction.

### Caustics: $LS^+D(S|D)^*E$

Light undergoes one or more **specular** interactions before hitting a **diffuse** surface. These create the bright focused patterns on pool floors (refraction caustics) and the bright spots from a ring reflecting sunlight (reflection caustics).

Caustics are among the hardest paths for standard path tracing because:
- Tracing from the eye, the probability of randomly sampling the exact specular chain back to the light is essentially zero
- The path must be built from the light side through specular vertices

### Indirect Diffuse: $LD^+E$ (with 2+ D bounces)

Light bounces between multiple diffuse surfaces before reaching the eye. This creates **color bleeding** (the red/green walls of a Cornell box tinting the white surfaces) and **ambient occlusion** effects. Standard path tracing handles these well.

### Specular-Diffuse-Specular (SDS): $LS^+D^+S^+E$

Light passes through specular surfaces, bounces off diffuse surfaces, and exits through specular surfaces to the eye. Example: a caustic pattern seen through a glass window. These are among the most challenging paths in rendering.

### Full Global Illumination: $L(D|S)^*E$

All possible paths. No single algorithm handles every path type efficiently.

## Path Classification Table

| Path regex | Name | Example |
|-----------|------|---------|
| $LE$ | Direct emission | Looking at a light bulb |
| $LDE$ | Direct diffuse | Shadow-mapped surface lighting |
| $LSE$ | Direct specular | Mirror reflecting a light |
| $LS^+DE$ | Caustic | Sunlight focused through a glass sphere |
| $LDS^+E$ | Specular indirect | Diffuse wall seen in a mirror |
| $LD^+E$ | Indirect diffuse | Color bleeding in Cornell box |
| $LDD^+E$ | Multi-bounce diffuse | Deep indirect illumination |
| $LS^+DS^+E$ | SDS path | Caustic seen through glass |
| $L(D|S)^+E$ | Full GI | Everything |

## Bidirectional Path Tracing

**Bidirectional path tracing** (BDPT), introduced by Lafortune and Willems (1993) and independently by Veach and Guibas (1994), constructs paths from **both** the light and the eye simultaneously, then connects the sub-paths.

### Algorithm

1. **Trace a light sub-path:** Emit a photon from a light source, trace it through the scene for $s$ bounces: $\mathbf{y}_0, \mathbf{y}_1, \ldots, \mathbf{y}_s$
2. **Trace an eye sub-path:** Cast a ray from the camera, trace it for $t$ bounces: $\mathbf{z}_0, \mathbf{z}_1, \ldots, \mathbf{z}_t$
3. **Connect:** For each pair $(\mathbf{y}_i, \mathbf{z}_j)$, check visibility and compute the contribution of the full path $\mathbf{y}_0 \ldots \mathbf{y}_i \mathbf{z}_j \ldots \mathbf{z}_0$
4. **Combine** all connection strategies using MIS

A BDPT path of length $k = s + t + 1$ vertices can be formed by $k+1$ different **strategies** $(s, t)$ where $s$ ranges from 0 to $k$ (number of light sub-path vertices used). Each strategy has a different PDF and different efficiency for different path types.

### Why BDPT Helps

| Strategy $(s, t)$ | Equivalent to | Good for |
|-------------------|---------------|----------|
| $(0, k)$ | Standard path tracing | Diffuse indirect |
| $(1, k-1)$ | NEE from path tracing | Direct illumination |
| $(k, 0)$ | Light tracing | Caustics onto diffuse |
| $(k-1, 1)$ | Light tracing + connect to camera | SDS paths |
| General $(s, t)$ | Hybrid | Mixed paths |

The MIS combination of all strategies is provably better than any single strategy alone.

```python
def bidirectional_path_trace(scene, camera_ray, max_depth=8):
    """Simplified BDPT: trace light and eye sub-paths, connect them."""
    # Trace eye sub-path
    eye_vertices = trace_subpath(camera_ray, scene, max_depth)

    # Trace light sub-path
    light_ray, Le, pdf_light = scene.sample_light_ray()
    light_vertices = trace_subpath(light_ray, scene, max_depth)

    radiance = np.zeros(3)

    # Try all (s, t) connection strategies
    for s in range(len(light_vertices) + 1):
        for t in range(len(eye_vertices) + 1):
            if s + t < 2:
                continue  # need at least 2 vertices

            # Compute path contribution and MIS weight
            path = connect(light_vertices[:s], eye_vertices[:t])
            if path is not None and path.visible:
                f = path.throughput()
                pdf = path.pdf()
                mis_weight = compute_mis_weight(s, t, path)
                radiance += f / pdf * mis_weight

    return radiance
```

## Metropolis Light Transport (MLT)

**Metropolis Light Transport** (Veach and Guibas 1997) applies the Metropolis-Hastings algorithm to light transport. Instead of generating independent paths, MLT **mutates** an existing path to explore nearby path space, spending more time on high-contribution regions.

### Core Idea

1. Start with a seed path $\bar{x}$ (found by BDPT or path tracing)
2. Propose a **mutation** $\bar{x}'$ (perturb the path slightly)
3. **Accept** the mutation with probability:

$$a(\bar{x} \to \bar{x}') = \min\left(1, \frac{f(\bar{x}')}{f(\bar{x})}\right)$$

where $f(\bar{x})$ is the contribution (scalar luminance) of path $\bar{x}$.

4. If accepted, $\bar{x} \leftarrow \bar{x}'$; otherwise keep $\bar{x}$
5. Record the contribution of the current path
6. Repeat

### Mutation Strategies

Veach and Guibas proposed several mutation types:

- **Bidirectional mutation:** Re-trace portions of the light or eye sub-path, keeping the rest fixed
- **Perturbation:** Slightly perturb one or more path vertices
- **Caustic perturbation:** Specialized mutation for specular chains
- **Lens perturbation:** Modify the camera vertex to explore nearby pixels

### Properties

- **Ergodic:** The Markov chain can eventually reach any path from any starting path
- **Detailed balance:** The acceptance probability ensures the stationary distribution is proportional to path contribution $f(\bar{x})$
- **Handles difficult paths:** Once a caustic or SDS path is found, MLT explores similar paths efficiently
- **Correlation:** Successive samples are correlated (not independent), which can cause structured artifacts instead of uniform noise

### Strengths and Weaknesses

**Strengths:**
- Excels at finding and exploiting difficult light paths (caustics, SDS)
- Unbiased in the limit
- Can handle any path type

**Weaknesses:**
- Correlated samples produce structured noise artifacts
- Difficult to parallelize efficiently on GPUs
- Can get "stuck" in local modes of path space
- Hard to combine with adaptive sampling / denoising

**Multiplexed MLT** (Hachisuka et al. 2014) and **Ensemble MLT** (Otsu et al. 2022) address some of these limitations by running multiple chains and better exploring path space.

## Light Path Expressions for Categorizing Algorithms

Modern renderers like Arnold, RenderMan, and Mantra use **Light Path Expressions (LPEs)** — an extension of Heckbert's notation — to decompose rendered images into per-component AOVs (Arbitrary Output Variables):

```
# Example LPEs (Arnold/OSL syntax)
C<RD>L          # Direct diffuse
C<RS>L          # Direct specular
C<RD><RD>L      # 1-bounce indirect diffuse
C<RS><RD>L      # Caustic: specular then diffuse
C<RD>.*<RD>L    # All indirect diffuse
C<TD>L          # Direct transmission (diffuse)
```

Here $C$ = camera, $R$ = reflection, $T$ = transmission, $D$ = diffuse, $S$ = specular, $L$ = light. The `.*` wildcard matches any sequence of events.

LPEs let compositors isolate and adjust individual lighting components in post-production.

## Algorithm Comparison: Which Handles What?

The following table rates each algorithm's efficiency at different path types. A rating of **excellent** means low variance for that path type; **poor** means the algorithm struggles.

| Path type | Path tracing + NEE | Photon mapping | BDPT | MLT | ReSTIR PT |
|-----------|-------------------|----------------|------|-----|-----------|
| $LDE$ (direct diffuse) | Excellent | Good | Excellent | Good | Excellent |
| $LSE$ (direct specular) | Excellent | N/A | Excellent | Good | Excellent |
| $LS^+DE$ (caustics) | Poor | Excellent | Good | Excellent | Poor-Good |
| $LD^+E$ (indirect diffuse) | Good | Good | Good | Good | Good |
| $LDS^+E$ (specular indirect) | Good | N/A | Good | Good | Good |
| $LS^+DS^+E$ (SDS) | Very Poor | Poor | Good | Excellent | Poor |
| $LS^+D^+S^+E$ (complex) | Very Poor | Poor | Good | Excellent | Poor |

### Explanation of Ratings

- **Path tracing + NEE**: Excellent at direct illumination (NEE samples lights). Poor at caustics because BRDF sampling from the eye side cannot efficiently find specular chains leading to lights.
- **Photon mapping**: Excellent at caustics (photons naturally flow through specular chains and deposit on diffuse surfaces). Poor at SDS because the final gather step traces from the eye.
- **BDPT**: Good at most path types because it tries all $(s,t)$ strategies. The light sub-path handles caustics, the eye sub-path handles specular indirect.
- **MLT**: Excellent at difficult paths once found, because it explores nearby path space. The mutation strategy adapts to whatever paths dominate the image.
- **ReSTIR PT** (Lin et al. 2022): Excellent at direct illumination and good at indirect diffuse through path reuse. Struggles with pure specular chains because reservoir resampling cannot efficiently share paths across specular boundaries.

### Choosing an Algorithm

| Scene characteristics | Recommended algorithm |
|----------------------|----------------------|
| Simple direct lighting | Path tracing + NEE |
| Lots of caustics | Photon mapping or MLT |
| Mixed difficult lighting | BDPT or MLT |
| Real-time constraint | ReSTIR DI/GI/PT |
| Production rendering | BDPT + MLT hybrid |
| Interior architecture | Path tracing + many-light sampling |

<details>
<summary>Exercise: Classify these light paths</summary>
<p>For each scenario, write the Heckbert path notation:</p>
<ol>
<li>Sunlight enters a window, bounces off a white floor, illuminating the ceiling</li>
<li>A candle flame reflected in a polished metal vase</li>
<li>Light from a lamp focused by a glass paperweight onto a desk</li>
<li>The color bleeding from a red curtain onto a white wall, seen in a bathroom mirror</li>
</ol>
<p><strong>Solutions:</strong></p>
<ol>
<li>$LDDE$ — light $\to$ floor (diffuse) $\to$ ceiling (diffuse) $\to$ eye. Two diffuse bounces (indirect diffuse).</li>
<li>$LSE$ — light $\to$ specular reflection in metal $\to$ eye. Direct specular illumination.</li>
<li>$LS^+DE$ — light $\to$ one or more specular refractions through glass $\to$ diffuse desk surface $\to$ eye. This is a caustic.</li>
<li>$LDSE$ — light $\to$ red curtain (diffuse) $\to$ white wall (diffuse, but seen via) $\to$ mirror (specular) $\to$ eye. Actually $LDD SE$ — but more precisely: light $\to$ curtain ($D$) $\to$ wall ($D$) $\to$ mirror ($S$) $\to$ eye = $LDDSE$. This is a specular-indirect path with diffuse color bleeding.</li>
</ol>
</details>

<details>
<summary>Exercise: Why can't path tracing handle caustics well?</summary>
<p>Explain, using the path notation, why a standard path tracer (tracing from the eye) has difficulty rendering the caustic $LS^+DE$.</p>
<p><strong>Solution:</strong></p>
<p>A path tracer builds paths from right to left: $E \to D \to S^+ \to L$. At the diffuse vertex $D$, the tracer must sample a direction that hits the specular surface at exactly the right angle to eventually reach the light. For a perfect mirror ($S$), the BRDF is a delta function — only one exact direction reflects toward the light. The probability of randomly sampling this exact direction is zero in the continuous case, or negligibly small for near-specular surfaces.</p>
<p>From the light side, the path is natural: emit a photon, let it reflect/refract through the specular chain, and record where it lands on the diffuse surface. This is why photon mapping and the light sub-path of BDPT handle caustics efficiently.</p>
</details>

<details>
<summary>Exercise: Count BDPT strategies</summary>
<p>For a path of total length $k = 4$ (vertices: light, two intermediate, eye), how many BDPT strategies $(s, t)$ exist? List them and describe what each is equivalent to.</p>
<p><strong>Solution:</strong></p>
<p>A path with $k = 4$ vertices has $k + 1 = 5$ strategies (from $s = 0$ to $s = 4$, where $s + t = k = 4$):</p>
<p>$(s=0, t=4)$: Pure path tracing — all 4 vertices from the eye side.</p>
<p>$(s=1, t=3)$: Path tracing with next-event estimation — 3 eye vertices, connect to light.</p>
<p>$(s=2, t=2)$: Two vertices from each side, connect in the middle.</p>
<p>$(s=3, t=1)$: Light tracing with 3 light vertices, connect to camera sub-path of length 1.</p>
<p>$(s=4, t=0)$: Pure light tracing — all 4 vertices from the light side, splatted to the image.</p>
<p>MIS combines all 5 strategies, weighting each by its relative efficiency for the specific path geometry.</p>
</details>

## Key Takeaways

- **Heckbert's notation** ($L$, $D$, $S$, $E$ with regex operators) provides a compact language for describing and classifying light paths.
- **Caustics** ($LS^+DE$) are hard for path tracing because sampling specular chains from the eye side is nearly impossible.
- **Bidirectional path tracing** builds paths from both light and eye, combining all $(s,t)$ strategies via MIS. This handles a wider range of path types than unidirectional methods.
- **Metropolis Light Transport** (Veach-Guibas 1997) applies MCMC mutation to paths, excelling at rare, high-contribution paths like SDS and complex caustics.
- **No single algorithm handles all paths efficiently** — production renderers use hybrids (BDPT + MLT, path tracing + photon mapping, etc.).
- **Light Path Expressions** extend the notation for practical use in production AOV decomposition.
- References: Heckbert (1990), Lafortune & Willems (1993), Veach & Guibas (1994, 1997), Pharr et al. PBRT 4th ed. (2023).
