# Barycentric Coordinates

Barycentric coordinates are one of the most useful coordinate systems in computer graphics. Every time a GPU rasterizes a triangle, it computes barycentric coordinates to interpolate vertex attributes — colors, normals, texture coordinates — across the triangle's surface. They answer a fundamental question: "Given a point inside a triangle, how much influence does each vertex have?" This lesson covers the definition, properties, interpolation mechanics, the critical topic of perspective-correct interpolation, and generalizations to higher dimensions.

## Definition via Area Ratios

Given a triangle with vertices $V_0$, $V_1$, $V_2$ and a point $P$ inside (or on) the triangle, the **barycentric coordinates** $(\lambda_0, \lambda_1, \lambda_2)$ of $P$ are defined as the ratios of sub-triangle areas to the total triangle area.

The point $P$ divides the triangle into three smaller triangles:

- $T_0 = \triangle(P, V_1, V_2)$ — the sub-triangle **opposite** $V_0$
- $T_1 = \triangle(V_0, P, V_2)$ — the sub-triangle **opposite** $V_1$
- $T_2 = \triangle(V_0, V_1, P)$ — the sub-triangle **opposite** $V_2$

The barycentric coordinates are:

$$\lambda_0 = \frac{\text{Area}(T_0)}{\text{Area}(T)}, \quad \lambda_1 = \frac{\text{Area}(T_1)}{\text{Area}(T)}, \quad \lambda_2 = \frac{\text{Area}(T_2)}{\text{Area}(T)}$$

where $\text{Area}(T) = \text{Area}(\triangle(V_0, V_1, V_2))$ is the total triangle area.

### Computing Area with the Cross Product

For a triangle in 3D with vertices $A$, $B$, $C$, the area is:

$$\text{Area} = \frac{1}{2} \left| (\vec{B} - \vec{A}) \times (\vec{C} - \vec{A}) \right|$$

In 2D, we can use the **signed area** via the cross product's $z$-component:

$$\text{SignedArea}(A, B, C) = \frac{1}{2} \left[ (B_x - A_x)(C_y - A_y) - (C_x - A_x)(B_y - A_y) \right]$$

Using signed areas is critical — it lets us detect whether $P$ is inside or outside the triangle based on the signs of the individual coordinates.

### Numeric Example

Consider a triangle with $V_0 = (0, 0)$, $V_1 = (4, 0)$, $V_2 = (0, 3)$, and a point $P = (1, 1)$.

Total signed area of the triangle:

$$\text{Area}(T) = \frac{1}{2} |4 \cdot 3 - 0 \cdot 0| = 6$$

Sub-triangle areas:

$$\text{Area}(T_0) = \text{Area}(\triangle(P, V_1, V_2)) = \frac{1}{2} |(4-1)(3-1) - (0-1)(0-1)| = \frac{1}{2}|6 - 1| = 2.5$$

$$\text{Area}(T_1) = \text{Area}(\triangle(V_0, P, V_2)) = \frac{1}{2} |(1-0)(3-0) - (0-0)(1-0)| = 1.5$$

$$\text{Area}(T_2) = \text{Area}(\triangle(V_0, V_1, P)) = \frac{1}{2} |(4-0)(1-0) - (1-0)(0-0)| = 2.0$$

So $\lambda_0 = 2.5/6 \approx 0.417$, $\lambda_1 = 1.5/6 = 0.25$, $\lambda_2 = 2.0/6 \approx 0.333$.

Check: $0.417 + 0.25 + 0.333 = 1.0$ and $P = 0.417 \cdot (0,0) + 0.25 \cdot (4,0) + 0.333 \cdot (0,3) = (1.0, 1.0)$.

## Key Properties

### Partition of Unity

For any point in the plane of the triangle:

$$\lambda_0 + \lambda_1 + \lambda_2 = 1$$

This means barycentric coordinates are **not** independent — knowing any two determines the third. This is why you often see them written as $(u, v)$ with $w = 1 - u - v$.

### Convex Combination

A point $P$ can be reconstructed from its barycentric coordinates:

$$P = \lambda_0 V_0 + \lambda_1 V_1 + \lambda_2 V_2$$

When all three coordinates are non-negative ($\lambda_i \geq 0$), this is a **convex combination**, and $P$ lies inside the triangle or on its boundary.

### Inside/Outside Classification

| Condition | Location |
|---|---|
| All $\lambda_i > 0$ | Strictly inside the triangle |
| One $\lambda_i = 0$, others $> 0$ | On the edge opposite vertex $i$ |
| One $\lambda_i = 1$, others $= 0$ | At vertex $i$ |
| Any $\lambda_i < 0$ | Outside the triangle |

This classification is the foundation of the **point-in-triangle test**.

## Point-in-Triangle Test

The most efficient point-in-triangle test in rasterization uses the **edge function** method. For each edge of the triangle, evaluate a half-plane function at the candidate point. If the point is on the correct side of all three edges, it is inside.

The edge function for the edge from $V_a$ to $V_b$ evaluated at point $P$ is:

$$E(V_a, V_b, P) = (P_x - V_{a_x})(V_{b_y} - V_{a_y}) - (P_y - V_{a_y})(V_{b_x} - V_{a_x})$$

This is equivalent to the signed area of the triangle $(V_a, V_b, P)$ (times 2). A point is inside the triangle when all three edge functions have the same sign (positive for counter-clockwise winding).

```glsl
// Edge function: positive if P is to the left of edge A->B
float edgeFunction(vec2 A, vec2 B, vec2 P) {
    return (P.x - A.x) * (B.y - A.y) - (P.y - A.y) * (B.x - A.x);
}

bool pointInTriangle(vec2 P, vec2 V0, vec2 V1, vec2 V2) {
    float w0 = edgeFunction(V1, V2, P);  // opposite V0
    float w1 = edgeFunction(V2, V0, P);  // opposite V1
    float w2 = edgeFunction(V0, V1, P);  // opposite V2
    return w0 >= 0.0 && w1 >= 0.0 && w2 >= 0.0;
}
```

The barycentric coordinates are then:

$$\lambda_0 = \frac{w_0}{w_0 + w_1 + w_2}, \quad \lambda_1 = \frac{w_1}{w_0 + w_1 + w_2}, \quad \lambda_2 = \frac{w_2}{w_0 + w_1 + w_2}$$

This approach is extremely GPU-friendly because the edge functions are linear — they can be evaluated incrementally across a scanline by adding a constant per pixel step.

## Interpolation of Vertex Attributes

The primary purpose of barycentric coordinates in graphics is **attribute interpolation**. Given per-vertex values $A_0$, $A_1$, $A_2$ (which could be colors, normals, texture coordinates, or any other quantity), the interpolated value at point $P$ is:

$$A(P) = \lambda_0 A_0 + \lambda_1 A_1 + \lambda_2 A_2$$

### UV Coordinates

For texture mapping, each vertex has a 2D texture coordinate $(u_i, v_i)$. The interpolated UV at the fragment is:

$$\vec{uv}(P) = \lambda_0 \vec{uv}_0 + \lambda_1 \vec{uv}_1 + \lambda_2 \vec{uv}_2$$

### Normals

Smooth shading (Phong interpolation) computes per-fragment normals by interpolating vertex normals:

$$\vec{N}(P) = \text{normalize}(\lambda_0 \vec{N}_0 + \lambda_1 \vec{N}_1 + \lambda_2 \vec{N}_2)$$

Note: the interpolated normal must be re-normalized because the linear combination of unit vectors is not generally a unit vector.

### Colors

Vertex colors are interpolated the same way. This is what produces the classic RGB triangle demo:

```glsl
// Fragment shader receiving interpolated barycentrics
// (typically done automatically by the rasterizer)
vec3 color = lambda0 * vertexColor0 + lambda1 * vertexColor1 + lambda2 * vertexColor2;
```

## Perspective-Correct Interpolation

### The Problem: Why Linear Interpolation Fails

When a triangle is projected from 3D to screen space, straight lines remain straight, but **distances are distorted** by perspective. If you interpolate vertex attributes linearly in screen space using screen-space barycentric coordinates, the result is incorrect — textures swim, normals warp, and the illusion of depth breaks.

The root cause: perspective projection is a **projective** (not affine) transformation. It maps parallel lines in 3D to converging lines in 2D, which means equal steps in screen space do not correspond to equal steps in world space.

### The Solution: Hyperbolic Interpolation

The key insight, described by Heckbert and Moreton (1991), is that while attributes are not linear in screen space, the **reciprocal of the $w$ component** (the homogeneous clip coordinate) is linear in screen space.

Given clip-space coordinates where each vertex has a $w_i$ value (the depth component after the projection matrix), the perspective-correct interpolated attribute is:

$$A_{correct} = \frac{\lambda_0 \frac{A_0}{w_0} + \lambda_1 \frac{A_1}{w_1} + \lambda_2 \frac{A_2}{w_2}}{\lambda_0 \frac{1}{w_0} + \lambda_1 \frac{1}{w_1} + \lambda_2 \frac{1}{w_2}}$$

where $\lambda_0, \lambda_1, \lambda_2$ are the screen-space barycentric coordinates.

### Step by Step

1. **Before rasterization:** For each vertex, compute $\frac{1}{w_i}$ and $\frac{A_i}{w_i}$ for each attribute $A$.
2. **During rasterization:** Interpolate both $\frac{1}{w}$ and $\frac{A}{w}$ linearly across the triangle in screen space using the screen-space barycentrics.
3. **At each fragment:** Recover the correct attribute by dividing: $A = \frac{A/w}{1/w}$.

```glsl
// Perspective-correct interpolation (conceptual, done by GPU hardware)
float oneOverW = lambda0 / w0 + lambda1 / w1 + lambda2 / w2;

vec2 uvOverW = lambda0 * (uv0 / w0) + lambda1 * (uv1 / w1) + lambda2 * (uv2 / w2);

vec2 uvCorrect = uvOverW / oneOverW;
```

### Why Modern GPUs Handle This Automatically

Modern GPU rasterizers perform perspective-correct interpolation by default for all `in`/`varying` variables in fragment shaders. The hardware divides each attribute by $w$ before interpolation and multiplies back after. This is why you rarely need to think about it — unless you explicitly request `noperspective` interpolation in GLSL:

```glsl
// Default: perspective-correct interpolation
in vec2 vTexCoord;

// Opt-out: linear (affine) interpolation in screen space
noperspective in vec2 vScreenUV;
```

The `noperspective` qualifier is useful for screen-space effects (post-processing UVs, screen-space decals) where you actually want affine interpolation.

### Explicit Barycentric Access on Modern GPUs

Modern graphics APIs now expose raw barycentric coordinates directly to shaders. In Vulkan, the `VK_KHR_fragment_shader_barycentric` extension (promoted to Vulkan 1.4) provides `gl_BaryCoordEXT` (perspective-correct) and `gl_BaryCoordNoPerspEXT` (linear). In DirectX 12 HLSL, `SV_Barycentrics` serves the same role. This gives shader authors full control over custom interpolation schemes.

```glsl
// Vulkan with VK_KHR_fragment_shader_barycentric
#extension GL_EXT_fragment_shader_barycentric : require

// Perspective-correct barycentrics
vec3 bary = gl_BaryCoordEXT;

// Access per-vertex data via pervertexEXT
pervertexEXT in vec3 vertexNormal[];
vec3 interpNormal = bary.x * vertexNormal[0]
                  + bary.y * vertexNormal[1]
                  + bary.z * vertexNormal[2];
```

## Use in Rasterization

### The Rasterization Pipeline

In the standard rasterization pipeline, after the vertex shader transforms vertices to clip space and the perspective divide maps them to normalized device coordinates (NDC), the rasterizer must determine which pixels (fragments) each triangle covers and compute per-fragment attribute values. Barycentric coordinates are the mechanism for both tasks:

1. **Coverage test:** For each pixel center, evaluate the three edge functions. If all are non-negative (for CCW winding), the pixel is covered.
2. **Attribute interpolation:** Use the barycentric coordinates (from the edge functions) to interpolate all vertex outputs: position, normal, UV, color, etc.
3. **Depth interpolation:** The fragment depth is interpolated for the depth buffer test.

### Incremental Evaluation

The edge function $E(V_a, V_b, P) = A \cdot P_x + B \cdot P_y + C$ is linear, so stepping one pixel to the right adds $A$ to the result, and stepping one pixel down adds $B$. This means the GPU evaluates the edge functions with **two additions per pixel per edge** — no multiplications needed after the initial setup. Modern GPUs evaluate blocks of $2 \times 2$ or $8 \times 8$ pixels in parallel using SIMD.

## Generalization to Tetrahedra

Barycentric coordinates generalize naturally from 2D triangles to 3D tetrahedra. Given a tetrahedron with vertices $V_0, V_1, V_2, V_3$ and a point $P$ inside it, the four barycentric coordinates are **volume ratios**:

$$\lambda_i = \frac{\text{Vol}(\text{sub-tetrahedron opposite } V_i)}{\text{Vol}(\text{full tetrahedron})}$$

The volume of a tetrahedron with vertices $A, B, C, D$ is:

$$\text{Vol} = \frac{1}{6} \left| (\vec{B} - \vec{A}) \cdot \left[ (\vec{C} - \vec{A}) \times (\vec{D} - \vec{A}) \right] \right|$$

The four coordinates still sum to one ($\lambda_0 + \lambda_1 + \lambda_2 + \lambda_3 = 1$), and the point is inside the tetrahedron when all are non-negative.

### Applications

- **Finite Element Methods (FEM):** Tetrahedral meshes are standard in physics simulation. Barycentric interpolation within tetrahedra maps deformation fields, temperature distributions, and stress tensors across the volume.
- **Volume rendering:** Interpolating scalar fields within tetrahedral cells for medical imaging and scientific visualization.
- **Physics engines:** Point-in-tetrahedron tests for collision detection in soft-body simulation.

```python
import numpy as np

def barycentric_tetrahedron(P, V0, V1, V2, V3):
    """Compute barycentric coordinates of P in tetrahedron (V0,V1,V2,V3)."""
    T = np.column_stack([V1 - V0, V2 - V0, V3 - V0])
    coords = np.linalg.solve(T, P - V0)
    lam1, lam2, lam3 = coords
    lam0 = 1.0 - lam1 - lam2 - lam3
    return np.array([lam0, lam1, lam2, lam3])
```

## Exercises

<details>
<summary>Exercise: Compute Barycentric Coordinates</summary>

<p>A triangle has vertices $V_0 = (0, 0)$, $V_1 = (6, 0)$, $V_2 = (0, 4)$. Compute the barycentric coordinates of $P = (2, 1)$.</p>

<p><strong>Solution:</strong></p>

<p>Total area: $\text{Area}(T) = \frac{1}{2} |6 \cdot 4| = 12$.</p>

<p>$w_0 = E(V_1, V_2, P) = (P_x - 6)(4 - 0) - (P_y - 0)(0 - 6) = (2-6)(4) - (1)(-6) = -16 + 6 = -10$. So signed area of $T_0 = -10/2$, but with consistent winding: $\lambda_0 = \frac{|\text{Area}(T_0)|}{\text{Area}(T)}$. Using the edge function approach with CCW winding:</p>

<p>$E_0 = (V_{1x} - V_{2x})(P_y - V_{2y}) - (V_{1y} - V_{2y})(P_x - V_{2x}) = (6)(1 - 4) - (-4)(2 - 0) = -18 + 8 = -10$. Hmm, let's use the direct formula instead.</p>

<p>Using $P = \lambda_0 V_0 + \lambda_1 V_1 + \lambda_2 V_2$ and $\lambda_0 + \lambda_1 + \lambda_2 = 1$:</p>

<p>$2 = 0 \cdot \lambda_0 + 6\lambda_1 + 0 \cdot \lambda_2 \Rightarrow \lambda_1 = 1/3$</p>

<p>$1 = 0 \cdot \lambda_0 + 0 \cdot \lambda_1 + 4\lambda_2 \Rightarrow \lambda_2 = 1/4$</p>

<p>$\lambda_0 = 1 - 1/3 - 1/4 = 12/12 - 4/12 - 3/12 = 5/12$</p>

<p>Verify: $(5/12)(0,0) + (1/3)(6,0) + (1/4)(0,4) = (0,0) + (2,0) + (0,1) = (2,1)$.</p>
</details>

<details>
<summary>Exercise: Perspective-Correct vs. Linear Interpolation</summary>

<p>A triangle has three vertices after projection. Their screen-space barycentric coordinates at a particular fragment are $\lambda_0 = 0.5$, $\lambda_1 = 0.3$, $\lambda_2 = 0.2$. The clip-space $w$ values are $w_0 = 2$, $w_1 = 4$, $w_2 = 8$. A texture coordinate $u$ has per-vertex values $u_0 = 0$, $u_1 = 1$, $u_2 = 1$. Compute (a) the naively interpolated $u$ (linear in screen space) and (b) the perspective-correct $u$.</p>

<p><strong>Solution:</strong></p>

<p>(a) Naive linear: $u_{linear} = 0.5 \cdot 0 + 0.3 \cdot 1 + 0.2 \cdot 1 = 0.5$</p>

<p>(b) Perspective-correct:</p>

<p>$\frac{1}{w}$ interpolated: $0.5 \cdot \frac{1}{2} + 0.3 \cdot \frac{1}{4} + 0.2 \cdot \frac{1}{8} = 0.25 + 0.075 + 0.025 = 0.35$</p>

<p>$\frac{u}{w}$ interpolated: $0.5 \cdot \frac{0}{2} + 0.3 \cdot \frac{1}{4} + 0.2 \cdot \frac{1}{8} = 0 + 0.075 + 0.025 = 0.1$</p>

<p>$u_{correct} = \frac{0.1}{0.35} \approx 0.286$</p>

<p>The difference is significant: $0.5$ vs. $0.286$. The perspective-correct value accounts for the fact that $V_0$ (with the smallest $w$, i.e., closest to the camera) occupies more screen area, so its attribute value ($u_0 = 0$) should have greater influence.</p>
</details>

<details>
<summary>Exercise: Point-in-Triangle via Edge Functions</summary>

<p>Triangle vertices: $V_0 = (1, 1)$, $V_1 = (5, 1)$, $V_2 = (3, 4)$ (counter-clockwise). Is the point $P = (3, 2)$ inside the triangle?</p>

<p><strong>Solution:</strong></p>

<p>$E_0 = E(V_1, V_2, P) = (P_x - V_{1x})(V_{2y} - V_{1y}) - (P_y - V_{1y})(V_{2x} - V_{1x}) = (3-5)(4-1) - (2-1)(3-5) = (-2)(3) - (1)(-2) = -6 + 2 = -4$</p>

<p>$E_1 = E(V_2, V_0, P) = (3-3)(1-4) - (2-4)(1-3) = 0 - (-2)(-2) = 0 - 4 = -4$</p>

<p>$E_2 = E(V_0, V_1, P) = (3-1)(1-1) - (2-1)(5-1) = 0 - 4 = -4$</p>

<p>All three have the same sign (negative), so $P$ is inside the triangle. (The negative sign means the winding from our edge function convention is CW; the important thing is consistency.) The barycentric coordinates are proportional to $|E_0| : |E_1| : |E_2| = 4 : 4 : 4$, so $\lambda_0 = \lambda_1 = \lambda_2 = 1/3$. Indeed, $(1/3)(1,1) + (1/3)(5,1) + (1/3)(3,4) = (3, 2)$, confirming $P$ is the centroid.</p>
</details>

## Key Takeaways

- Barycentric coordinates $(\lambda_0, \lambda_1, \lambda_2)$ express a point as a weighted combination of triangle vertices, with weights equal to sub-triangle area ratios
- The partition of unity property ($\sum \lambda_i = 1$) means only two coordinates are independent
- A point is inside the triangle if and only if all three barycentric coordinates are non-negative
- The edge function method provides an efficient, incrementally evaluable point-in-triangle test ideal for GPU rasterization
- Vertex attributes (UVs, normals, colors) are interpolated as $A(P) = \lambda_0 A_0 + \lambda_1 A_1 + \lambda_2 A_2$
- Perspective-correct interpolation requires dividing attributes by clip-space $w$ before interpolation and dividing back after — modern GPUs do this automatically for all `in` variables
- Use the `noperspective` qualifier in GLSL/HLSL only when you specifically want screen-space linear interpolation
- Barycentric coordinates generalize to tetrahedra in 3D via volume ratios, enabling interpolation within volumetric meshes
- Modern APIs (Vulkan 1.4, DX12) expose raw barycentrics to fragment shaders via `gl_BaryCoordEXT` / `SV_Barycentrics`
