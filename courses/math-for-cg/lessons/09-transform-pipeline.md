# Transform Pipeline

Every vertex in a 3D scene travels through a chain of coordinate spaces before it becomes a pixel on screen. Understanding this pipeline is essential — it is the backbone of real-time rendering. When you write a vertex shader, you are implementing a step in this chain. When something renders in the wrong place, debugging means tracing through these spaces.

## The Full Pipeline

A vertex starts in **local (object) space** and ends as a **screen pixel**. The journey:

```mermaid
graph LR
    A[Local Space] -->|Model Matrix| B[World Space]
    B -->|View Matrix| C[View/Eye Space]
    C -->|Projection Matrix| D[Clip Space]
    D -->|Perspective Divide| E[NDC]
    E -->|Viewport Transform| F[Screen Space]
```

Each arrow is a matrix multiplication (or, for the perspective divide, a division). Let us walk through each space.

## Local Space (Object Space)

This is where your mesh lives as defined by the artist. A cube might have vertices ranging from $(-1, -1, -1)$ to $(1, 1, 1)$. A character model might be centered at the origin, facing forward along $+Z$ or $-Z$ depending on convention.

Local space is **per-object**. Every object has its own local space. The vertices in your mesh file are in local space.

## Model Matrix: Local to World

The **model matrix** $M$ transforms vertices from local space into **world space** — the shared coordinate system where all objects coexist.

The model matrix encodes the object's:
- **Position** (translation)
- **Orientation** (rotation)
- **Size** (scale)

$$\vec{v}_{world} = M \cdot \vec{v}_{local}$$

A typical model matrix for an object at position $(10, 0, -5)$, rotated $45°$ around Y, at half scale:

$$M = T \cdot R_y \cdot S = \begin{pmatrix} 0.354 & 0 & 0.354 & 10 \\ 0 & 0.5 & 0 & 0 \\ -0.354 & 0 & 0.354 & -5 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

The upper-left $3 \times 3$ contains the combined rotation and scale. The right column holds the world position.

Each object in the scene has its own model matrix. The GPU uses it to place every object where it belongs.

## View Matrix: World to Eye

The **view matrix** $V$ transforms the entire world so that the **camera** is at the origin, looking down the $-Z$ axis (OpenGL convention).

Why $-Z$? Convention. OpenGL uses a right-handed coordinate system where $+X$ is right, $+Y$ is up, and $+Z$ points out of the screen toward the viewer. The camera looks "into" the scene, which is $-Z$.

$$\vec{v}_{eye} = V \cdot \vec{v}_{world}$$

The view matrix is the **inverse of the camera's model matrix**. If the camera is at position $\vec{e}$, looking at target $\vec{t}$, with up direction $\vec{u}$, the classic **lookAt** construction is:

1. Compute the camera's basis vectors:
   - Forward: $\hat{f} = \text{normalize}(\vec{e} - \vec{t})$ (points away from target, toward viewer)
   - Right: $\hat{r} = \text{normalize}(\vec{u} \times \hat{f})$
   - Up: $\hat{u'} = \hat{f} \times \hat{r}$

2. Build the view matrix:

$$V = \begin{pmatrix} r_x & r_y & r_z & -\hat{r} \cdot \vec{e} \\ u'_x & u'_y & u'_z & -\hat{u'} \cdot \vec{e} \\ f_x & f_y & f_z & -\hat{f} \cdot \vec{e} \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

This matrix first rotates the world so the camera's axes align with the coordinate axes, then translates so the camera sits at the origin. In GLM:

```cpp
glm::mat4 view = glm::lookAt(
    glm::vec3(0, 5, 10),   // camera position (eye)
    glm::vec3(0, 0, 0),    // look-at target
    glm::vec3(0, 1, 0)     // world up direction
);
```

## Projection Matrix: Eye to Clip

The **projection matrix** $P$ maps the 3D eye-space volume to **clip space** — a 4D homogeneous space where the GPU will perform clipping (discarding geometry outside the view).

There are two types:

### Perspective Projection

Mimics how a real camera works — objects farther away appear smaller.

The viewing volume is a **frustum** (a truncated pyramid) defined by:
- **Field of view** (fov): vertical angle of the camera cone
- **Aspect ratio**: width / height of the viewport
- **Near plane** ($n$): closest visible distance
- **Far plane** ($f$): farthest visible distance

The perspective projection matrix (OpenGL convention, symmetric frustum):

$$P_{persp} = \begin{pmatrix} \frac{1}{\text{aspect} \cdot \tan(\text{fov}/2)} & 0 & 0 & 0 \\ 0 & \frac{1}{\tan(\text{fov}/2)} & 0 & 0 \\ 0 & 0 & -\frac{f+n}{f-n} & -\frac{2fn}{f-n} \\ 0 & 0 & -1 & 0 \end{pmatrix}$$

The critical row is the **bottom row**: $(0, 0, -1, 0)$. This copies $-z_{eye}$ into $w_{clip}$:

$$w_{clip} = -z_{eye}$$

After the perspective divide ($x/w, y/w, z/w$), objects at greater distance (more negative $z_{eye}$, so larger $w$) are divided by a bigger number and appear smaller. This is perspective foreshortening.

```cpp
glm::mat4 proj = glm::perspective(
    glm::radians(45.0f),  // fov
    16.0f / 9.0f,          // aspect ratio
    0.1f,                  // near plane
    100.0f                 // far plane
);
```

### Orthographic Projection

No perspective — objects at any distance appear the same size. Used for 2D games, UI rendering, CAD, and shadow mapping.

The viewing volume is a rectangular **box** defined by left, right, bottom, top, near, far:

$$P_{ortho} = \begin{pmatrix} \frac{2}{r-l} & 0 & 0 & -\frac{r+l}{r-l} \\ 0 & \frac{2}{t-b} & 0 & -\frac{t+b}{t-b} \\ 0 & 0 & -\frac{2}{f-n} & -\frac{f+n}{f-n} \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Notice the bottom row is $(0, 0, 0, 1)$ — $w$ stays at 1. No perspective divide effect. In GLM:

```cpp
glm::mat4 proj = glm::ortho(
    -10.0f, 10.0f,    // left, right
    -10.0f, 10.0f,    // bottom, top
     0.1f,  100.0f    // near, far
);
```

## Clip Space

After multiplying by the projection matrix, vertices are in **clip space** — a 4D homogeneous coordinate $(x_c, y_c, z_c, w_c)$.

The GPU clips geometry against the clip-space boundaries:

$$-w_c \leq x_c \leq w_c$$
$$-w_c \leq y_c \leq w_c$$
$$-w_c \leq z_c \leq w_c$$

Anything outside these bounds is clipped (cut away). Triangles that partially intersect the boundary are cut and new vertices are generated. This happens automatically between the vertex and fragment shader — you do not implement it.

## Perspective Divide: Clip to NDC

The GPU divides $x_c$, $y_c$, and $z_c$ by $w_c$:

$$(x_{ndc}, y_{ndc}, z_{ndc}) = \left(\frac{x_c}{w_c}, \frac{y_c}{w_c}, \frac{z_c}{w_c}\right)$$

After this division, the visible volume becomes a **cube**:
- OpenGL: $[-1, 1]$ in all three axes
- Vulkan/DirectX: $[-1, 1]$ in XY, $[0, 1]$ in Z

This is **Normalized Device Coordinates (NDC)** — a device-independent coordinate space. Every visible vertex has coordinates in $[-1, 1]$, regardless of resolution, aspect ratio, or field of view.

## Viewport Transform: NDC to Screen

The final step maps NDC to actual pixel coordinates on screen. Given a viewport with origin $(x_0, y_0)$, width $w$, and height $h$:

$$x_{screen} = \frac{x_{ndc} + 1}{2} \cdot w + x_0$$
$$y_{screen} = \frac{y_{ndc} + 1}{2} \cdot h + y_0$$
$$z_{screen} = \frac{z_{ndc} + 1}{2} \cdot (f - n) + n$$

Where $n$ and $f$ are the depth range (typically $0$ and $1$). The $z_{screen}$ value is written to the depth buffer for depth testing.

In OpenGL:

```cpp
glViewport(0, 0, screenWidth, screenHeight);  // set viewport
glDepthRange(0.0, 1.0);                        // set depth range
```

You rarely compute this transform yourself — the GPU handles it after the perspective divide.

## The MVP Matrix

In practice, you combine Model, View, and Projection into a single **MVP** matrix on the CPU:

$$MVP = P \cdot V \cdot M$$

Then send it to the vertex shader as a uniform:

```glsl
#version 330 core

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_texcoord;

uniform mat4 u_mvp;
uniform mat4 u_model;
uniform mat3 u_normalMatrix;  // inverse-transpose of model

out vec3 v_worldPos;
out vec3 v_worldNormal;
out vec2 v_texcoord;

void main() {
    // Transform to clip space in one multiply
    gl_Position = u_mvp * vec4(a_position, 1.0);

    // For lighting, we also need world-space position and normal
    v_worldPos = (u_model * vec4(a_position, 1.0)).xyz;
    v_worldNormal = normalize(u_normalMatrix * a_normal);
    v_texcoord = a_texcoord;
}
```

### Why Not Just Send MVP?

You often need **intermediate spaces** for lighting calculations:
- **World-space position**: for distance to lights
- **World-space normal**: for diffuse/specular dot products
- **View-space position**: for fog, screen-space effects

So you typically send $M$, $V$, $P$ (or $MVP$ + $M$) separately.

## C++ Setup Example

```cpp
// Per frame: update view and projection
glm::mat4 view = glm::lookAt(cameraPos, cameraTarget, worldUp);
glm::mat4 proj = glm::perspective(glm::radians(fov), aspect, 0.1f, 100.0f);

// Per object: compute model and MVP
glm::mat4 model = glm::mat4(1.0f);
model = glm::translate(model, objectPosition);
model = glm::rotate(model, objectAngle, rotationAxis);
model = glm::scale(model, objectScale);

glm::mat4 mvp = proj * view * model;
glm::mat3 normalMat = glm::transpose(glm::inverse(glm::mat3(model)));

// Upload to shader
glUniformMatrix4fv(mvpLoc, 1, GL_FALSE, glm::value_ptr(mvp));
glUniformMatrix4fv(modelLoc, 1, GL_FALSE, glm::value_ptr(model));
glUniformMatrix3fv(normalLoc, 1, GL_FALSE, glm::value_ptr(normalMat));
```

## Summary Table

| Space | Matrix | Purpose |
|-------|--------|---------|
| Local | — | Mesh as authored |
| World | Model ($M$) | Place object in scene |
| Eye/View | View ($V$) | Camera at origin, looking $-Z$ |
| Clip | Projection ($P$) | Prepare for clipping + perspective |
| NDC | Perspective divide ($\div w$) | Normalize to $[-1,1]$ cube |
| Screen | Viewport transform | Map to pixel coordinates |

<details>
<summary>Exercise: Trace a vertex through the pipeline</summary>

<p>A vertex starts at local position $(1, 0, 0, 1)$. The model matrix translates by $(5, 0, 0)$. The camera is at $(0, 0, 10)$ looking at the origin. Trace the vertex through to NDC (use simplified matrices).</p>

<p><strong>Step 1 — Model transform:</strong></p>
<p>$\vec{v}_{world} = M \cdot \vec{v}_{local} = T(5,0,0) \cdot (1,0,0,1) = (6, 0, 0, 1)$</p>

<p><strong>Step 2 — View transform:</strong></p>
<p>The camera is at $(0,0,10)$ looking at origin. The view matrix translates by $(0,0,-10)$ (simplified).</p>
<p>$\vec{v}_{eye} = V \cdot \vec{v}_{world} = (6, 0, -10, 1)$</p>

<p><strong>Step 3 — Projection:</strong></p>
<p>With perspective projection, $w_{clip} = -z_{eye} = 10$.</p>
<p>$\vec{v}_{clip} \approx (6 \cdot f_x,\; 0,\; z_{mapped},\; 10)$ where $f_x$ depends on fov/aspect.</p>

<p><strong>Step 4 — Perspective divide:</strong></p>
<p>$x_{ndc} = x_{clip} / 10$, making the vertex appear small because it is 10 units away.</p>

<p>The key insight: the further the vertex is from the camera, the larger $w$ becomes, and the smaller the vertex appears after the divide.</p>
</details>

<details>
<summary>Exercise: Identify which matrix does what</summary>

<p>For each scenario, identify which matrix is responsible:</p>

<p>1. "The teapot appears at position (3, 1, 0) in the scene"</p>
<p>2. "When I turn my head left, everything shifts right"</p>
<p>3. "Distant mountains look smaller than the tree in front of me"</p>
<p>4. "The character is twice its normal size"</p>

<p><strong>Answers:</strong></p>
<p>1. <strong>Model matrix</strong> — positions the object in world space</p>
<p>2. <strong>View matrix</strong> — rotating the camera transforms the whole world in the opposite direction</p>
<p>3. <strong>Projection matrix</strong> (+ perspective divide) — perspective projection encodes depth into $w$, and the divide causes foreshortening</p>
<p>4. <strong>Model matrix</strong> — the scale component of the model matrix</p>
</details>

<details>
<summary>Exercise: Orthographic vs perspective</summary>

<p>You are rendering a 2D UI overlay on top of a 3D scene. Which projection type should you use and why?</p>

<p><strong>Orthographic projection.</strong> UI elements should not change size based on distance — a button at "depth 5" and a button at "depth 10" must look identical. Orthographic projection maps directly without perspective foreshortening. The $w$ component stays at 1, so no perspective divide occurs.</p>

<p>Typical setup:</p>

<p>
```cpp
// Map directly to screen coordinates
glm::mat4 uiProj = glm::ortho(
    0.0f, (float)screenWidth,   // left, right
    0.0f, (float)screenHeight,  // bottom, top
    -1.0f, 1.0f                 // near, far
);
```
</p>

<p>With this projection, vertex position $(100, 200, 0, 1)$ maps directly to pixel $(100, 200)$.</p>
</details>

## Key Takeaways

- The vertex transform pipeline is: **Local** $\xrightarrow{M}$ **World** $\xrightarrow{V}$ **Eye** $\xrightarrow{P}$ **Clip** $\xrightarrow{\div w}$ **NDC** $\xrightarrow{viewport}$ **Screen**
- The **model matrix** places an object in the world (TRS)
- The **view matrix** moves the world so the camera is at the origin looking down $-Z$
- The **projection matrix** maps 3D to clip space; perspective sets $w = -z$ for depth foreshortening
- The **perspective divide** ($\div w$) is performed automatically by the GPU — do not do it yourself
- Combine into $MVP = P \cdot V \cdot M$ and send as a single uniform for efficiency
- You often also need $M$ separately for world-space lighting calculations
