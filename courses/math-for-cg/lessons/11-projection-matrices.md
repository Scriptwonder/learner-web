# Projection Matrices

After the view matrix places everything relative to the camera, the **projection matrix** maps the 3D scene into a form the GPU can rasterize. This is where three dimensions become two. There are two main projections in real-time graphics: **orthographic** (parallel) and **perspective** (realistic depth). Both are encoded as 4x4 matrices, and understanding their derivation is critical for controlling how your scene is rendered.

## Orthographic Projection

In an orthographic projection, parallel lines remain parallel. There is no foreshortening — an object 100 units away appears the same size as one 1 unit away. This is used for 2D games, UI rendering, CAD applications, and shadow mapping.

### The Orthographic Volume

An orthographic projection defines a rectangular box (an axis-aligned bounding box) in view space with six parameters:

| Parameter | Meaning |
|-----------|---------|
| $l$, $r$ | Left and right bounds on the $x$-axis |
| $b$, $t$ | Bottom and top bounds on the $y$-axis |
| $n$, $f$ | Near and far planes on the $z$-axis |

Everything inside this box is visible. Everything outside is clipped.

### Deriving the Orthographic Matrix

The goal: map the box $[l, r] \times [b, t] \times [n, f]$ to the NDC cube $[-1, 1]^3$.

For each axis, we need to **translate** the center of the range to the origin, then **scale** to fit $[-1, 1]$.

For the $x$-axis, the center is $\frac{r+l}{2}$ and the half-width is $\frac{r-l}{2}$:

$$x_{\text{ndc}} = \frac{x - \frac{r+l}{2}}{\frac{r-l}{2}} = \frac{2x}{r-l} - \frac{r+l}{r-l}$$

The same logic applies to $y$. For $z$, OpenGL maps $[n, f]$ to $[-1, 1]$ (note: in view space, the camera looks along $-z$, so near/far are positive but mapped objects have negative $z$ values; the standard formula handles the sign):

$$z_{\text{ndc}} = \frac{-2z}{f-n} - \frac{f+n}{f-n}$$

### The Full Orthographic Matrix

$$\mathbf{P}_{\text{ortho}} = \begin{pmatrix} \frac{2}{r-l} & 0 & 0 & -\frac{r+l}{r-l} \\ 0 & \frac{2}{t-b} & 0 & -\frac{t+b}{t-b} \\ 0 & 0 & \frac{-2}{f-n} & -\frac{f+n}{f-n} \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

For a symmetric view ($l = -r$, $b = -t$), this simplifies significantly because the translation terms for $x$ and $y$ vanish:

$$\mathbf{P}_{\text{ortho, sym}} = \begin{pmatrix} \frac{1}{r} & 0 & 0 & 0 \\ 0 & \frac{1}{t} & 0 & 0 \\ 0 & 0 & \frac{-2}{f-n} & -\frac{f+n}{f-n} \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Notice the last row is $(0, 0, 0, 1)$, so $w$ stays 1. There is no perspective divide — this is the defining characteristic of orthographic projection.

## Perspective Projection

Perspective projection mimics how human vision works: objects farther away appear smaller. A railroad track's parallel rails appear to converge at the horizon. This is the projection used in virtually all 3D games and visualizations.

### The Frustum

The visible volume is a **frustum** — a truncated pyramid. It is defined by:

| Parameter | Meaning |
|-----------|---------|
| **FOV** | Vertical field of view angle (in degrees or radians) |
| **aspect** | Width / height ratio of the viewport |
| **near** ($n$) | Distance to the near clipping plane |
| **far** ($f$) | Distance to the far clipping plane |

The near plane is a small rectangle; the far plane is a larger rectangle. Everything inside this truncated pyramid is visible.

### The Key Insight: Divide by $-z$

In perspective, an object at distance $d$ from the camera should appear scaled by $\frac{1}{d}$. In view space, points in front of the camera have negative $z$ values (looking along $-z$), so the distance is $-z_{\text{view}}$. The fundamental perspective operation is:

$$x_{\text{projected}} = \frac{n \cdot x}{-z}, \quad y_{\text{projected}} = \frac{n \cdot y}{-z}$$

This maps a point onto the near plane. Objects at the near plane ($z = -n$) are unchanged; objects farther away ($z$ more negative) are shrunk proportionally.

But matrices cannot divide! The 4x4 matrix multiplies, adds, and shuffles components — it cannot perform non-linear operations like division. The clever solution is **homogeneous coordinates**: the matrix places $-z$ into the $w$ component, and the GPU performs the division later (the **perspective divide**).

### Deriving the Perspective Matrix Step by Step

**Starting point:** We want to map the frustum to the NDC cube $[-1,1]^3$.

**Step 1 — Set up the $x$ mapping.** At the near plane, the horizontal extent is determined by the aspect ratio and FOV:

$$\text{right} = n \cdot \tan\!\left(\frac{\text{FOV}}{2}\right) \cdot \text{aspect}$$

$$\text{top} = n \cdot \tan\!\left(\frac{\text{FOV}}{2}\right)$$

For a point at $(x, y, z)$ in view space, projecting onto the near plane:

$$x' = \frac{n \cdot x}{-z}$$

This should map $x' \in [-\text{right}, \text{right}]$ to $[-1, 1]$:

$$x_{\text{ndc}} = \frac{x'}{\text{right}} = \frac{n \cdot x}{-z \cdot \text{right}}$$

**Step 2 — Same for $y$:**

$$y_{\text{ndc}} = \frac{n \cdot y}{-z \cdot \text{top}}$$

**Step 3 — Handle depth ($z$ mapping).** We need $z_{\text{ndc}}$ that maps $z = -n$ to $-1$ and $z = -f$ to $+1$ (OpenGL convention). The mapping must be of the form:

$$z_{\text{ndc}} = \frac{Az + B}{-z}$$

because after the perspective divide by $w = -z$, the numerator $Az + B$ must give the correct NDC depth.

Solving the two boundary conditions:

At $z = -n$: $\frac{A(-n) + B}{n} = -1 \implies -An + B = -n$

At $z = -f$: $\frac{A(-f) + B}{f} = 1 \implies -Af + B = f$

Subtracting the first from the second:

$$-A(f - n) = f + n \implies A = -\frac{f+n}{f-n}$$

Substituting back:

$$B = -\frac{2fn}{f-n}$$

**Step 4 — Assemble the matrix.** The matrix must produce a 4D vector $(x', y', z', w')$ such that after dividing by $w'$, we get the correct NDC coordinates. We set $w' = -z$:

### The Full Perspective Matrix

$$\mathbf{P}_{\text{persp}} = \begin{pmatrix} \frac{n}{\text{right}} & 0 & 0 & 0 \\ 0 & \frac{n}{\text{top}} & 0 & 0 \\ 0 & 0 & -\frac{f+n}{f-n} & -\frac{2fn}{f-n} \\ 0 & 0 & -1 & 0 \end{pmatrix}$$

Using FOV and aspect ratio directly (where $\text{top} = n \cdot \tan(\text{FOV}/2)$ and $\text{right} = \text{top} \cdot \text{aspect}$):

$$\mathbf{P}_{\text{persp}} = \begin{pmatrix} \frac{1}{\text{aspect} \cdot \tan(\text{FOV}/2)} & 0 & 0 & 0 \\ 0 & \frac{1}{\tan(\text{FOV}/2)} & 0 & 0 \\ 0 & 0 & -\frac{f+n}{f-n} & -\frac{2fn}{f-n} \\ 0 & 0 & -1 & 0 \end{pmatrix}$$

The crucial row is the last: $(0, 0, -1, 0)$. This copies $-z_{\text{view}}$ into $w$, enabling the perspective divide.

## Why the Near Plane Cannot Be Zero

Setting $n = 0$ in the perspective matrix causes two problems:

1. **Division by zero** in the matrix terms $\frac{n}{\text{right}}$ — actually, this can be rewritten to avoid the issue, but the depth terms become degenerate.
2. **Depth precision collapse.** The $z$ mapping becomes $z_{\text{ndc}} = \frac{-f}{f-0} + 0 = -1$ for all $z$ — the entire depth range maps to a single value. The depth buffer becomes useless.

In practice, keep the near plane as large as possible (0.1 is typical for games) and the far plane as small as acceptable to maximize depth precision.

## Depth Buffer Precision

The perspective matrix maps $z$ non-linearly. Most of the $[0, 1]$ depth buffer range is concentrated near the near plane:

$$z_{\text{ndc}} = \frac{-\frac{f+n}{f-n} \cdot z - \frac{2fn}{f-n}}{-z}$$

For $n = 0.1$ and $f = 1000$:
- 50% of the depth buffer covers the range $[0.1, 0.2]$ — the first 10cm!
- The remaining 50% covers $[0.2, 1000]$ — 999.8 meters.

This non-linearity causes **z-fighting**: at large distances, two surfaces close together get the same depth buffer value and flicker as they compete for visibility.

**Mitigations:**
- Increase the near plane distance
- Decrease the far plane distance
- Use a **reversed depth buffer** ($z_{\text{ndc}} = 1$ at near, $0$ at far) with a floating-point depth buffer — this distributes precision more evenly
- Use logarithmic depth

## GLSL: `gl_Position.w` and the Perspective Divide

In the vertex shader, you output `gl_Position` as a 4D vector in **clip space**:

```glsl
gl_Position = projection * view * model * vec4(aPos, 1.0);
// gl_Position = (x_clip, y_clip, z_clip, w_clip)
```

The GPU then performs the perspective divide automatically:

$$\text{NDC} = \left(\frac{x_{\text{clip}}}{w_{\text{clip}}}, \frac{y_{\text{clip}}}{w_{\text{clip}}}, \frac{z_{\text{clip}}}{w_{\text{clip}}}\right)$$

For orthographic projection, $w_{\text{clip}} = 1$, so the divide is a no-op. For perspective projection, $w_{\text{clip}} = -z_{\text{view}}$, and the divide produces the perspective foreshortening.

You can access `w` in fragment shaders for effects like linear depth reconstruction:

```glsl
// In fragment shader, to get linear depth:
float linearDepth = (2.0 * near * far) / (far + near - gl_FragCoord.z * (far - near));
```

## GLM: `perspective()` and `ortho()`

```glsl
// Perspective projection
glm::mat4 proj = glm::perspective(
    glm::radians(45.0f),  // vertical FOV
    16.0f / 9.0f,         // aspect ratio
    0.1f,                 // near plane
    100.0f                // far plane
);

// Orthographic projection
glm::mat4 ortho = glm::ortho(
    -10.0f, 10.0f,   // left, right
    -10.0f, 10.0f,   // bottom, top
    0.1f, 100.0f     // near, far
);
```

## Exercises

<details>
<summary>Exercise: Project a Point with the Perspective Matrix</summary>

<p>Given: FOV $= 90°$, aspect $= 1.0$, near $= 1$, far $= 100$. A vertex is at view-space position $(3, 2, -5)$.</p>

<p>Step 1 — Matrix values:<br/>
$\tan(45°) = 1$, so the top-left entries are $\frac{1}{1 \cdot 1} = 1$ and $\frac{1}{1} = 1$.<br/>
$A = -\frac{100+1}{100-1} = -\frac{101}{99} \approx -1.0202$<br/>
$B = -\frac{2 \cdot 100 \cdot 1}{99} \approx -2.0202$</p>

<p>Step 2 — Multiply:<br/>
$x_{\text{clip}} = 1 \cdot 3 = 3$<br/>
$y_{\text{clip}} = 1 \cdot 2 = 2$<br/>
$z_{\text{clip}} = -1.0202 \cdot (-5) + (-2.0202) = 5.1010 - 2.0202 = 3.0808$<br/>
$w_{\text{clip}} = -(-5) = 5$</p>

<p>Step 3 — Perspective divide:<br/>
$x_{\text{ndc}} = 3/5 = 0.6$<br/>
$y_{\text{ndc}} = 2/5 = 0.4$<br/>
$z_{\text{ndc}} = 3.0808/5 = 0.6162$</p>

<p>The point is inside NDC $[-1,1]^3$, so it is visible.</p>
</details>

<details>
<summary>Exercise: Orthographic vs Perspective — Side by Side</summary>

<p>Two cubes at $z = -2$ and $z = -20$ in view space, both with side length 1. The viewport uses FOV $= 60°$, aspect $= 1$, near $= 1$, far $= 100$.</p>

<p><strong>Perspective:</strong> The cube at $z = -2$ has apparent size scaled by $1/2 = 0.5$. The cube at $z = -20$ is scaled by $1/20 = 0.05$. The far cube appears 10x smaller.</p>

<p><strong>Orthographic</strong> (with matching bounds): Both cubes appear the same size because $w = 1$ — there is no distance-based scaling.</p>

<p>This is why perspective projection creates depth perception and orthographic does not.</p>
</details>

<details>
<summary>Exercise: Depth Precision Problem</summary>

<p>With near $= 0.1$ and far $= 1000$, compute $z_{\text{ndc}}$ for two surfaces at $z = -500$ and $z = -501$.</p>

<p>Using $z_{\text{ndc}} = \frac{-(f+n)/(f-n) \cdot z - 2fn/(f-n)}{-z}$:</p>

<p>$A = -(1000.1)/(999.9) \approx -1.0002$<br/>
$B = -(200.0)/(999.9) \approx -0.2000$</p>

<p>At $z = -500$:<br/>
$z_{\text{ndc}} = \frac{-1.0002 \cdot (-500) + (-0.2000)}{500} = \frac{500.1 - 0.2}{500} = \frac{499.9}{500} = 0.9998$</p>

<p>At $z = -501$:<br/>
$z_{\text{ndc}} = \frac{-1.0002 \cdot (-501) + (-0.2000)}{501} = \frac{501.1002 - 0.2}{501} = \frac{500.9002}{501} = 0.9998$</p>

<p>Both map to nearly the same NDC depth value! In a 24-bit depth buffer this difference may be below the representable precision, causing z-fighting. This illustrates why depth precision is concentrated near the near plane.</p>
</details>

## Key Takeaways

- **Orthographic projection** maps a rectangular box to NDC — no foreshortening, $w$ stays 1.
- **Perspective projection** maps a frustum to NDC by placing $-z$ into $w$, creating the perspective divide that makes far objects appear smaller.
- The perspective matrix is derived by projecting onto the near plane ($x/(-z)$, $y/(-z)$) and mapping depth non-linearly.
- **Depth precision** is non-linear — most precision is near the camera. Keep the near plane as far as possible and consider reversed-$z$ for large scenes.
- The near plane must be greater than zero to avoid degenerate depth mapping.
- GLM provides `glm::perspective()` and `glm::ortho()` to build these matrices; the vertex shader outputs `gl_Position` in clip space and the GPU performs the divide.
