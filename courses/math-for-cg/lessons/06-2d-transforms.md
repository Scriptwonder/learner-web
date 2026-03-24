# 2D Transforms

Before jumping into 3D, it pays to master transforms in 2D. The concepts are identical — scale, rotation, translation, composition — but you can visualize everything on a flat plane. Every insight here carries directly into 3D with one extra dimension.

## Linear Transforms in 2D

A **linear transform** is one that can be expressed as a matrix multiply on a vector. Two key properties: the origin stays fixed, and straight lines remain straight.

With a $2 \times 2$ matrix, we can represent:

- **Scaling** — stretch or shrink along axes
- **Rotation** — spin around the origin
- **Shearing** — slant along an axis
- **Reflection** — mirror across an axis

What we **cannot** do with a $2 \times 2$ matrix is **translation** — moving the origin. That requires a trick: homogeneous coordinates.

## Scale

Scaling by factors $s_x$ and $s_y$ along the two axes:

$$S = \begin{pmatrix} s_x & 0 \\ 0 & s_y \end{pmatrix}$$

Applied to a point $(x, y)$:

$$\begin{pmatrix} s_x & 0 \\ 0 & s_y \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix} = \begin{pmatrix} s_x \cdot x \\ s_y \cdot y \end{pmatrix}$$

- Uniform scale: $s_x = s_y$ — preserves proportions
- Non-uniform scale: $s_x \neq s_y$ — stretches differently per axis
- Negative scale: flips (reflects) along that axis. $s_x = -1, s_y = 1$ mirrors across the Y axis.

## Rotation

Rotation by angle $\theta$ counter-clockwise around the origin:

$$R(\theta) = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix}$$

**Derivation**: Consider the unit vectors along X and Y. After rotating by $\theta$:
- $\hat{x} = (1, 0)$ maps to $(\cos\theta, \sin\theta)$ — this becomes the first column
- $\hat{y} = (0, 1)$ maps to $(-\sin\theta, \cos\theta)$ — this becomes the second column

The columns of a rotation matrix are the transformed basis vectors. This insight generalizes to all dimensions.

Example — rotate the point $(1, 0)$ by $90°$:

$$R(90°) = \begin{pmatrix} 0 & -1 \\ 1 & 0 \end{pmatrix}, \quad \begin{pmatrix} 0 & -1 \\ 1 & 0 \end{pmatrix}\begin{pmatrix} 1 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ 1 \end{pmatrix}$$

The point moved from the positive X axis to the positive Y axis — a $90°$ counter-clockwise rotation. Correct.

**Properties of rotation matrices:**
- $\det(R) = \cos^2\theta + \sin^2\theta = 1$ (preserves area)
- $R^T = R^{-1}$ (orthogonal — the inverse is just the transpose)
- $R(\alpha) \cdot R(\beta) = R(\alpha + \beta)$ (rotations compose by adding angles)

## The Translation Problem

Translation means moving a point by an offset $(t_x, t_y)$:

$$(x, y) \rightarrow (x + t_x, y + t_y)$$

Can we encode this as a $2 \times 2$ matrix? Let us try:

$$\begin{pmatrix} a & b \\ c & d \end{pmatrix}\begin{pmatrix} 0 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ 0 \end{pmatrix}$$

No matter what values $a, b, c, d$ take, multiplying by the zero vector always gives the zero vector. But translation should move $(0, 0)$ to $(t_x, t_y)$. **Translation is not a linear transform** — it cannot be done with a $2 \times 2$ matrix.

## Homogeneous Coordinates: The Fix

The solution is to embed 2D space in 3D by adding a third component $w = 1$. A 2D point $(x, y)$ becomes the 3D vector $(x, y, 1)$.

Now we can use a $3 \times 3$ matrix:

$$T = \begin{pmatrix} 1 & 0 & t_x \\ 0 & 1 & t_y \\ 0 & 0 & 1 \end{pmatrix}$$

Applied:

$$\begin{pmatrix} 1 & 0 & t_x \\ 0 & 1 & t_y \\ 0 & 0 & 1 \end{pmatrix}\begin{pmatrix} x \\ y \\ 1 \end{pmatrix} = \begin{pmatrix} x + t_x \\ y + t_y \\ 1 \end{pmatrix}$$

Translation now works as a matrix multiply. The extra coordinate $w = 1$ acts as a "shelf" to hold the translation offset.

Scale and rotation are also upgraded to $3 \times 3$ by filling the bottom-right corner with 1:

$$S = \begin{pmatrix} s_x & 0 & 0 \\ 0 & s_y & 0 \\ 0 & 0 & 1 \end{pmatrix}, \quad R(\theta) = \begin{pmatrix} \cos\theta & -\sin\theta & 0 \\ \sin\theta & \cos\theta & 0 \\ 0 & 0 & 1 \end{pmatrix}$$

## Transform Composition

The real power of matrices: **compose** multiple transforms by multiplying their matrices together. The result is a single matrix that does everything in one step.

In OpenGL's column-major convention, transforms compose **right to left**. The matrix closest to the vector is applied first:

$$M = T \cdot R \cdot S$$

Reading right to left: **first** scale, **then** rotate, **then** translate.

Applied to a vertex:

$$\vec{v'} = T \cdot R \cdot S \cdot \vec{v}$$

The GPU computes this as one matrix-vector multiply after you pre-combine $M = T \cdot R \cdot S$ on the CPU.

### TRS Order

The standard composition order is **T R S** (translate, rotate, scale — reading left to right, but applied right to left). This is because:

1. **Scale first** — change the object's size in its local space
2. **Rotate second** — orient the scaled object
3. **Translate last** — move it to its final position

If you scale after translate, the translation distances also get scaled — usually not what you want.

## Why Order Matters

Consider a square centered at the origin. We want to rotate it $45°$ and then move it 5 units right.

**Correct: Rotate then Translate** ($M = T \cdot R$, applied right to left: rotate first)

1. Rotate $45°$ around origin — the square spins in place
2. Translate $(5, 0)$ — the rotated square slides right

Result: a rotated square at position $(5, 0)$.

**Wrong order: Translate then Rotate** ($M = R \cdot T$, applied right to left: translate first)

1. Translate $(5, 0)$ — the square moves to $(5, 0)$
2. Rotate $45°$ around **the origin** — the square orbits around $(0, 0)$

Result: the square ends up at a completely different position, orbiting the origin at radius 5.

The key insight: **rotation always happens around the origin**. If the object is away from the origin when you rotate, it orbits. This is why you typically rotate first (while the object is still at the origin), then translate.

### Numeric Example

Rotate $90°$ then translate $(3, 1)$:

$$M = T \cdot R = \begin{pmatrix} 1 & 0 & 3 \\ 0 & 1 & 1 \\ 0 & 0 & 1 \end{pmatrix} \begin{pmatrix} 0 & -1 & 0 \\ 1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix} = \begin{pmatrix} 0 & -1 & 3 \\ 1 & 0 & 1 \\ 0 & 0 & 1 \end{pmatrix}$$

Apply to point $(1, 0)$:

$$\begin{pmatrix} 0 & -1 & 3 \\ 1 & 0 & 1 \\ 0 & 0 & 1 \end{pmatrix}\begin{pmatrix} 1 \\ 0 \\ 1 \end{pmatrix} = \begin{pmatrix} 0 + 0 + 3 \\ 1 + 0 + 1 \\ 0 + 0 + 1 \end{pmatrix} = \begin{pmatrix} 3 \\ 2 \\ 1 \end{pmatrix}$$

The point $(1, 0)$ was rotated to $(0, 1)$, then translated to $(3, 2)$. Makes sense.

## GLSL: 2D Transforms

In a 2D shader, you might use `mat3` for transforms:

```glsl
// Build a 2D TRS matrix
mat3 scale = mat3(
    sx,  0.0, 0.0,
    0.0, sy,  0.0,
    0.0, 0.0, 1.0
);

mat3 rotation = mat3(
    cos(angle), sin(angle), 0.0,   // column 0
   -sin(angle), cos(angle), 0.0,   // column 1
    0.0,        0.0,        1.0    // column 2
);

// Note: GLSL mat3() takes values in column-major order!
// Column 0 = (cos, sin, 0), Column 1 = (-sin, cos, 0)

mat3 translation = mat3(
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    tx,  ty,  1.0   // column 2 holds translation
);

// Compose: TRS (scale first, then rotate, then translate)
mat3 transform = translation * rotation * scale;

// Apply to a 2D point
vec2 pos = vec2(1.0, 2.0);
vec3 transformed = transform * vec3(pos, 1.0);
vec2 result = transformed.xy;  // drop w component
```

Notice the column-major layout in GLSL: the translation $(t_x, t_y)$ appears in the **third column** but is written as the third row in the constructor because GLSL fills columns first.

## Shear (Bonus)

Shearing slants one axis proportional to the other. A horizontal shear:

$$H = \begin{pmatrix} 1 & k & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{pmatrix}$$

This shifts $x$ by $k \cdot y$ — the higher the $y$, the more the $x$ shifts. Shear is not commonly used directly, but it appears in some decomposition algorithms.

<details>
<summary>Exercise: Compose a TRS matrix</summary>

<p>Build the combined matrix for: scale by $(2, 3)$, rotate $90°$, translate $(4, 1)$.</p>

<p>$S = \begin{pmatrix} 2 & 0 & 0 \\ 0 & 3 & 0 \\ 0 & 0 & 1 \end{pmatrix}$, $R = \begin{pmatrix} 0 & -1 & 0 \\ 1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix}$, $T = \begin{pmatrix} 1 & 0 & 4 \\ 0 & 1 & 1 \\ 0 & 0 & 1 \end{pmatrix}$</p>

<p>First compute $RS$:</p>
<p>$RS = \begin{pmatrix} 0 & -3 & 0 \\ 2 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix}$</p>

<p>Then $M = T \cdot RS$:</p>
<p>$M = \begin{pmatrix} 0 & -3 & 4 \\ 2 & 0 & 1 \\ 0 & 0 & 1 \end{pmatrix}$</p>
</details>

<details>
<summary>Exercise: Apply a transform to a point</summary>

<p>Using the matrix from the previous exercise, transform the point $(1, 1)$.</p>

<p>$\begin{pmatrix} 0 & -3 & 4 \\ 2 & 0 & 1 \\ 0 & 0 & 1 \end{pmatrix}\begin{pmatrix} 1 \\ 1 \\ 1 \end{pmatrix} = \begin{pmatrix} 0 - 3 + 4 \\ 2 + 0 + 1 \\ 1 \end{pmatrix} = \begin{pmatrix} 1 \\ 3 \\ 1 \end{pmatrix}$</p>

<p>The point $(1, 1)$ was scaled to $(2, 3)$, rotated $90°$ to $(-3, 2)$, then translated to $(1, 3)$. Verify each step individually to build intuition.</p>
</details>

<details>
<summary>Exercise: Order matters</summary>

<p>Given $R = 90°$ rotation and $T = (5, 0)$ translation, compute both $T \cdot R$ and $R \cdot T$, then apply each to point $(1, 0)$. Show that the results differ.</p>

<p><strong>$T \cdot R$ (rotate first, then translate):</strong></p>
<p>$T \cdot R = \begin{pmatrix} 1 & 0 & 5 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{pmatrix}\begin{pmatrix} 0 & -1 & 0 \\ 1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix} = \begin{pmatrix} 0 & -1 & 5 \\ 1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix}$</p>

<p>Applied to $(1, 0, 1)$: $(0 + 0 + 5,\; 1 + 0 + 0,\; 1) = (5, 1, 1)$</p>

<p><strong>$R \cdot T$ (translate first, then rotate):</strong></p>
<p>$R \cdot T = \begin{pmatrix} 0 & -1 & 0 \\ 1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix}\begin{pmatrix} 1 & 0 & 5 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{pmatrix} = \begin{pmatrix} 0 & -1 & 0 \\ 1 & 0 & 5 \\ 0 & 0 & 1 \end{pmatrix}$</p>

<p>Applied to $(1, 0, 1)$: $(0 + 0 + 0,\; 1 + 0 + 5,\; 1) = (0, 6, 1)$</p>

<p>$(5, 1) \neq (0, 6)$. Order matters.</p>
</details>

## Key Takeaways

- In 2D, scale and rotation are $2 \times 2$ linear transforms; translation is **not** linear
- Homogeneous coordinates add a $w = 1$ component, enabling translation via $3 \times 3$ matrices
- Standard composition order is **TRS**: scale first (right), rotate second, translate last (left)
- Transforms compose right-to-left in column-major convention (OpenGL/GLSL)
- Order matters because rotation is always about the origin — rotate before you translate
- In GLSL, use `mat3` for 2D transforms and remember column-major layout
