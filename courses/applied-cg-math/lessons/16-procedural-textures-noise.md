# Procedural Textures & Noise

Instead of storing colors in a bitmap, **procedural textures** compute them algorithmically at each point in space. The advantages are compelling: infinite resolution at any zoom level, zero texture memory, seamless tiling, and full parametric control. At the heart of nearly every procedural texture is a **noise function** -- a smooth, pseudo-random scalar field that mimics the controlled chaos found in natural materials. This lesson covers the major noise algorithms (Perlin, Simplex, Worley), the composition techniques that build rich textures from simple noise (fBm, domain warping, turbulence), and practical GLSL implementations for real-time use.

## Why Procedural?

| Property | Bitmap Texture | Procedural Texture |
|----------|----------------|-------------------|
| Resolution | Fixed (e.g., 4096x4096) | Infinite |
| Memory | Megabytes per texture | ~0 (code + parameters) |
| Tiling | Visible seams or special authoring | Naturally seamless |
| Parameterization | Bake a new texture | Change a uniform |
| 3D (solid) | Impractical to store | Evaluated anywhere in 3D |
| Variation | One look per texture | Infinite variation via seeds |

The trade-off is compute cost: noise evaluation is not free, and complex compositions (many octaves, domain warping) can strain fragment shader budgets. Modern GPUs handle this well for terrain and atmospheric effects, and offline renderers use procedural noise extensively.

## Perlin Noise (1985)

Ken Perlin invented **gradient noise** for the film *Tron* (1982), publishing the algorithm in 1985. The idea: place random gradient vectors on a regular integer lattice, then interpolate smoothly between them.

### Algorithm (2D)

Given a point $\mathbf{p} = (x, y)$:

**Step 1: Determine the grid cell.** Find the integer coordinates of the four surrounding lattice points:

$$(x_0, y_0), \; (x_0+1, y_0), \; (x_0, y_0+1), \; (x_0+1, y_0+1)$$

where $x_0 = \lfloor x \rfloor$, $y_0 = \lfloor y \rfloor$.

**Step 2: Compute gradient dot products.** Each lattice point has a pseudo-random gradient vector $\mathbf{g}$, selected by hashing the integer coordinates. Compute the **offset vector** from each lattice point to $\mathbf{p}$, then dot it with the gradient:

$$d_{ij} = \mathbf{g}(x_0 + i, \; y_0 + j) \cdot \bigl((x - x_0 - i), \; (y - y_0 - j)\bigr), \quad i,j \in \{0, 1\}$$

**Step 3: Interpolate.** Blend the four dot products using the fractional coordinates $(s, t) = (x - x_0, \; y - y_0)$ and a smooth interpolant $u(s)$:

$$n(\mathbf{p}) = \text{lerp}\!\Big(\text{lerp}(d_{00}, d_{10}, u(s)), \; \text{lerp}(d_{01}, d_{11}, u(s)), \; u(t)\Big)$$

### Interpolant Functions

Perlin's original (1985) used Hermite interpolation:

$$u(t) = 3t^2 - 2t^3$$

This is $C^1$ continuous (smooth, but the second derivative is discontinuous). This causes visible artifacts when computing derivatives (e.g., for bump mapping).

### Improved Perlin Noise (2002)

Perlin's 2002 revision made two changes:

1. **Quintic interpolant**: $u(t) = 6t^5 - 15t^4 + 10t^3$, which is $C^2$ continuous (second derivative is also smooth). This eliminates derivative discontinuity artifacts.

2. **Better gradient selection**: Instead of random unit vectors, use 12 directions aligned with edges of a cube: $(\pm 1, \pm 1, 0)$, $(\pm 1, 0, \pm 1)$, $(0, \pm 1, \pm 1)$. This avoids clustering and simplifies computation (no normalization needed).

### Hash Function

The classic Perlin permutation table maps integer coordinates to gradient indices:

```python
# Classic Perlin hash: permutation table P of size 256
def hash_2d(ix, iy):
    return P[(P[ix % 256] + iy) % 256]
```

On the GPU, this is typically replaced by an arithmetic hash to avoid the texture lookup:

```glsl
// GPU-friendly hash (no permutation table needed)
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
```

## Simplex Noise (Perlin 2001)

Perlin noise uses a square (2D) or cubic (3D) lattice, requiring $2^n$ gradient evaluations per point in $n$ dimensions. **Simplex noise** uses a **simplicial grid** (triangles in 2D, tetrahedra in 3D), reducing the number of evaluations to $n + 1$.

### Key Advantages

- **Fewer lookups**: $n + 1$ vs. $2^n$ gradient evaluations
- **Lower directional artifacts**: the simplex grid is more isotropic than the square grid
- **Constant cost**: $O(n)$ computation vs. $O(2^n)$
- **Analytically computable gradient**: useful for domain warping and bump mapping

### How It Works (2D)

1. **Skew** the input coordinates to map the simplicial grid to a square grid: $(x', y') = (x + (x+y) \cdot F, \; y + (x+y) \cdot F)$ where $F = (\sqrt{3} - 1) / 2$
2. **Find the simplex** (triangle) containing the point
3. **Unskew** back and compute offset vectors to the 3 simplex corners
4. **Evaluate** the radial kernel $\max(0, r^2 - d^2)^4 \cdot (\mathbf{g} \cdot \mathbf{d})$ at each corner, where $r$ is the kernel radius and $\mathbf{d}$ is the offset vector
5. **Sum** the three contributions

The radial falloff kernel naturally goes to zero outside each simplex, so only the enclosing simplex's corners contribute (no explicit interpolation step).

### OpenSimplex Noise

Due to patent concerns with the original simplex noise, **OpenSimplex** (KdotJPG, 2014) and **OpenSimplex2** (2020) provide patent-free alternatives with similar quality and performance. OpenSimplex2S (smooth variant) is commonly used in modern applications.

## Worley / Cellular Noise (Worley 1996)

Instead of gradient interpolation, **Worley noise** is based on distances to randomly distributed **feature points**. The result is a distance field that naturally creates cell-like patterns.

### Algorithm

1. **Scatter feature points**: place one random point per grid cell (jittered from the cell center)
2. **For each evaluation point**, search the enclosing cell and its neighbors (3x3 in 2D, 3x3x3 in 3D)
3. **Compute distances** to all found feature points
4. **Return** the $k$-th closest distance:
   - $F_1$: distance to nearest point (Voronoi cells)
   - $F_2$: distance to second-nearest point
   - $F_2 - F_1$: highlights cell boundaries (Voronoi edges)

### Distance Metrics

- **Euclidean**: $d = \sqrt{\Delta x^2 + \Delta y^2}$ -- round cells
- **Manhattan**: $d = |\Delta x| + |\Delta y|$ -- diamond-shaped cells
- **Chebyshev**: $d = \max(|\Delta x|, |\Delta y|)$ -- square cells

### Applications

- $F_1$: cobblestones, scales, biological cells, cracked mud
- $F_2 - F_1$: cell membranes, wire mesh, stained glass edges
- $F_1$ combined with Perlin noise: organic-looking stone, terrain features

## Fractal Brownian Motion (fBm)

A single octave of noise is too smooth and uniform to represent natural textures. **Fractal Brownian motion** layers multiple octaves of noise at increasing frequencies and decreasing amplitudes:

$$\text{fBm}(\mathbf{p}) = \sum_{i=0}^{N-1} A_i \cdot \text{noise}(F_i \cdot \mathbf{p})$$

where:

- $F_i = F_0 \cdot L^i$ is the frequency of octave $i$
- $A_i = A_0 \cdot G^i$ is the amplitude of octave $i$
- $L$ is the **lacunarity** (frequency multiplier, typically 2.0)
- $G$ is the **gain** (amplitude multiplier, also called **persistence**, typically 0.5)

### The Fractal Dimension

The Hurst exponent $H$ relates gain and lacunarity:

$$G = L^{-H}$$

For $L = 2$: $H = 1$ gives $G = 0.5$ (smooth terrain), $H = 0.5$ gives $G \approx 0.71$ (rough terrain). The fractal dimension is $D = n + 1 - H$ where $n$ is the spatial dimension.

### GLSL Implementation

```glsl
// Complete fBm implementation using Perlin-style gradient noise

// --- Hash and gradient noise ---
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gradientNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Quintic interpolant (C2 continuous)
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    // Four corner gradients
    float d00 = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
    float d10 = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
    float d01 = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
    float d11 = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

    return mix(mix(d00, d10, u.x),
               mix(d01, d11, u.x), u.y);
}

// --- Fractal Brownian Motion ---
float fbm(vec2 p, int octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < octaves; i++) {
        value += amplitude * gradientNoise(p * frequency);
        frequency *= lacunarity;
        amplitude *= gain;
    }
    return value;
}

// Usage: float height = fbm(worldPos.xz * 0.01, 8, 2.0, 0.5);
```

## Domain Warping

**Domain warping** feeds noise into the coordinate system of another noise evaluation, creating organic, flowing distortions:

$$\text{warp}(\mathbf{p}) = \text{fBm}\!\bigl(\mathbf{p} + \text{fBm}(\mathbf{p})\bigr)$$

Inigo Quilez popularized multi-level warping:

$$\mathbf{q} = \begin{pmatrix} \text{fBm}(\mathbf{p} + \mathbf{a}) \\ \text{fBm}(\mathbf{p} + \mathbf{b}) \end{pmatrix}, \quad
\mathbf{r} = \begin{pmatrix} \text{fBm}(\mathbf{p} + s \cdot \mathbf{q} + \mathbf{c}) \\ \text{fBm}(\mathbf{p} + s \cdot \mathbf{q} + \mathbf{d}) \end{pmatrix}$$

$$\text{result} = \text{fBm}(\mathbf{p} + s \cdot \mathbf{r})$$

where $\mathbf{a}, \mathbf{b}, \mathbf{c}, \mathbf{d}$ are constant offsets (to decorrelate the noise evaluations) and $s$ controls warp strength. The result resembles flowing paint, geological strata, or alien organic patterns.

```glsl
// Domain warping - two levels
float domainWarp(vec2 p) {
    vec2 q = vec2(fbm(p + vec2(0.0, 0.0), 6, 2.0, 0.5),
                  fbm(p + vec2(5.2, 1.3), 6, 2.0, 0.5));

    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2), 6, 2.0, 0.5),
                  fbm(p + 4.0 * q + vec2(8.3, 2.8), 6, 2.0, 0.5));

    return fbm(p + 4.0 * r, 6, 2.0, 0.5);
}
```

## Turbulence

**Turbulence** is fBm using the absolute value of noise, creating sharp creases at zero crossings:

$$\text{turb}(\mathbf{p}) = \sum_{i=0}^{N-1} A_i \cdot |\text{noise}(F_i \cdot \mathbf{p})|$$

This produces vein-like and flame-like patterns. The classic **marble texture** uses turbulence to warp a sine wave:

$$\text{marble}(\mathbf{p}) = \sin\!\bigl(x + k \cdot \text{turb}(\mathbf{p})\bigr)$$

where $k$ controls the amount of veining. Similarly, **wood grain**:

$$\text{wood}(\mathbf{p}) = \sin\!\bigl(k \cdot \sqrt{x^2 + y^2} + \text{turb}(\mathbf{p})\bigr)$$

## Worked Example: Computing 2D Perlin Noise at a Point

Evaluate improved Perlin noise at $\mathbf{p} = (1.3, 0.7)$.

### Step 1: Grid Cell

$$x_0 = \lfloor 1.3 \rfloor = 1, \quad y_0 = \lfloor 0.7 \rfloor = 0$$

Fractional part: $(s, t) = (0.3, 0.7)$

Four lattice corners: $(1,0)$, $(2,0)$, $(1,1)$, $(2,1)$

### Step 2: Pseudo-Random Gradients

Suppose the hash function assigns (using the improved Perlin gradient set):

| Corner | Gradient $\mathbf{g}$ |
|--------|----------------------|
| $(1,0)$ | $(1, 1)$ |
| $(2,0)$ | $(-1, 1)$ |
| $(1,1)$ | $(1, -1)$ |
| $(2,1)$ | $(-1, -1)$ |

### Step 3: Offset Vectors and Dot Products

| Corner | Offset $\Delta$ | $\mathbf{g} \cdot \Delta$ |
|--------|-----------------|--------------------------|
| $(1,0)$ | $(0.3, 0.7)$ | $1 \times 0.3 + 1 \times 0.7 = 1.0$ |
| $(2,0)$ | $(-0.7, 0.7)$ | $-1 \times (-0.7) + 1 \times 0.7 = 1.4$ |
| $(1,1)$ | $(0.3, -0.3)$ | $1 \times 0.3 + (-1) \times (-0.3) = 0.6$ |
| $(2,1)$ | $(-0.7, -0.3)$ | $-1 \times (-0.7) + (-1) \times (-0.3) = 1.0$ |

### Step 4: Quintic Interpolant

$$u(0.3) = 6(0.3)^5 - 15(0.3)^4 + 10(0.3)^3 = 6(0.00243) - 15(0.0081) + 10(0.027)$$
$$= 0.01458 - 0.1215 + 0.27 = 0.16308$$

$$u(0.7) = 6(0.7)^5 - 15(0.7)^4 + 10(0.7)^3 = 6(0.16807) - 15(0.2401) + 10(0.343)$$
$$= 1.00842 - 3.6015 + 3.43 = 0.83692$$

### Step 5: Bilinear Interpolation

Bottom edge: $\text{lerp}(1.0, 1.4, 0.16308) = 1.0 + 0.4 \times 0.16308 = 1.0652$

Top edge: $\text{lerp}(0.6, 1.0, 0.16308) = 0.6 + 0.4 \times 0.16308 = 0.6652$

Final: $\text{lerp}(1.0652, 0.6652, 0.83692) = 1.0652 + (0.6652 - 1.0652) \times 0.83692$

$$= 1.0652 - 0.4 \times 0.83692 = 1.0652 - 0.33477 = \mathbf{0.7304}$$

The Perlin noise value at $(1.3, 0.7)$ is approximately **0.73**. In practice, improved Perlin noise typically outputs values in $[-1, 1]$; this particular configuration of gradients happens to produce a positive value.

## Applications

### Terrain Heightmaps

$$h(\mathbf{p}) = \text{fBm}(\mathbf{p}, \text{octaves}=8, L=2.0, G=0.5)$$

Add **ridged noise** for mountain ridges: $\text{ridge}(\mathbf{p}) = 1 - |\text{noise}(\mathbf{p})|$, then fBm the ridged version.

### Marble and Wood

Marble: $\text{color} = \text{palette}\bigl(\sin(x + 5 \cdot \text{turb}(\mathbf{p}))\bigr)$

Wood: $\text{color} = \text{palette}\bigl(\text{fract}(20 \cdot \|\mathbf{p}.xz\| + \text{fBm}(\mathbf{p}))\bigr)$

### Cloud Shapes

Production cloud renderers (Guerrilla Games' Horizon, Frostbite) use Worley and Perlin noise combined to define cloud density fields:

$$\text{density}(\mathbf{p}) = \text{remap}(\text{Perlin}(\mathbf{p}), \; W(\mathbf{p}) - 1, \; 1, \; 0, \; 1)$$

where $W$ is Worley $F_1$ noise used to carve holes in the Perlin base, creating the billowy shapes characteristic of cumulus clouds.

### Procedural Planets

Layered fBm with different parameters per latitude band, domain warping for continent shapes, Worley noise for crater fields, and turbulence for atmospheric storm patterns.

<details>
<summary><strong>Exercise 1</strong>: fBm Amplitude Sum</summary>

For an fBm with gain $G = 0.5$ and $N = 8$ octaves, what is the maximum possible amplitude (sum of all octave amplitudes, starting at $A_0 = 1$)?

**Solution**:

$$A_{\text{max}} = \sum_{i=0}^{7} G^i = \sum_{i=0}^{7} 0.5^i = \frac{1 - 0.5^8}{1 - 0.5} = \frac{1 - 0.00391}{0.5} = 1.9922$$

So the output range is approximately $[-2, 2]$. To normalize to $[-1, 1]$, divide by this sum.
</details>

<details>
<summary><strong>Exercise 2</strong>: Quintic vs. Hermite Interpolant</summary>

Compute both interpolants at $t = 0.5$:

(a) Hermite: $u(t) = 3t^2 - 2t^3$
(b) Quintic: $u(t) = 6t^5 - 15t^4 + 10t^3$

Show that both give the same value at $t = 0.5$, then compute their second derivatives at $t = 0$ to show why the quintic is superior.

**Solution**:

(a) $u(0.5) = 3(0.25) - 2(0.125) = 0.75 - 0.25 = 0.5$
(b) $u(0.5) = 6(0.03125) - 15(0.0625) + 10(0.125) = 0.1875 - 0.9375 + 1.25 = 0.5$

Both give 0.5 at the midpoint (by symmetry).

Second derivatives:
- Hermite: $u''(t) = 6 - 12t$, so $u''(0) = 6 \neq 0$ (discontinuous with neighbor cell)
- Quintic: $u''(t) = 120t^3 - 180t^2 + 60t$, so $u''(0) = 0$ ($C^2$ continuous!)

The quintic's vanishing second derivative at lattice boundaries ensures smooth normal maps and bump mapping.
</details>

<details>
<summary><strong>Exercise 3</strong>: Worley Noise Distance</summary>

In a 2D grid with feature points at $(0.2, 0.8)$, $(1.6, 0.3)$, and $(0.9, 1.5)$, compute $F_1$ and $F_2$ for the evaluation point $\mathbf{p} = (1.0, 1.0)$ using Euclidean distance.

**Solution**:

Distances:
- To $(0.2, 0.8)$: $\sqrt{0.64 + 0.04} = \sqrt{0.68} = 0.825$
- To $(1.6, 0.3)$: $\sqrt{0.36 + 0.49} = \sqrt{0.85} = 0.922$
- To $(0.9, 1.5)$: $\sqrt{0.01 + 0.25} = \sqrt{0.26} = 0.510$

Sorted: $0.510, \; 0.825, \; 0.922$

$F_1 = 0.510$ (nearest), $F_2 = 0.825$ (second nearest)

$F_2 - F_1 = 0.315$ (this value is large, so the point is far from a cell boundary)
</details>

<details>
<summary><strong>Exercise 4</strong>: Domain Warping by Hand</summary>

Given a simple 1D noise function $n(x) = \sin(2\pi x)$, compute the domain-warped value at $x = 0.25$ with warp strength $s = 0.5$:

$$w(x) = n(x + s \cdot n(x))$$

**Solution**:

$n(0.25) = \sin(2\pi \times 0.25) = \sin(\pi/2) = 1.0$

Warped coordinate: $x' = 0.25 + 0.5 \times 1.0 = 0.75$

$w(0.25) = n(0.75) = \sin(2\pi \times 0.75) = \sin(3\pi/2) = -1.0$

Without warping, $n(0.25) = 1.0$. With warping, the result flips to $-1.0$. Domain warping can dramatically reshape the noise landscape.
</details>

## Key Takeaways

- **Procedural textures** trade memory for computation, providing infinite resolution, seamless tiling, and parametric control
- **Perlin noise** (1985, improved 2002) uses gradient vectors on a lattice with smooth interpolation; the quintic interpolant ($C^2$) eliminates derivative artifacts
- **Simplex noise** uses a simplicial grid for $O(n)$ complexity and fewer directional artifacts; OpenSimplex2 is the patent-free alternative
- **Worley/cellular noise** computes distances to scattered feature points, producing cell and Voronoi patterns
- **fBm** layers octaves of noise with lacunarity (frequency scaling) and gain (amplitude scaling) to create fractal detail
- **Domain warping** feeds noise into noise coordinates, generating organic flowing patterns
- **Turbulence** uses $|\text{noise}|$ to create vein-like creases; combined with sine waves, it produces marble and wood textures
- Production applications range from terrain heightmaps and cloud density fields to procedural planet generation
