# Ray-Geometry Intersections

Ray tracing boils down to one question asked millions of times per frame: "Does this ray hit that object, and if so, where?" Every ray tracer, shadow test, picking system, and physics engine needs fast, correct ray-geometry intersection tests. This lesson covers the four essential intersection algorithms: ray-plane, ray-sphere, ray-triangle (Moller-Trumbore), and ray-AABB (axis-aligned bounding box). These are the workhorses of 3D rendering.

## The Ray

A ray is defined by an **origin** $\vec{O}$ and a **direction** $\vec{D}$:

$$\vec{R}(t) = \vec{O} + t\,\vec{D}, \quad t \geq 0$$

Any point on the ray is obtained by plugging in a value of $t$. At $t = 0$, you are at the origin. As $t$ increases, you move along the direction. Negative $t$ values represent points behind the origin — typically not valid intersections.

We usually assume $\vec{D}$ is **normalized** ($|\vec{D}| = 1$), which makes $t$ equal to the actual distance along the ray. Some algorithms work with unnormalized directions for efficiency.

## Ray-Plane Intersection

### The Plane

A plane is defined by a normal vector $\vec{N}$ and a signed distance $d$ from the origin:

$$\vec{N} \cdot \vec{P} = d$$

Any point $\vec{P}$ satisfying this equation lies on the plane. Alternatively, you can define the plane with a normal $\vec{N}$ and a known point $\vec{P}_0$ on the plane, giving $d = \vec{N} \cdot \vec{P}_0$.

### Derivation

Substitute the ray equation into the plane equation:

$$\vec{N} \cdot (\vec{O} + t\vec{D}) = d$$

$$\vec{N} \cdot \vec{O} + t(\vec{N} \cdot \vec{D}) = d$$

$$t = \frac{d - \vec{N} \cdot \vec{O}}{\vec{N} \cdot \vec{D}}$$

### Conditions

- If $\vec{N} \cdot \vec{D} = 0$, the ray is **parallel** to the plane — no intersection (or the ray lies entirely in the plane if $\vec{N} \cdot \vec{O} = d$)
- If $t < 0$, the intersection is **behind** the ray origin — not a valid hit
- If $t \geq 0$, the intersection point is $\vec{R}(t) = \vec{O} + t\vec{D}$

```cpp
bool rayPlane(Vec3 O, Vec3 D, Vec3 N, float d, float& t) {
    float denom = dot(N, D);
    if (fabsf(denom) < 1e-8f)
        return false;  // ray parallel to plane

    t = (d - dot(N, O)) / denom;
    return t >= 0.0f;
}
```

## Ray-Sphere Intersection

### The Sphere

A sphere is defined by a center $\vec{C}$ and radius $r$:

$$|\vec{P} - \vec{C}|^2 = r^2$$

### Analytic Solution

Substitute the ray into the sphere equation:

$$|\vec{O} + t\vec{D} - \vec{C}|^2 = r^2$$

Let $\vec{L} = \vec{O} - \vec{C}$ (vector from sphere center to ray origin). Expanding:

$$(\vec{D} \cdot \vec{D})\,t^2 + 2(\vec{D} \cdot \vec{L})\,t + (\vec{L} \cdot \vec{L} - r^2) = 0$$

This is a standard quadratic $at^2 + bt + c = 0$ with:

$$a = \vec{D} \cdot \vec{D}$$
$$b = 2(\vec{D} \cdot \vec{L})$$
$$c = \vec{L} \cdot \vec{L} - r^2$$

If $\vec{D}$ is normalized, then $a = 1$ and the formula simplifies.

### The Discriminant

The discriminant $\Delta = b^2 - 4ac$ determines the number of intersections:

| $\Delta$ | Intersections | Geometry |
|---|---|---|
| $\Delta < 0$ | None | Ray misses the sphere |
| $\Delta = 0$ | One | Ray is tangent to the sphere |
| $\Delta > 0$ | Two | Ray passes through the sphere |

The solutions are:

$$t = \frac{-b \pm \sqrt{\Delta}}{2a}$$

The smaller positive $t$ gives the **nearest** intersection point (where the ray enters the sphere). If both $t$ values are negative, the sphere is entirely behind the ray origin.

### Geometric Solution

An equivalent but sometimes more numerically stable approach:

1. Compute $\vec{L} = \vec{C} - \vec{O}$ (center relative to ray origin)
2. $t_{ca} = \vec{L} \cdot \vec{D}$ — projection of $\vec{L}$ onto the ray direction
3. If $t_{ca} < 0$ and the origin is outside the sphere, no hit
4. $d^2 = \vec{L} \cdot \vec{L} - t_{ca}^2$ — squared distance from sphere center to closest point on ray
5. If $d^2 > r^2$, the ray misses
6. $t_{hc} = \sqrt{r^2 - d^2}$
7. $t_0 = t_{ca} - t_{hc}$, $t_1 = t_{ca} + t_{hc}$

```cpp
bool raySphere(Vec3 O, Vec3 D, Vec3 C, float r, float& tHit) {
    Vec3 L = O - C;
    float a = dot(D, D);
    float b = 2.0f * dot(D, L);
    float c = dot(L, L) - r * r;

    float discriminant = b * b - 4.0f * a * c;
    if (discriminant < 0.0f)
        return false;

    float sqrtDisc = sqrtf(discriminant);
    float t0 = (-b - sqrtDisc) / (2.0f * a);
    float t1 = (-b + sqrtDisc) / (2.0f * a);

    // t0 <= t1 always. Pick the nearest positive t.
    if (t0 >= 0.0f) {
        tHit = t0;
        return true;
    }
    if (t1 >= 0.0f) {
        tHit = t1;  // origin is inside the sphere
        return true;
    }
    return false;  // sphere is behind the ray
}
```

```glsl
// GLSL ray-sphere intersection (normalized direction)
float raySphere(vec3 O, vec3 D, vec3 C, float r) {
    vec3 L = O - C;
    float b = dot(D, L);
    float c = dot(L, L) - r * r;
    float disc = b * b - c;  // a = 1 for normalized D
    if (disc < 0.0) return -1.0;
    float sqrtDisc = sqrt(disc);
    float t0 = -b - sqrtDisc;
    float t1 = -b + sqrtDisc;
    return t0 >= 0.0 ? t0 : (t1 >= 0.0 ? t1 : -1.0);
}
```

### Computing the Normal

At the intersection point $\vec{P}_{hit}$, the surface normal points outward from the center:

$$\vec{N} = \frac{\vec{P}_{hit} - \vec{C}}{r}$$

If the ray originates inside the sphere (e.g., for refractive materials), flip the normal.

## Ray-Triangle Intersection (Moller-Trumbore)

The Moller-Trumbore algorithm is the standard ray-triangle intersection test in production ray tracers. It is fast, branch-light, and computes **barycentric coordinates** as a byproduct — essential for interpolating normals, UVs, and colors across the triangle.

### Setup

Given a triangle with vertices $V_0, V_1, V_2$, any point on the triangle can be written as:

$$\vec{P} = (1 - u - v)\,V_0 + u\,V_1 + v\,V_2$$

where $u \geq 0$, $v \geq 0$, and $u + v \leq 1$. These are the **barycentric coordinates**.

Setting this equal to the ray equation $\vec{O} + t\vec{D}$:

$$\vec{O} + t\vec{D} = (1 - u - v)\,V_0 + u\,V_1 + v\,V_2$$

Rearranging:

$$\vec{O} - V_0 = -t\vec{D} + u(V_1 - V_0) + v(V_2 - V_0)$$

### Edge Vectors and Cramer's Rule

Define the edge vectors:

$$\vec{e}_1 = V_1 - V_0, \quad \vec{e}_2 = V_2 - V_0$$

And the vector from $V_0$ to the ray origin:

$$\vec{T} = \vec{O} - V_0$$

The system becomes:

$$\begin{pmatrix} -\vec{D} & \vec{e}_1 & \vec{e}_2 \end{pmatrix} \begin{pmatrix} t \\ u \\ v \end{pmatrix} = \vec{T}$$

Using **Cramer's rule**, the solution involves determinants that reduce to cross products and dot products:

$$\vec{P} = \vec{D} \times \vec{e}_2, \quad \vec{Q} = \vec{T} \times \vec{e}_1$$

$$\text{det} = \vec{P} \cdot \vec{e}_1$$

$$t = \frac{\vec{Q} \cdot \vec{e}_2}{\text{det}}, \quad u = \frac{\vec{P} \cdot \vec{T}}{\text{det}}, \quad v = \frac{\vec{Q} \cdot \vec{D}}{\text{det}}$$

### The Algorithm

1. Compute $\vec{e}_1 = V_1 - V_0$ and $\vec{e}_2 = V_2 - V_0$
2. Compute $\vec{P} = \vec{D} \times \vec{e}_2$
3. Compute $\text{det} = \vec{P} \cdot \vec{e}_1$. If $|\text{det}| < \epsilon$, the ray is parallel to the triangle — no hit
4. Compute $\text{invDet} = 1 / \text{det}$
5. Compute $\vec{T} = \vec{O} - V_0$
6. Compute $u = (\vec{P} \cdot \vec{T}) \cdot \text{invDet}$. If $u < 0$ or $u > 1$, no hit
7. Compute $\vec{Q} = \vec{T} \times \vec{e}_1$
8. Compute $v = (\vec{Q} \cdot \vec{D}) \cdot \text{invDet}$. If $v < 0$ or $u + v > 1$, no hit
9. Compute $t = (\vec{Q} \cdot \vec{e}_2) \cdot \text{invDet}$. If $t < 0$, the triangle is behind the ray

The early rejection at each step is key to performance — most rays miss most triangles, so the algorithm exits early as soon as possible.

```cpp
bool mollerTrumbore(Vec3 O, Vec3 D, Vec3 V0, Vec3 V1, Vec3 V2,
                     float& t, float& u, float& v) {
    Vec3 e1 = V1 - V0;
    Vec3 e2 = V2 - V0;

    Vec3 P = cross(D, e2);
    float det = dot(e1, P);

    if (fabsf(det) < 1e-8f)
        return false;

    float invDet = 1.0f / det;

    Vec3 T = O - V0;
    u = dot(T, P) * invDet;
    if (u < 0.0f || u > 1.0f)
        return false;

    Vec3 Q = cross(T, e1);
    v = dot(D, Q) * invDet;
    if (v < 0.0f || u + v > 1.0f)
        return false;

    t = dot(e2, Q) * invDet;
    return t >= 0.0f;
}
```

```glsl
// GLSL Moller-Trumbore
bool rayTriangle(vec3 O, vec3 D, vec3 V0, vec3 V1, vec3 V2,
                  out float t, out vec2 bary) {
    vec3 e1 = V1 - V0;
    vec3 e2 = V2 - V0;
    vec3 P = cross(D, e2);
    float det = dot(e1, P);

    if (abs(det) < 1e-8) return false;

    float invDet = 1.0 / det;
    vec3 T = O - V0;

    bary.x = dot(T, P) * invDet;  // u
    if (bary.x < 0.0 || bary.x > 1.0) return false;

    vec3 Q = cross(T, e1);
    bary.y = dot(D, Q) * invDet;  // v
    if (bary.y < 0.0 || bary.x + bary.y > 1.0) return false;

    t = dot(e2, Q) * invDet;
    return t >= 0.0;
}
```

The barycentric coordinates $(u, v)$ are immediately useful: to interpolate a vertex attribute (normal, UV, color) across the triangle, compute $(1 - u - v) \cdot A_0 + u \cdot A_1 + v \cdot A_2$.

## Ray-AABB Intersection (Slab Method)

An **Axis-Aligned Bounding Box** (AABB) is defined by its minimum corner $\vec{B}_{min}$ and maximum corner $\vec{B}_{max}$. AABB intersection tests are the backbone of **Bounding Volume Hierarchies** (BVHs) — the acceleration structure that makes ray tracing practical. Without BVHs, you would test every ray against every triangle. With a BVH, you first test the ray against bounding boxes and only drill into subtrees where the ray actually hits.

### The Slab Method

An AABB is the intersection of three pairs of parallel planes (slabs), one pair per axis. For each axis, compute the $t$ values where the ray enters and exits that slab:

$$t_{x_{min}} = \frac{B_{min}.x - O_x}{D_x}, \quad t_{x_{max}} = \frac{B_{max}.x - O_x}{D_x}$$

If $D_x < 0$, swap $t_{x_{min}}$ and $t_{x_{max}}$ (the ray enters from the "max" side).

Repeat for Y and Z axes. The ray intersects the box if and only if all three slabs overlap:

$$t_{enter} = \max(t_{x_{min}}, t_{y_{min}}, t_{z_{min}})$$

$$t_{exit} = \min(t_{x_{max}}, t_{y_{max}}, t_{z_{max}})$$

**Hit condition:** $t_{enter} \leq t_{exit}$ and $t_{exit} \geq 0$

If $t_{enter} < 0$, the ray origin is inside the box (still a valid hit for traversal purposes).

### Handling Division by Zero

When $D_x = 0$ (ray parallel to the YZ slabs), IEEE floating point gives $\pm\infty$ for the division, which propagates correctly through the min/max operations. If $O_x$ is outside the slab range, one of the $t$ values is $+\infty$ and the other is $-\infty$, causing the overlap test to fail — exactly the right behavior.

```cpp
bool rayAABB(Vec3 O, Vec3 D, Vec3 bmin, Vec3 bmax, float& tNear, float& tFar) {
    Vec3 invD = { 1.0f / D.x, 1.0f / D.y, 1.0f / D.z };

    float t1 = (bmin.x - O.x) * invD.x;
    float t2 = (bmax.x - O.x) * invD.x;
    float t3 = (bmin.y - O.y) * invD.y;
    float t4 = (bmax.y - O.y) * invD.y;
    float t5 = (bmin.z - O.z) * invD.z;
    float t6 = (bmax.z - O.z) * invD.z;

    tNear = fmaxf(fmaxf(fminf(t1, t2), fminf(t3, t4)), fminf(t5, t6));
    tFar  = fminf(fminf(fmaxf(t1, t2), fmaxf(t3, t4)), fmaxf(t5, t6));

    return tFar >= tNear && tFar >= 0.0f;
}
```

Note the use of precomputed `invD` — in a BVH traversal, the ray direction is constant, so you compute the reciprocal once and reuse it for every AABB test.

### BVH Context

In a typical BVH traversal:

1. Test ray against root AABB
2. If hit, test against both child AABBs
3. Recurse into children that are hit, nearest first
4. At leaf nodes, test against the actual triangles (Moller-Trumbore)

This reduces the number of triangle intersection tests from $O(n)$ to $O(\log n)$ on average — the difference between a ray tracer that takes hours and one that runs in real time.

## Exercises

<details>
<summary>Exercise: Ray-Plane Intersection</summary>

<p>A ray has origin $\vec{O} = (0, 1, 0)$ and direction $\vec{D} = (0, -1, 0)$ (pointing straight down). A horizontal plane is defined by normal $\vec{N} = (0, 1, 0)$ and passes through the origin ($d = 0$). Find the intersection point.</p>

<p><strong>Solution:</strong></p>

<p>$t = \frac{d - \vec{N} \cdot \vec{O}}{\vec{N} \cdot \vec{D}} = \frac{0 - (0, 1, 0) \cdot (0, 1, 0)}{(0, 1, 0) \cdot (0, -1, 0)} = \frac{0 - 1}{-1} = 1$</p>

<p>Since $t = 1 \geq 0$, this is a valid hit. The intersection point is:</p>

<p>$\vec{P} = \vec{O} + t\vec{D} = (0, 1, 0) + 1 \cdot (0, -1, 0) = (0, 0, 0)$</p>

<p>The ray, pointing straight down from height 1, hits the ground plane at the origin. This is exactly the kind of test used for ground-plane mouse picking.</p>
</details>

<details>
<summary>Exercise: Does the Ray Hit the Sphere?</summary>

<p>A ray has origin $\vec{O} = (0, 0, -5)$ and direction $\vec{D} = (0, 0, 1)$. A sphere has center $\vec{C} = (0, 0, 0)$ and radius $r = 2$. Determine whether the ray hits the sphere, and if so, find the nearest intersection distance.</p>

<p><strong>Solution:</strong></p>

<p>$\vec{L} = \vec{O} - \vec{C} = (0, 0, -5)$</p>

<p>$a = \vec{D} \cdot \vec{D} = 1$</p>
<p>$b = 2(\vec{D} \cdot \vec{L}) = 2(0 \cdot 0 + 0 \cdot 0 + 1 \cdot (-5)) = -10$</p>
<p>$c = \vec{L} \cdot \vec{L} - r^2 = 25 - 4 = 21$</p>

<p>$\Delta = b^2 - 4ac = 100 - 84 = 16 > 0$</p>

<p>Two intersections exist. Solving:</p>

<p>$t = \frac{-(-10) \pm \sqrt{16}}{2 \cdot 1} = \frac{10 \pm 4}{2}$</p>

<p>$t_0 = \frac{10 - 4}{2} = 3, \quad t_1 = \frac{10 + 4}{2} = 7$</p>

<p>Both are positive. The nearest hit is at $t_0 = 3$, giving intersection point $(0, 0, -5) + 3(0, 0, 1) = (0, 0, -2)$. The ray exits the sphere at $(0, 0, 2)$. The surface normal at the entry point is $\frac{(0, 0, -2) - (0, 0, 0)}{2} = (0, 0, -1)$ — pointing back toward the ray origin, as expected.</p>
</details>

<details>
<summary>Exercise: Barycentric Coordinates from Moller-Trumbore</summary>

<p>A triangle has vertices $V_0 = (0, 0, 0)$, $V_1 = (4, 0, 0)$, $V_2 = (0, 4, 0)$. A ray has origin $\vec{O} = (1, 1, 5)$ and direction $\vec{D} = (0, 0, -1)$. Apply the Moller-Trumbore algorithm to find $t$, $u$, and $v$.</p>

<p><strong>Solution:</strong></p>

<p>$\vec{e}_1 = V_1 - V_0 = (4, 0, 0)$</p>
<p>$\vec{e}_2 = V_2 - V_0 = (0, 4, 0)$</p>

<p>$\vec{P} = \vec{D} \times \vec{e}_2 = (0, 0, -1) \times (0, 4, 0) = (4, 0, 0)$</p>

<p>$\text{det} = \vec{e}_1 \cdot \vec{P} = (4, 0, 0) \cdot (4, 0, 0) = 16$</p>

<p>$\text{invDet} = 1/16$</p>

<p>$\vec{T} = \vec{O} - V_0 = (1, 1, 5)$</p>

<p>$u = (\vec{P} \cdot \vec{T}) \cdot \text{invDet} = (4 \cdot 1 + 0 + 0) / 16 = 4/16 = 0.25$ — valid ($0 \leq u \leq 1$)</p>

<p>$\vec{Q} = \vec{T} \times \vec{e}_1 = (1, 1, 5) \times (4, 0, 0) = (0, 20, -4)$</p>

<p>$v = (\vec{D} \cdot \vec{Q}) \cdot \text{invDet} = ((0)(0) + (0)(20) + (-1)(-4)) / 16 = 4/16 = 0.25$ — valid ($v \geq 0$, $u + v = 0.5 \leq 1$)</p>

<p>$t = (\vec{e}_2 \cdot \vec{Q}) \cdot \text{invDet} = ((0)(0) + (4)(20) + (0)(-4)) / 16 = 80/16 = 5$ — valid ($t \geq 0$)</p>

<p>Hit at $t = 5$, point $(1, 1, 0)$, with barycentric coords $u = 0.25$, $v = 0.25$, $w = 1 - u - v = 0.5$. This means the point is closest to $V_0$ (weight 0.5), with equal influence from $V_1$ and $V_2$ (weight 0.25 each).</p>
</details>

## Key Takeaways

- A ray $\vec{R}(t) = \vec{O} + t\vec{D}$ parameterizes a half-line; intersection tests solve for $t \geq 0$
- Ray-plane intersection is a single dot product division — the simplest and fastest test
- Ray-sphere intersection reduces to a quadratic equation; the discriminant tells you 0, 1, or 2 hits
- The Moller-Trumbore algorithm finds ray-triangle intersections using Cramer's rule and produces barycentric coordinates as a byproduct, enabling attribute interpolation
- The slab method tests ray-AABB intersection by finding the overlap of three axis-aligned slab intervals
- AABB tests are the foundation of BVH traversal, which reduces intersection complexity from $O(n)$ to $O(\log n)$
- Early rejection at each step is critical for performance — most rays miss most geometry
