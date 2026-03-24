# Cross Product

If the dot product tells you how much two vectors agree, the cross product tells you how much they disagree — and it gives you a brand new direction as the answer. In computer graphics, the cross product is how we compute surface normals, determine triangle winding order, and build local coordinate frames. Without it, we couldn't tell "inside" from "outside."

## Algebraic Definition

The cross product of two 3D vectors $\vec{a}$ and $\vec{b}$ produces a new **vector**:

$$\vec{a} \times \vec{b} = \begin{pmatrix} a_y b_z - a_z b_y \\ a_z b_x - a_x b_z \\ a_x b_y - a_y b_x \end{pmatrix}$$

Written component-by-component:

$$(\vec{a} \times \vec{b})_x = a_y b_z - a_z b_y$$

$$(\vec{a} \times \vec{b})_y = a_z b_x - a_x b_z$$

$$(\vec{a} \times \vec{b})_z = a_x b_y - a_y b_x$$

A helpful mnemonic: each component is the determinant of the 2x2 matrix formed by the other two components. The pattern cycles through $x \to y \to z \to x$ with alternating signs.

For example, given $\vec{a} = (2, 3, 4)$ and $\vec{b} = (5, 6, 7)$:

$$\vec{a} \times \vec{b} = \begin{pmatrix} (3)(7) - (4)(6) \\ (4)(5) - (2)(7) \\ (2)(6) - (3)(5) \end{pmatrix} = \begin{pmatrix} 21 - 24 \\ 20 - 14 \\ 12 - 15 \end{pmatrix} = \begin{pmatrix} -3 \\ 6 \\ -3 \end{pmatrix}$$

## Geometric Interpretation

The cross product result has two key geometric properties:

### Direction: Perpendicular to Both Inputs

The resulting vector $\vec{a} \times \vec{b}$ is **perpendicular** (orthogonal) to both $\vec{a}$ and $\vec{b}$. You can verify this with dot products:

$$(\vec{a} \times \vec{b}) \cdot \vec{a} = 0$$

$$(\vec{a} \times \vec{b}) \cdot \vec{b} = 0$$

This is what makes the cross product indispensable for computing surface normals: given two edges of a triangle, the cross product gives you the direction perpendicular to the surface.

### Magnitude: Area of the Parallelogram

The magnitude of the cross product equals the area of the parallelogram formed by the two vectors:

$$|\vec{a} \times \vec{b}| = |\vec{a}||\vec{b}|\sin\theta$$

where $\theta$ is the angle between the vectors. Since a triangle is half a parallelogram, the area of a triangle with edges $\vec{a}$ and $\vec{b}$ is:

$$A_{\text{triangle}} = \frac{1}{2}|\vec{a} \times \vec{b}|$$

When $\vec{a}$ and $\vec{b}$ are parallel ($\theta = 0°$ or $180°$), $\sin\theta = 0$ and the cross product is the zero vector — there's no unique perpendicular direction when both vectors lie along the same line.

## The Right-Hand Rule

There are always two directions perpendicular to a plane — "up" and "down." The **right-hand rule** determines which one the cross product chooses.

Point the fingers of your right hand along $\vec{a}$, then curl them toward $\vec{b}$. Your **thumb** points in the direction of $\vec{a} \times \vec{b}$.

This means:

- $\hat{x} \times \hat{y} = \hat{z}$
- $\hat{y} \times \hat{z} = \hat{x}$
- $\hat{z} \times \hat{x} = \hat{y}$

The right-hand rule is the reason the cross product is **anti-commutative** — swapping the operands reverses the direction.

## Properties

- **Anti-commutative:** $\vec{a} \times \vec{b} = -(\vec{b} \times \vec{a})$ — swapping the order negates the result. This is critical for winding order.
- **NOT associative:** $\vec{a} \times (\vec{b} \times \vec{c}) \neq (\vec{a} \times \vec{b}) \times \vec{c}$ — parentheses matter.
- **Distributive:** $\vec{a} \times (\vec{b} + \vec{c}) = \vec{a} \times \vec{b} + \vec{a} \times \vec{c}$
- **Scalar multiplication:** $(k\vec{a}) \times \vec{b} = k(\vec{a} \times \vec{b})$
- **Self-cross:** $\vec{a} \times \vec{a} = \vec{0}$ — a vector crossed with itself is the zero vector (they're parallel, so $\sin 0° = 0$).
- **Parallel test:** If $\vec{a} \times \vec{b} = \vec{0}$ and neither vector is zero, then $\vec{a}$ and $\vec{b}$ are parallel (or anti-parallel).

## CG Applications

### Computing Surface Normals

The most fundamental use: given a triangle with vertices $P_0$, $P_1$, $P_2$, the surface normal is:

$$\vec{N} = \text{normalize}((P_1 - P_0) \times (P_2 - P_0))$$

The two edge vectors define the plane of the triangle, and their cross product gives the perpendicular direction. Normalizing ensures a unit-length normal suitable for lighting.

```glsl
vec3 edge1 = P1 - P0;
vec3 edge2 = P2 - P0;
vec3 normal = normalize(cross(edge1, edge2));
```

This is how mesh normals are computed when they aren't provided by the modeling software. For smooth shading, vertex normals are typically the normalized average of the face normals of all adjacent triangles.

### Triangle Winding Order

The order in which you specify triangle vertices determines which way the normal points, which in turn determines which side is the "front face."

- **Counter-clockwise (CCW):** The standard in OpenGL. When vertices appear in CCW order as viewed from the front, the normal points toward the viewer.
- **Clockwise (CW):** The standard in DirectX.

Because the cross product is anti-commutative, reversing the winding order flips the normal:

$$(P_1 - P_0) \times (P_2 - P_0) = -((P_2 - P_0) \times (P_1 - P_0))$$

This is why accidentally reversing vertex order causes triangles to become invisible — the normal points inward, the GPU back-face culls them, and you see nothing.

### Computing Tangent and Bitangent Vectors

Normal mapping requires a **tangent space** coordinate frame at each vertex, consisting of the normal $\vec{N}$, tangent $\vec{T}$, and bitangent $\vec{B}$. The bitangent is computed from the other two:

$$\vec{B} = \vec{N} \times \vec{T}$$

This guarantees the three vectors form an orthogonal basis. The resulting TBN matrix transforms normal map samples from tangent space to world space.

```glsl
vec3 T = normalize(tangent);
vec3 N = normalize(normal);
// Re-orthogonalize T with respect to N (Gram-Schmidt)
T = normalize(T - dot(T, N) * N);
vec3 B = cross(N, T);
mat3 TBN = mat3(T, B, N);
```

### Constructing Coordinate Frames (Look-At)

Camera systems and look-at matrices use the cross product to build an orthonormal basis. Given a forward direction $\vec{F}$ and a world-up hint $\vec{U}_{\text{world}}$:

$$\vec{R} = \text{normalize}(\vec{F} \times \vec{U}_{\text{world}})$$

$$\vec{U} = \vec{R} \times \vec{F}$$

This produces three mutually perpendicular axes: right $\vec{R}$, true up $\vec{U}$, and forward $\vec{F}$. These form the rows (or columns) of the view matrix.

```glsl
vec3 forward = normalize(target - cameraPos);
vec3 right   = normalize(cross(forward, worldUp));
vec3 up      = cross(right, forward);
```

### Determining Point Side (2D)

In 2D (or projected onto a plane), the cross product can determine which side of a line a point lies on. Given edge $\vec{e} = B - A$ and vector to point $\vec{p} = P - A$:

$$(\vec{e} \times \vec{p})_z > 0 \implies P \text{ is to the left}$$

$$(\vec{e} \times \vec{p})_z < 0 \implies P \text{ is to the right}$$

This is the foundation of point-in-triangle tests and software rasterization.

## GLSL Built-in Functions

```glsl
vec3 n = cross(a, b);    // cross product (vec3 only — not defined for vec2 or vec4)
```

Unlike `dot()`, which works on any vector dimension, `cross()` is only defined for `vec3` in GLSL. This makes sense mathematically — the cross product as a vector operation is specific to 3D space.

A common pattern for computing flat normals per-fragment using screen-space derivatives:

```glsl
vec3 flatNormal = normalize(cross(dFdx(worldPos), dFdy(worldPos)));
```

This uses the partial derivatives of the world position to reconstruct the surface normal without any vertex normal data.

## Exercises

<details>
<summary>Exercise: Compute a Cross Product</summary>

<p>Given $\vec{a} = (1, 0, 0)$ and $\vec{b} = (0, 1, 0)$, compute $\vec{a} \times \vec{b}$.</p>

<p><strong>Solution:</strong></p>

<p>$x = (0)(0) - (0)(1) = 0$</p>
<p>$y = (0)(0) - (1)(0) = 0$</p>
<p>$z = (1)(1) - (0)(0) = 1$</p>

<p>$\vec{a} \times \vec{b} = (0, 0, 1)$</p>

<p>This is $\hat{z}$, confirming $\hat{x} \times \hat{y} = \hat{z}$ (the right-hand rule). If we reversed the order: $\vec{b} \times \vec{a} = (0, 0, -1) = -\hat{z}$.</p>
</details>

<details>
<summary>Exercise: Compute a Triangle Normal</summary>

<p>A triangle has vertices $P_0 = (0, 0, 0)$, $P_1 = (1, 0, 0)$, $P_2 = (0, 1, 0)$. Compute the surface normal.</p>

<p><strong>Solution:</strong></p>

<p>Edge vectors: $\vec{e_1} = P_1 - P_0 = (1, 0, 0)$ and $\vec{e_2} = P_2 - P_0 = (0, 1, 0)$</p>

<p>$\vec{e_1} \times \vec{e_2} = (0, 0, 1)$</p>

<p>$|\vec{N}| = 1$, so $\hat{N} = (0, 0, 1)$</p>

<p>The normal points along $+z$, meaning the triangle faces toward us if we're looking down the $-z$ axis (standard OpenGL convention). The winding order $P_0 \to P_1 \to P_2$ is counter-clockwise when viewed from the $+z$ side.</p>
</details>

<details>
<summary>Exercise: Winding Order Check</summary>

<p>You have a triangle with vertices listed as $A = (0, 0, 0)$, $B = (0, 1, 0)$, $C = (1, 0, 0)$ in an OpenGL renderer. The camera looks down the $-z$ axis. Will this triangle be visible or culled?</p>

<p><strong>Solution:</strong></p>

<p>Edge vectors: $\vec{e_1} = B - A = (0, 1, 0)$ and $\vec{e_2} = C - A = (1, 0, 0)$</p>

<p>$\vec{e_1} \times \vec{e_2} = ((1)(0) - (0)(0),\; (0)(1) - (0)(0),\; (0)(0) - (1)(1)) = (0, 0, -1)$</p>

<p>The normal is $(0, 0, -1)$, pointing in the $-z$ direction (away from the camera, which is looking down $-z$ from the $+z$ side). This means the triangle's front face points away from us.</p>

<p>OpenGL expects CCW winding for front faces. From the camera's perspective ($+z$ side), the order $A \to B \to C$ is clockwise, so the front face is on the other side. The triangle will be <strong>back-face culled</strong>.</p>

<p>Fix: either swap two vertices (e.g., use $A, C, B$) or call <code>glFrontFace(GL_CW)</code>.</p>
</details>

## Key Takeaways

- The cross product produces a **vector** perpendicular to both inputs: $\vec{a} \times \vec{b} \perp \vec{a}$ and $\vec{a} \times \vec{b} \perp \vec{b}$
- Its magnitude equals the parallelogram area: $|\vec{a} \times \vec{b}| = |\vec{a}||\vec{b}|\sin\theta$
- It is **anti-commutative**: swapping operands flips the sign — this is why winding order matters
- The right-hand rule determines which of the two perpendicular directions is chosen
- Surface normals, winding order, tangent frames, and look-at cameras all rely on the cross product
- `cross()` in GLSL only works on `vec3` — there is no 2D or 4D cross product
