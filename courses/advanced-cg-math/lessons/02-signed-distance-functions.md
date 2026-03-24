# Signed Distance Functions

Signed distance functions (SDFs) are a powerful implicit representation of geometry. Instead of storing triangles or vertices, an SDF encodes a shape as a scalar field: at every point in space, the function returns the shortest distance to the surface, with the sign indicating whether the point is inside (negative) or outside (positive). This simple idea unlocks an extraordinary range of techniques — from ray marching procedural scenes with infinite detail, to font rendering, soft shadows, ambient occlusion, and CSG modeling. Much of the foundational work was popularized by Inigo Quilez through Shadertoy and his reference articles (iquilezles.org, 2008--present).

## Definition of an SDF

A **signed distance function** $f : \mathbb{R}^3 \to \mathbb{R}$ satisfies:

$$f(\vec{p}) = \begin{cases} -d(\vec{p}, S) & \text{if } \vec{p} \text{ is inside the surface } S \\ 0 & \text{if } \vec{p} \text{ is on } S \\ +d(\vec{p}, S) & \text{if } \vec{p} \text{ is outside } S \end{cases}$$

where $d(\vec{p}, S) = \min_{\vec{q} \in S} |\vec{p} - \vec{q}|$ is the Euclidean distance to the nearest point on the surface.

Key properties of a true SDF:

- **The zero level set** $\{\vec{p} : f(\vec{p}) = 0\}$ is the surface itself
- **The gradient** $\nabla f$ at the surface equals the outward unit normal: $|\nabla f| = 1$ everywhere (the Eikonal equation)
- **Lipschitz continuity:** $|f(\vec{a}) - f(\vec{b})| \leq |\vec{a} - \vec{b}|$, meaning the function never changes faster than distance itself

In practice, many useful "SDFs" in shader programming are only **approximate** distance functions (they underestimate the true distance). This is fine for sphere tracing as long as the function never overestimates — overestimation causes the ray to step through surfaces.

## Basic SDF Primitives

The following are exact SDFs for common primitives, written in GLSL. These formulas are from Inigo Quilez's reference collection (iquilezles.org/articles/distfunctions).

### Sphere

$$f(\vec{p}) = |\vec{p} - \vec{c}| - r$$

```glsl
float sdSphere(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}
```

### Box (Axis-Aligned)

For a box centered at the origin with half-extents $\vec{b}$:

$$f(\vec{p}) = |\max(\vec{q}, 0)| + \min(\max(q_x, q_y, q_z), 0)$$

where $\vec{q} = |\vec{p}| - \vec{b}$ (component-wise absolute value and subtraction).

```glsl
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
```

The first term handles the exterior distance (outside corners/edges). The second term handles the interior (negative when inside).

### Torus

A torus with major radius $R$ (center of tube to center of torus) and minor radius $r$ (tube radius), centered at the origin in the XZ plane:

$$f(\vec{p}) = \left| \left( \sqrt{p_x^2 + p_z^2} - R,\; p_y \right) \right| - r$$

```glsl
float sdTorus(vec3 p, float R, float r) {
    vec2 q = vec2(length(p.xz) - R, p.y);
    return length(q) - r;
}
```

### Plane

An infinite plane with unit normal $\vec{n}$ and offset $h$ from the origin:

$$f(\vec{p}) = \vec{p} \cdot \vec{n} - h$$

```glsl
float sdPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) - h;
}
```

### Cylinder

An infinite cylinder of radius $r$ along the Y axis:

```glsl
float sdCylinder(vec3 p, float r) {
    return length(p.xz) - r;
}
```

For a capped cylinder with half-height $h$:

```glsl
float sdCappedCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
```

## CSG Operations

One of the most compelling features of SDFs is that **Constructive Solid Geometry** reduces to simple scalar operations on the distance values.

### Union (OR)

The union of two shapes is the minimum of their SDFs:

$$f_{A \cup B}(\vec{p}) = \min(f_A(\vec{p}),\; f_B(\vec{p}))$$

```glsl
float opUnion(float d1, float d2) {
    return min(d1, d2);
}
```

### Intersection (AND)

The intersection is the maximum:

$$f_{A \cap B}(\vec{p}) = \max(f_A(\vec{p}),\; f_B(\vec{p}))$$

```glsl
float opIntersection(float d1, float d2) {
    return max(d1, d2);
}
```

### Subtraction (Difference)

Subtracting shape $B$ from shape $A$ is the intersection of $A$ with the complement of $B$:

$$f_{A \setminus B}(\vec{p}) = \max(f_A(\vec{p}),\; -f_B(\vec{p}))$$

```glsl
float opSubtraction(float d1, float d2) {
    return max(d1, -d2);
}
```

Note that subtraction is **not commutative**: $A \setminus B \neq B \setminus A$.

### Why CSG Works

For union: the closest surface point to $\vec{p}$ is the closer of the two surfaces, so $\min$ gives the correct distance. For intersection: a point is inside both shapes only when both SDFs are negative, and $\max$ of two negatives is the less negative one (the tighter constraint). For subtraction: negating an SDF flips inside/outside, then intersection keeps only the part of $A$ that is outside $B$.

## Smooth Blending (Smooth Minimum)

Hard CSG produces sharp edges at the intersection of shapes. **Smooth blending** uses a smooth minimum function to create organic, melted transitions. The most widely used variant is the **polynomial smooth min** (Quilez, 2008):

$$\text{smin}(a, b, k) = \min(a, b) - \frac{h^2 k}{4}$$

where $h = \max(k - |a - b|, 0) / k$ and $k > 0$ controls the blending radius.

```glsl
// Polynomial smooth minimum (Quilez)
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}
```

There is also the **cubic** variant for smoother second derivatives:

```glsl
// Cubic smooth minimum — C2 continuous
float sminCubic(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0 / 6.0);
}
```

The parameter $k$ is in world-space units and defines the radius over which the blend occurs. When $|a - b| > k$, the smooth min degenerates to the hard $\min$. Other variants include the exponential smooth min ($\text{smin}(a,b,k) = -k \ln(e^{-a/k} + e^{-b/k})$) and the power smooth min, but the polynomial version is preferred for its speed, simplicity, and intuitive $k$ parameter.

## Sphere Tracing / Ray Marching

**Sphere tracing** (Hart, 1996) is the algorithm that makes SDFs practical for rendering. It is a specialized form of ray marching that exploits the distance bound provided by the SDF.

### The Algorithm

Given a ray with origin $\vec{O}$ and direction $\vec{D}$, sphere tracing finds the first intersection with the zero level set:

1. Start at $t = 0$ (at the ray origin)
2. Evaluate the SDF at the current position: $d = f(\vec{O} + t\vec{D})$
3. If $d < \epsilon$ (a small threshold), we have a hit. Return $t$.
4. Otherwise, advance along the ray: $t \leftarrow t + d$
5. If $t > t_{max}$, the ray missed. Return no hit.
6. Go to step 2.

The critical insight is that $d = f(\vec{p})$ gives a **conservative bound** on the distance to the nearest surface. So we can safely advance by $d$ without skipping past any surface. Near the surface, steps shrink automatically, giving sub-pixel accuracy.

### Convergence

For a true SDF, sphere tracing converges linearly. The number of steps depends on the scene complexity and the angles between the ray and surfaces. Grazing rays (nearly tangent to the surface) converge slowly. In practice, 64--256 steps suffice for most scenes.

### GLSL Sphere Marching Example

```glsl
// Scene SDF — combine your primitives here
float sceneSDF(vec3 p) {
    float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 0.0);
    float sphere = sdSphere(p, vec3(0.0, 1.0, 0.0), 1.0);
    float box = sdBox(p - vec3(2.5, 0.75, 0.0), vec3(0.75));
    float torus = sdTorus(p - vec3(-2.5, 1.0, 0.0), 0.8, 0.3);

    float scene = opUnion(ground, sphere);
    scene = opUnion(scene, box);
    scene = smin(scene, torus, 0.5);  // smooth blend torus
    return scene;
}

// Sphere tracing / ray marching
float sphereTrace(vec3 ro, vec3 rd, float tMax) {
    float t = 0.0;
    for (int i = 0; i < 128; i++) {
        vec3 p = ro + t * rd;
        float d = sceneSDF(p);
        if (d < 0.001) return t;   // surface hit
        t += d;
        if (t > tMax) break;       // escaped the scene
    }
    return -1.0;  // no hit
}

// Main image generation
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // Camera setup
    vec3 ro = vec3(0.0, 2.0, -5.0);  // ray origin
    vec3 rd = normalize(vec3(uv, 1.5));  // ray direction

    float t = sphereTrace(ro, rd, 100.0);

    if (t > 0.0) {
        vec3 p = ro + t * rd;
        vec3 n = calcNormal(p);
        // Simple directional lighting
        float diff = max(dot(n, normalize(vec3(1.0, 1.0, -1.0))), 0.0);
        fragColor = vec4(vec3(0.1 + 0.9 * diff), 1.0);
    } else {
        fragColor = vec4(0.1, 0.1, 0.15, 1.0);  // background
    }
}
```

## Computing Normals from the SDF Gradient

Since the gradient of an SDF at the surface equals the outward normal, we can compute normals numerically using **central differences**:

$$\vec{N}(\vec{p}) = \text{normalize}\left(\nabla f(\vec{p})\right) \approx \text{normalize}\begin{pmatrix} f(p_x + \epsilon, p_y, p_z) - f(p_x - \epsilon, p_y, p_z) \\ f(p_x, p_y + \epsilon, p_z) - f(p_x, p_y - \epsilon, p_z) \\ f(p_x, p_y, p_z + \epsilon) - f(p_x, p_y, p_z - \epsilon) \end{pmatrix}$$

```glsl
vec3 calcNormal(vec3 p) {
    const float e = 0.0005;
    return normalize(vec3(
        sceneSDF(p + vec3(e, 0, 0)) - sceneSDF(p - vec3(e, 0, 0)),
        sceneSDF(p + vec3(0, e, 0)) - sceneSDF(p - vec3(0, e, 0)),
        sceneSDF(p + vec3(0, 0, e)) - sceneSDF(p - vec3(0, 0, e))
    ));
}
```

This requires **6 additional SDF evaluations** per normal computation. A tetrahedron-based optimization reduces this to 4 evaluations:

```glsl
vec3 calcNormalTet(vec3 p) {
    const float e = 0.0005;
    const vec2 k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * sceneSDF(p + k.xyy * e) +
        k.yyx * sceneSDF(p + k.yyx * e) +
        k.yxy * sceneSDF(p + k.yxy * e) +
        k.xxx * sceneSDF(p + k.xxx * e)
    );
}
```

This leverages the four vertices of a tetrahedron centered at $\vec{p}$ to compute the gradient with fewer evaluations while maintaining accuracy.

## Practical Applications

### Font Rendering

Valve introduced SDF-based font rendering in 2007 (Green, "Improved Alpha-Tested Magnification for Vector Textures and Special Effects"). Instead of storing a high-resolution bitmap, they store a low-resolution SDF texture. At render time, the SDF is sampled and thresholded:

- $f < 0$: inside the glyph (render foreground color)
- $f > 0$: outside the glyph (render background / discard)
- Smooth transition around $f = 0$ gives anti-aliased edges

This technique scales to arbitrary resolution with minimal memory, supports outlines, drop shadows, and glow effects by thresholding at different distances, and is standard in game engines (Unity TextMeshPro, Unreal Slate).

### Soft Shadows

SDFs enable cheap **soft shadows** without shadow maps. During the shadow ray march, track the closest approach to any surface:

```glsl
float softShadow(vec3 ro, vec3 rd, float tMin, float tMax, float k) {
    float res = 1.0;
    float t = tMin;
    for (int i = 0; i < 64; i++) {
        float d = sceneSDF(ro + t * rd);
        if (d < 0.001) return 0.0;  // fully in shadow
        res = min(res, k * d / t);
        t += d;
        if (t > tMax) break;
    }
    return res;
}
```

The ratio $d / t$ estimates how "close" the shadow ray came to an occluder relative to the distance traveled. The parameter $k$ controls shadow softness. This is one of the signature techniques of the demoscene and Shadertoy communities.

### Ambient Occlusion

SDFs provide a natural estimate of ambient occlusion by sampling the distance field along the surface normal at increasing distances:

```glsl
float ambientOcclusion(vec3 p, vec3 n) {
    float ao = 0.0;
    float scale = 1.0;
    for (int i = 1; i <= 5; i++) {
        float dist = 0.05 * float(i);
        float d = sceneSDF(p + n * dist);
        ao += (dist - d) * scale;
        scale *= 0.5;
    }
    return clamp(1.0 - 2.0 * ao, 0.0, 1.0);
}
```

If the SDF value at distance $d$ along the normal is less than $d$, something is occluding that direction. The weighted sum over multiple distances gives a smooth AO estimate.

### Procedural Modeling

SDFs combined with domain repetition, warping, and noise enable infinitely detailed procedural worlds with zero mesh data:

```glsl
// Infinite repetition of an SDF
float opRepeat(vec3 p, vec3 spacing) {
    vec3 q = mod(p + 0.5 * spacing, spacing) - 0.5 * spacing;
    return sceneSDF(q);  // evaluate SDF in the repeated cell
}

// Domain warping for organic shapes
float warpedSDF(vec3 p) {
    p += 0.1 * sin(3.0 * p.yzx);  // twist/warp the domain
    return sdSphere(p, vec3(0.0), 1.0);
}
```

## Modern Uses in Production

### Mesh Processing and Nanite

Unreal Engine 5's Lumen global illumination system uses **mesh distance fields** — per-object SDFs stored as 3D textures — for software ray tracing of indirect lighting and reflections. These are generated offline from triangle meshes and streamed at runtime. The SDF representation allows fast approximate ray intersections against complex objects without tracing individual triangles.

### Neural SDFs

DeepSDF (Park et al., 2019) pioneered learning continuous SDFs from point clouds using neural networks. This has evolved into a major research direction: neural SDFs serve as compact, differentiable shape representations in 3D reconstruction, generation, and editing pipelines. Recent work (2024--2025) by Hubert-Brierre et al. ("Accelerating Signed Distance Functions," Computer Graphics Forum 2025) achieves up to three orders of magnitude speedup in SDF evaluation through spatial acceleration structures, making neural and analytic SDFs practical for interactive applications.

### Recursive SDF Rendering

A 2026 approach by Bhatt ("A Recursive Algorithm to Render Signed Distance Fields") proposes recursively subdividing screen tiles and using the SDF's Lipschitz bound to skip empty regions, combining the adaptivity of recursive ray tracing with the simplicity of SDF evaluation.

## Exercises

<details>
<summary>Exercise: Derive the Box SDF</summary>

<p>Consider a 2D box centered at the origin with half-extents $(b_x, b_y) = (2, 1)$. Compute the SDF value at point $P = (3, 0)$ and at $P = (1, 0.5)$.</p>

<p><strong>Solution:</strong></p>

<p>For $P = (3, 0)$: $\vec{q} = |P| - \vec{b} = (3 - 2, 0 - 1) = (1, -1)$. The point is outside in $x$, inside in $y$. $f = |\max(\vec{q}, 0)| + \min(\max(q_x, q_y), 0) = |(1, 0)| + \min(1, 0) = 1 + 0 = 1$. The point is 1 unit away from the box surface.</p>

<p>For $P = (1, 0.5)$: $\vec{q} = (1 - 2, 0.5 - 1) = (-1, -0.5)$. Both components are negative, so the point is inside. $f = |\max(\vec{q}, 0)| + \min(\max(-1, -0.5), 0) = 0 + \min(-0.5, 0) = -0.5$. The point is 0.5 units inside the box (nearest surface is the top/bottom face).</p>
</details>

<details>
<summary>Exercise: CSG Operations</summary>

<p>You have a sphere SDF $f_S(\vec{p}) = |\vec{p}| - 2$ and a box SDF $f_B(\vec{p}) = \text{sdBox}(\vec{p}, (1.5, 1.5, 1.5))$. At point $\vec{p} = (1, 1, 1)$, compute the SDF value for: (a) union, (b) intersection, (c) subtraction $S \setminus B$.</p>

<p><strong>Solution:</strong></p>

<p>First evaluate each primitive: $f_S = |(1,1,1)| - 2 = \sqrt{3} - 2 \approx -0.268$ (inside sphere). $\vec{q} = |(1,1,1)| - (1.5,1.5,1.5) = (-0.5,-0.5,-0.5)$. $f_B = 0 + \min(-0.5, 0) = -0.5$ (inside box).</p>

<p>(a) Union: $\min(-0.268, -0.5) = -0.5$ (inside both, distance to nearest surface of either)</p>

<p>(b) Intersection: $\max(-0.268, -0.5) = -0.268$ (inside both, distance to nearest surface of the tighter shape)</p>

<p>(c) Subtraction $S \setminus B$: $\max(f_S, -f_B) = \max(-0.268, 0.5) = 0.5$ (outside, because we removed the box interior from the sphere)</p>
</details>

<details>
<summary>Exercise: Sphere Tracing Steps</summary>

<p>A ray starts at $\vec{O} = (0, 0, -5)$ with direction $\vec{D} = (0, 0, 1)$ toward a sphere of radius 1 centered at the origin. Trace the first 4 steps of sphere tracing and verify convergence.</p>

<p><strong>Solution:</strong></p>

<p>The SDF is $f(\vec{p}) = |\vec{p}| - 1$.</p>

<p>Step 1: $t = 0$, $\vec{p} = (0,0,-5)$, $d = 5 - 1 = 4$. Advance: $t = 4$.</p>

<p>Step 2: $t = 4$, $\vec{p} = (0,0,-1)$, $d = 1 - 1 = 0$. Hit!</p>

<p>The ray converges in just 2 steps because the ray is aimed directly at the sphere center. The first step covers the entire gap, and the second lands exactly on the surface. For a ray with a slight offset (e.g., aimed at the sphere's edge), more steps would be needed due to the glancing approach angle.</p>
</details>

## Key Takeaways

- An SDF maps every point in space to its signed distance from the nearest surface: negative inside, positive outside, zero on the surface
- Basic primitives (sphere, box, torus, plane) have elegant closed-form SDFs
- CSG operations reduce to `min` (union), `max` (intersection), and `max(a, -b)` (subtraction) on distance values
- Smooth blending via the polynomial smooth min creates organic transitions between shapes, controlled by a single parameter $k$
- Sphere tracing marches along a ray using the SDF value as a guaranteed safe step size, converging to the surface in typically 64--256 iterations
- Surface normals are computed from the SDF gradient via finite differences (6 or 4 extra evaluations)
- SDFs enable soft shadows, ambient occlusion, and procedural modeling with minimal geometric data
- Font rendering via SDF textures provides resolution-independent, anti-aliased text with support for outlines and effects
- Production engines (UE5 Lumen) use mesh distance fields for fast approximate ray tracing of indirect lighting
- Neural SDFs (DeepSDF and successors) represent shapes as learned continuous functions, with recent work achieving orders-of-magnitude acceleration
