# Curves & Surfaces

Every smooth shape you see in computer graphics — the arc of a character's motion path, the contours of a font glyph, the body panels of a car, the rolling terrain of a game world — is defined by parametric curves and surfaces. Rather than storing millions of points, we store a handful of **control points** and let a mathematical function generate the smooth shape on demand. This lesson covers the key curve and surface representations used in CG, from simple linear interpolation to Bezier curves, B-splines, and tensor product surfaces.

## Parametric Curves

A parametric curve maps a single parameter $t$ to a point in space:

$$\vec{P}(t) = \big(x(t),\; y(t),\; z(t)\big), \quad t \in [0, 1]$$

As $t$ sweeps from 0 to 1, the point $\vec{P}(t)$ traces out the curve. The parameter $t$ can be thought of as "time" — at $t = 0$ you are at the start of the curve, and at $t = 1$ you are at the end.

The **tangent vector** at any point is the derivative:

$$\vec{P}'(t) = \left(\frac{dx}{dt},\; \frac{dy}{dt},\; \frac{dz}{dt}\right)$$

This gives the direction and speed of travel along the curve at parameter value $t$.

## Linear Interpolation (Lerp)

The simplest parametric curve is a straight line between two points:

$$\vec{P}(t) = (1 - t)\,\vec{P}_0 + t\,\vec{P}_1$$

At $t = 0$, we get $\vec{P}_0$. At $t = 1$, we get $\vec{P}_1$. At $t = 0.5$, we get the midpoint. This is **lerp** — the building block of nearly all higher-order curves.

```glsl
vec3 lerp(vec3 a, vec3 b, float t) {
    return a + t * (b - a);  // equivalent: (1.0 - t) * a + t * b
}
```

GLSL provides this as `mix(a, b, t)`.

## Bezier Curves

Bezier curves extend lerp to produce smooth, controllable paths. They are defined by a set of **control points** and built from repeated linear interpolation.

### Quadratic Bezier (3 Control Points)

A quadratic Bezier curve uses three control points $P_0, P_1, P_2$:

$$\vec{P}(t) = (1-t)^2 P_0 + 2(1-t)t\, P_1 + t^2 P_2$$

The curve starts at $P_0$, ends at $P_2$, and is "pulled toward" $P_1$ without (generally) passing through it.

### Cubic Bezier (4 Control Points)

The cubic Bezier is the workhorse of CG — used in fonts (TrueType/OpenType), SVG paths, Adobe Illustrator, animation curves, and CSS transitions. It uses four control points:

$$\vec{P}(t) = (1-t)^3 P_0 + 3(1-t)^2 t\, P_1 + 3(1-t)t^2 P_2 + t^3 P_3$$

The curve passes through $P_0$ and $P_3$ (the endpoints) and is shaped by $P_1$ and $P_2$ (the control handles).

### Bernstein Basis Polynomials

The coefficients in the Bezier formula are the **Bernstein basis polynomials** of degree $n$:

$$B_{i}^{n}(t) = \binom{n}{i} t^i (1-t)^{n-i}$$

For a cubic Bezier ($n = 3$):

$$B_0^3(t) = (1-t)^3, \quad B_1^3(t) = 3(1-t)^2 t, \quad B_2^3(t) = 3(1-t) t^2, \quad B_3^3(t) = t^3$$

The Bezier curve is then simply:

$$\vec{P}(t) = \sum_{i=0}^{n} B_i^n(t)\, P_i$$

The Bernstein basis has a beautiful property: $\sum_{i=0}^{n} B_i^n(t) = 1$ for all $t$. This means the curve is always an **affine combination** of the control points, guaranteeing it lies within their convex hull.

### The de Casteljau Algorithm

Rather than evaluating the polynomial directly, the **de Casteljau algorithm** builds the curve point through repeated lerps:

1. Given control points $P_0, P_1, P_2, P_3$ and a parameter $t$
2. **Level 1:** Lerp adjacent pairs:
   - $Q_0 = \text{lerp}(P_0, P_1, t)$
   - $Q_1 = \text{lerp}(P_1, P_2, t)$
   - $Q_2 = \text{lerp}(P_2, P_3, t)$
3. **Level 2:** Lerp the results:
   - $R_0 = \text{lerp}(Q_0, Q_1, t)$
   - $R_1 = \text{lerp}(Q_1, Q_2, t)$
4. **Level 3:** Final lerp:
   - $\vec{P}(t) = \text{lerp}(R_0, R_1, t)$

This algorithm is numerically stable, easy to implement, and naturally supports **curve subdivision** — the intermediate points at each level define two smaller Bezier curves that together form the original.

```cpp
Vec3 deCasteljau(Vec3 P[4], float t) {
    Vec3 Q[3], R[2];

    for (int i = 0; i < 3; i++)
        Q[i] = lerp(P[i], P[i + 1], t);

    for (int i = 0; i < 2; i++)
        R[i] = lerp(Q[i], Q[i + 1], t);

    return lerp(R[0], R[1], t);
}
```

### Key Properties of Bezier Curves

- **Endpoint interpolation:** The curve passes through $P_0$ and $P_n$
- **Tangent at endpoints:** $\vec{P}'(0) = n(P_1 - P_0)$ and $\vec{P}'(1) = n(P_n - P_{n-1})$ — the tangent at each end points toward the adjacent control point
- **Convex hull:** The curve lies entirely within the convex hull of its control points
- **Affine invariance:** Transforming the control points transforms the curve identically
- **No local control:** Moving any single control point affects the **entire** curve — this is a significant limitation for complex shapes

## B-Splines: Local Control

B-splines (Basis splines) solve the local control problem. A B-spline is a piecewise polynomial curve where moving one control point only affects a **local segment** of the curve, not the whole thing.

A B-spline of degree $p$ with control points $P_0, \ldots, P_n$ and a knot vector $\{t_0, t_1, \ldots, t_{n+p+1}\}$ is defined as:

$$\vec{C}(t) = \sum_{i=0}^{n} N_{i,p}(t)\, P_i$$

where $N_{i,p}(t)$ are the B-spline basis functions defined recursively by the Cox-de Boor formula. The critical insight is that each basis function $N_{i,p}(t)$ is nonzero only over a local range of $t$ values, so each control point influences only a few curve segments.

**Key differences from Bezier:**
- Changing one control point only moves nearby curve segments
- The curve does not generally pass through any control points (except with special knot configurations)
- A **uniform** B-spline has evenly spaced knots; a **non-uniform** B-spline (NURBS) allows variable spacing and rational weights, enabling exact representation of circles and conics

In practice, artists work with B-splines in tools like Maya, Blender, and CAD software, while the GPU receives tessellated triangle meshes.

## Bezier Surfaces

A Bezier surface extends curves to two dimensions using a **tensor product**. A bicubic Bezier surface patch uses a $4 \times 4$ grid of control points $P_{ij}$ and two parameters $u, v \in [0, 1]$:

$$\vec{S}(u, v) = \sum_{i=0}^{3} \sum_{j=0}^{3} B_i^3(u)\, B_j^3(v)\, P_{ij}$$

You can think of this as: first evaluate four Bezier curves in the $u$ direction (one for each row of control points), getting four intermediate points. Then evaluate a single Bezier curve in the $v$ direction through those four points. The result is a smooth surface patch.

The same idea works for B-spline surfaces — each control point influences a local patch of the surface, making them practical for modeling complex shapes like car bodies, aircraft fuselages, and character faces.

## Tessellation

GPUs render triangles, not curves. **Tessellation** is the process of subdividing curves and surfaces into triangles for rendering.

### Uniform Tessellation

The simplest approach: sample the curve or surface at evenly spaced parameter values. For a curve, evaluate at $t = 0, \frac{1}{N}, \frac{2}{N}, \ldots, 1$ and connect with line segments. For a surface, create a regular grid of $(u, v)$ samples and connect into triangles.

This is easy but wasteful — flat regions get as many triangles as highly curved regions.

### Adaptive Tessellation

Adaptive tessellation allocates more triangles where the surface curvature is high and fewer where it is flat. The basic idea:

1. Evaluate the surface at coarse intervals
2. For each patch, estimate curvature (e.g., compare the midpoint of an edge to the actual surface point)
3. If the error exceeds a threshold, subdivide further
4. Repeat recursively until the error is within tolerance

Modern GPUs support **hardware tessellation** through tessellation shaders (hull/domain shaders in DirectX, tessellation control/evaluation shaders in OpenGL). The tessellation control shader sets the subdivision level per-edge, and the tessellation evaluation shader computes the actual surface position for each generated vertex.

```glsl
// Tessellation evaluation shader: bicubic Bezier patch
layout(quads, equal_spacing, ccw) in;

void main() {
    float u = gl_TessCoord.x;
    float v = gl_TessCoord.y;

    // Bernstein basis for cubic
    float Bu[4] = float[](
        (1.0-u)*(1.0-u)*(1.0-u),
        3.0*(1.0-u)*(1.0-u)*u,
        3.0*(1.0-u)*u*u,
        u*u*u
    );
    float Bv[4] = float[](
        (1.0-v)*(1.0-v)*(1.0-v),
        3.0*(1.0-v)*(1.0-v)*v,
        3.0*(1.0-v)*v*v,
        v*v*v
    );

    vec3 pos = vec3(0.0);
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 4; j++)
            pos += Bu[i] * Bv[j] * gl_in[i * 4 + j].gl_Position.xyz;

    gl_Position = projection * view * vec4(pos, 1.0);
}
```

## CG Applications

- **Fonts:** TrueType uses quadratic Beziers; OpenType CFF uses cubic Beziers. Every letter you read on screen is built from Bezier curves.
- **Animation paths:** Character motion, camera flythrough, and easing curves are typically cubic Beziers with artist-placed control handles.
- **3D modeling:** Car bodies, aircraft, and organic shapes are modeled as NURBS or subdivision surfaces, which are closely related to B-splines.
- **Terrain:** Some engines represent terrain as Bezier surface patches, tessellated adaptively based on camera distance.
- **Vector graphics:** SVG, PostScript, and PDF all use cubic Bezier paths as their primary drawing primitive.

## Exercises

<details>
<summary>Exercise: Evaluate a Cubic Bezier at t = 0.5</summary>

<p>Given control points $P_0 = (0, 0)$, $P_1 = (1, 2)$, $P_2 = (3, 2)$, $P_3 = (4, 0)$, compute $\vec{P}(0.5)$.</p>

<p><strong>Solution:</strong></p>

<p>Using the cubic Bezier formula with $t = 0.5$:</p>

<p>$(1-t)^3 = 0.125$, $3(1-t)^2 t = 0.375$, $3(1-t)t^2 = 0.375$, $t^3 = 0.125$</p>

<p>$\vec{P}(0.5) = 0.125(0,0) + 0.375(1,2) + 0.375(3,2) + 0.125(4,0)$</p>

<p>$= (0, 0) + (0.375, 0.75) + (1.125, 0.75) + (0.5, 0)$</p>

<p>$= (2.0, 1.5)$</p>

<p>Notice this is the midpoint of the curve horizontally, but vertically it reaches $1.5$ — not $2.0$ — because the curve is pulled toward but does not pass through the control handles.</p>
</details>

<details>
<summary>Exercise: de Casteljau by Hand</summary>

<p>Using the same control points $P_0 = (0, 0)$, $P_1 = (1, 2)$, $P_2 = (3, 2)$, $P_3 = (4, 0)$, apply the de Casteljau algorithm at $t = 0.5$ and verify you get the same answer.</p>

<p><strong>Solution:</strong></p>

<p><strong>Level 1</strong> (lerp adjacent pairs at $t = 0.5$):</p>
<p>$Q_0 = 0.5 \cdot (0,0) + 0.5 \cdot (1,2) = (0.5, 1.0)$</p>
<p>$Q_1 = 0.5 \cdot (1,2) + 0.5 \cdot (3,2) = (2.0, 2.0)$</p>
<p>$Q_2 = 0.5 \cdot (3,2) + 0.5 \cdot (4,0) = (3.5, 1.0)$</p>

<p><strong>Level 2:</strong></p>
<p>$R_0 = 0.5 \cdot (0.5, 1.0) + 0.5 \cdot (2.0, 2.0) = (1.25, 1.5)$</p>
<p>$R_1 = 0.5 \cdot (2.0, 2.0) + 0.5 \cdot (3.5, 1.0) = (2.75, 1.5)$</p>

<p><strong>Level 3:</strong></p>
<p>$\vec{P}(0.5) = 0.5 \cdot (1.25, 1.5) + 0.5 \cdot (2.75, 1.5) = (2.0, 1.5)$</p>

<p>This matches the direct evaluation. The de Casteljau algorithm is nothing more than nested lerps — simple, stable, and elegant.</p>
</details>

<details>
<summary>Exercise: Bezier Tangent at an Endpoint</summary>

<p>For a cubic Bezier with $P_0 = (0, 0, 0)$, $P_1 = (1, 0, 1)$, $P_2 = (2, 0, 1)$, $P_3 = (3, 0, 0)$, compute the tangent vector at $t = 0$ and $t = 1$.</p>

<p><strong>Solution:</strong></p>

<p>For a cubic Bezier, the tangent at the endpoints is:</p>

<p>$\vec{P}'(0) = 3(P_1 - P_0) = 3\big((1,0,1) - (0,0,0)\big) = (3, 0, 3)$</p>

<p>$\vec{P}'(1) = 3(P_3 - P_2) = 3\big((3,0,0) - (2,0,1)\big) = (3, 0, -3)$</p>

<p>The curve leaves $P_0$ heading in the direction of $P_1$ and arrives at $P_3$ coming from the direction of $P_2$. This property is what makes Bezier control handles intuitive for artists: dragging a handle directly controls the tangent.</p>
</details>

## Key Takeaways

- Parametric curves $\vec{P}(t)$ map a single parameter to a point in space, tracing a path as $t$ goes from 0 to 1
- Bezier curves are built from repeated lerps (de Casteljau) or equivalently from Bernstein basis polynomials
- Cubic Beziers (4 control points) are the standard in fonts, SVG, animation, and CSS
- Bezier curves lack local control — moving one point affects the entire curve; B-splines solve this by using localized basis functions
- Bezier surfaces use tensor products: a $4 \times 4$ grid of control points defines a smooth patch
- Tessellation converts mathematical curves/surfaces into triangles the GPU can render, with adaptive methods placing more detail where curvature is highest
