# Homogeneous Coordinates

Homogeneous coordinates are the mathematical trick that makes modern graphics pipelines possible. They let us represent translation, rotation, scale, and **perspective projection** all as matrix multiplications. Without them, we would need separate code for each transform type. With them, the GPU does one thing — multiply $4 \times 4$ matrices — and handles everything.

## The Problem: Translation Is Not Linear

Recall from the 2D transforms lesson: a linear transform maps the origin to the origin. Translation moves the origin. Therefore translation is **not linear** and cannot be represented as a $3 \times 3$ matrix acting on $(x, y, z)$.

We could handle translation by adding it separately:

$$\vec{v'} = M\vec{v} + \vec{t}$$

But this breaks the elegant "everything is a matrix multiply" pattern. We cannot compose transforms by multiplying matrices. We cannot pre-compute a single MVP matrix. The GPU pipeline becomes harder to design.

## The Solution: A Fourth Component

Add a fourth coordinate $w$. A 3D point $(x, y, z)$ becomes $(x, y, z, 1)$:

$$\vec{p} = \begin{pmatrix} x \\ y \\ z \\ 1 \end{pmatrix}$$

Now a $4 \times 4$ matrix can encode translation:

$$T = \begin{pmatrix} 1 & 0 & 0 & t_x \\ 0 & 1 & 0 & t_y \\ 0 & 0 & 1 & t_z \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

$$T\vec{p} = \begin{pmatrix} x + t_x \\ y + t_y \\ z + t_z \\ 1 \end{pmatrix}$$

Translation now works as a matrix multiply. The extra dimension absorbs the offset.

## Points vs Directions

This is one of the most important distinctions in CG math:

- **Point**: $(x, y, z, 1)$ — a position in space. Affected by translation.
- **Direction**: $(x, y, z, 0)$ — a vector with no position. **Not** affected by translation.

Why this matters: if you translate the world 10 units to the right, a surface normal should not change. Normals are directions, not points. Setting $w = 0$ ensures the translation column of the matrix has no effect:

$$\begin{pmatrix} 1 & 0 & 0 & t_x \\ 0 & 1 & 0 & t_y \\ 0 & 0 & 1 & t_z \\ 0 & 0 & 0 & 1 \end{pmatrix}\begin{pmatrix} d_x \\ d_y \\ d_z \\ 0 \end{pmatrix} = \begin{pmatrix} d_x \\ d_y \\ d_z \\ 0 \end{pmatrix}$$

The direction passes through unchanged. Rotation and scale still apply (they are in the upper-left $3 \times 3$), but translation does not.

### Operations Preserve Types

The $w$ component tracks what kind of quantity you have:

| Operation | Result |
|-----------|--------|
| Point - Point | Direction ($w = 1 - 1 = 0$) |
| Point + Direction | Point ($w = 1 + 0 = 1$) |
| Direction + Direction | Direction ($w = 0 + 0 = 0$) |
| Point + Point | **Invalid** ($w = 2$ — not meaningful) |

This naturally enforces geometric correctness. Subtracting two positions gives a direction vector. Adding a direction to a position gives a new position. Adding two positions is geometrically meaningless — and the $w = 2$ signals that.

## The 4x4 Matrix Structure

A general affine transform matrix has this layout:

$$M = \begin{pmatrix} \mathbf{R/S} & \vec{t} \\ \vec{0}^T & 1 \end{pmatrix} = \begin{pmatrix} r_{00} & r_{01} & r_{02} & t_x \\ r_{10} & r_{11} & r_{12} & t_y \\ r_{20} & r_{21} & r_{22} & t_z \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

- **Upper-left 3x3** ($\mathbf{R/S}$): rotation and scale. If there is no scale, this is a pure rotation matrix (orthogonal, determinant = 1). If there is non-uniform scale, normals need the inverse-transpose.
- **Right column** ($\vec{t}$): translation vector.
- **Bottom row** $(0, 0, 0, 1)$: maintains the affine structure. Points in, points out. This changes only for **projection** matrices.

Reading a 4x4 matrix, you can immediately identify what it does:
- Identity upper-left + non-zero right column = pure translation
- Orthogonal upper-left + zero right column = pure rotation
- Diagonal upper-left + zero right column = pure scale
- Full upper-left + non-zero right column = combined rotation/scale/translation

## Converting Back: The $w$ Divide

Given a homogeneous coordinate $(x, y, z, w)$, the corresponding Cartesian (3D) point is:

$$\left(\frac{x}{w}, \frac{y}{w}, \frac{z}{w}\right)$$

For affine transforms, $w$ stays at 1 after the multiply, so no division is needed. But **perspective projection** deliberately sets $w$ to something other than 1 — this is where the magic happens.

## Perspective Divide

The perspective projection matrix produces output where $w \neq 1$. Specifically, it sets $w = -z$ (or $z$, depending on convention), encoding depth:

$$\begin{pmatrix} x_{clip} \\ y_{clip} \\ z_{clip} \\ w_{clip} \end{pmatrix} = P \cdot \begin{pmatrix} x_{eye} \\ y_{eye} \\ z_{eye} \\ 1 \end{pmatrix}$$

After the projection, the GPU performs the **perspective divide**:

$$\begin{pmatrix} x_{ndc} \\ y_{ndc} \\ z_{ndc} \end{pmatrix} = \begin{pmatrix} x_{clip} / w_{clip} \\ y_{clip} / w_{clip} \\ z_{clip} / w_{clip} \end{pmatrix}$$

This division by $w$ is what creates the **perspective foreshortening** effect — distant objects (large $|w|$) are divided by a bigger number and appear smaller. Close objects (small $|w|$) appear larger. This is how a flat 2D screen simulates depth.

### Why $w$ Encodes Depth

The perspective projection matrix sets $w_{clip} = -z_{eye}$ (in OpenGL, where the camera looks down $-Z$). An object at $z = -10$ gets $w = 10$. Its $x$ and $y$ are divided by 10, shrinking it. An object at $z = -1$ gets $w = 1$, keeping its apparent size. This is exactly how real cameras work — distance causes angular size reduction.

## GLSL and the $w$ Component

In a vertex shader, you output `gl_Position` as a `vec4`. The GPU automatically performs the perspective divide after the vertex shader runs — you do not divide by $w$ yourself.

```glsl
// Vertex shader
uniform mat4 u_mvp;

void main() {
    // Output clip-space position (w != 1 after perspective projection)
    gl_Position = u_mvp * vec4(a_position, 1.0);

    // DON'T do this — the GPU handles the perspective divide:
    // gl_Position.xyz /= gl_Position.w;  // WRONG
}
```

When constructing positions in the shader, always be conscious of $w$:

```glsl
// Transforming a position — use w=1
vec4 worldPos = u_model * vec4(localPos, 1.0);

// Transforming a direction (normal, light dir) — use w=0
vec4 worldNormal = u_model * vec4(localNormal, 0.0);

// But for normals with non-uniform scale, use the inverse-transpose:
vec3 correctNormal = mat3(transpose(inverse(u_model))) * localNormal;
```

### Extracting Position from a Matrix

The translation column of a model matrix gives the object's world position:

```glsl
// In column-major, column 3 is the translation
vec3 objectWorldPos = u_model[3].xyz;

// The three column vectors are the object's local axes in world space
vec3 rightDir   = u_model[0].xyz;  // local X in world
vec3 upDir      = u_model[1].xyz;  // local Y in world
vec3 forwardDir = u_model[2].xyz;  // local Z in world
```

## Geometric Interpretation

Homogeneous coordinates have a deep geometric meaning. The point $(x, y, z, w)$ in 4D space represents the 3D point $(x/w, y/w, z/w)$. All points along the line from the 4D origin through $(x, y, z, w)$ represent the same 3D point:

$$(x, y, z, w) \sim (2x, 2y, 2z, 2w) \sim (kx, ky, kz, kw)$$

They are all equivalent — an entire "line" of 4D points maps to one 3D point.

What about $w = 0$? Division by zero — the point is "at infinity." This is geometrically meaningful: a direction vector points toward infinity. This is why directions use $w = 0$.

## Common Pitfalls

1. **Forgetting $w = 1$**: passing a `vec3` to a `mat4` multiply. GLSL will error, but C++ code might silently use $w = 0$.

2. **Dividing by $w$ manually**: the GPU does the perspective divide after the vertex shader. Doing it yourself causes double-division.

3. **Using $w = 1$ for directions**: normals and light directions should use $w = 0$, or better, use `mat3` to avoid the issue entirely.

4. **Ignoring $w$ after a transform**: if you do `mat4 * vec4(pos, 1.0)` and use the result for further calculations, check if $w$ is still 1. After a projection, it will not be.

<details>
<summary>Exercise: Convert between homogeneous and Cartesian</summary>

<p>Convert the homogeneous coordinate $(6, 4, 10, 2)$ to Cartesian 3D.</p>

<p>Divide by $w$: $\left(\frac{6}{2}, \frac{4}{2}, \frac{10}{2}\right) = (3, 2, 5)$</p>

<p>Now convert the Cartesian point $(7, -3, 1)$ to homogeneous.</p>

<p>Add $w = 1$: $(7, -3, 1, 1)$</p>

<p>Note: $(14, -6, 2, 2)$ would also be valid — it represents the same point. But $w = 1$ is the canonical form.</p>
</details>

<details>
<summary>Exercise: Apply a 4x4 transform</summary>

<p>Given a matrix that scales by 2 and translates by $(3, 0, -1)$:</p>

<p>$M = \begin{pmatrix} 2 & 0 & 0 & 3 \\ 0 & 2 & 0 & 0 \\ 0 & 0 & 2 & -1 \\ 0 & 0 & 0 & 1 \end{pmatrix}$</p>

<p>Apply to the point $(1, 1, 1)$ and the direction $(1, 0, 0)$.</p>

<p><strong>Point</strong> ($w = 1$):</p>
<p>$M \begin{pmatrix} 1 \\ 1 \\ 1 \\ 1 \end{pmatrix} = \begin{pmatrix} 2 + 3 \\ 2 + 0 \\ 2 - 1 \\ 1 \end{pmatrix} = \begin{pmatrix} 5 \\ 2 \\ 1 \\ 1 \end{pmatrix}$</p>

<p>Result: point $(5, 2, 1)$ — scaled and translated.</p>

<p><strong>Direction</strong> ($w = 0$):</p>
<p>$M \begin{pmatrix} 1 \\ 0 \\ 0 \\ 0 \end{pmatrix} = \begin{pmatrix} 2 \\ 0 \\ 0 \\ 0 \end{pmatrix}$</p>

<p>Result: direction $(2, 0, 0)$ — scaled but NOT translated. Correct behavior for a direction vector.</p>
</details>

<details>
<summary>Exercise: Perspective divide</summary>

<p>A vertex shader outputs $\text{gl\_Position} = (4.0, -3.0, 9.5, 10.0)$. What are the NDC coordinates?</p>

<p>Divide $xyz$ by $w$:</p>

<p>$x_{ndc} = 4.0 / 10.0 = 0.4$</p>
<p>$y_{ndc} = -3.0 / 10.0 = -0.3$</p>
<p>$z_{ndc} = 9.5 / 10.0 = 0.95$</p>

<p>NDC: $(0.4, -0.3, 0.95)$. Since all components are in $[-1, 1]$ (OpenGL convention), this vertex is inside the visible frustum and will be rendered.</p>

<p>The large $w = 10$ means this vertex is far from the camera — its screen-space footprint is small (perspective foreshortening).</p>
</details>

## Key Takeaways

- Homogeneous coordinates add a 4th component $w$ to enable translation as a matrix multiply
- Points use $w = 1$ (affected by translation); directions use $w = 0$ (immune to translation)
- The 4x4 matrix structure: upper-left $3 \times 3$ = rotation/scale, right column = translation
- The **perspective divide** $(x/w, y/w, z/w)$ creates depth foreshortening — distant objects shrink
- The GPU performs the perspective divide automatically after the vertex shader
- Always be explicit about $w$ when constructing `vec4` values in GLSL
- $(x, y, z, 0)$ is a "point at infinity" — geometrically, this is a direction
