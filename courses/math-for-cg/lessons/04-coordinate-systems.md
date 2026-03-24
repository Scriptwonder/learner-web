# Coordinate Systems

A 3D model starts as numbers in a file and ends as colored pixels on your screen. Between those two endpoints, the model's vertices pass through a sequence of coordinate systems — each one chosen because it makes a specific computation simpler. Understanding this pipeline is the key to understanding how rendering actually works.

## What Defines a Coordinate System

A coordinate system (or coordinate **space**) is defined by three things:

1. **An origin** — the point where all axes meet (the "zero point")
2. **Basis vectors** — a set of directions that define the axes
3. **A handedness convention** — the relationship between the axes

Any point in space can be described as a weighted sum of the basis vectors, offset from the origin:

$$P = O + x\hat{e}_1 + y\hat{e}_2 + z\hat{e}_3$$

where $O$ is the origin and $\hat{e}_1, \hat{e}_2, \hat{e}_3$ are the basis vectors. The scalars $x, y, z$ are the **coordinates** of the point in that system.

The same physical point in space has different coordinates depending on which coordinate system you use to describe it — just as a city has different addresses depending on whether you use GPS coordinates, a street address, or "two blocks north of the park."

### Basis Vectors and Orthonormality

In CG, we almost always use **orthonormal** bases: the basis vectors are mutually perpendicular (orthogonal) and each has unit length (normal):

$$\hat{e}_i \cdot \hat{e}_j = \begin{cases} 1 & \text{if } i = j \\ 0 & \text{if } i \neq j \end{cases}$$

The standard basis in 3D is $\hat{x} = (1,0,0)$, $\hat{y} = (0,1,0)$, $\hat{z} = (0,0,1)$. But any three mutually perpendicular unit vectors form a valid orthonormal basis.

## Left-Handed vs Right-Handed

There are two ways to orient three perpendicular axes in space, and they are **mirror images** of each other:

**Right-handed** (OpenGL, Blender, glTF):
- Point your right hand's fingers along $+x$, curl toward $+y$; your thumb points in $+z$
- $+z$ comes **out of** the screen
- $\hat{x} \times \hat{y} = +\hat{z}$

**Left-handed** (DirectX, Unity, Unreal):
- Point your left hand's fingers along $+x$, curl toward $+y$; your thumb points in $+z$
- $+z$ goes **into** the screen
- $\hat{x} \times \hat{y} = +\hat{z}$ (but $z$ means the opposite physical direction)

The mathematical operations are identical in both systems — only the interpretation of which direction $+z$ points changes. However, mixing conventions causes mirrored or inside-out geometry, so it's critical to know which convention your engine uses.

| Convention | $+z$ Direction | Users |
|---|---|---|
| Right-handed | Out of screen | OpenGL, Vulkan (with flip), Blender, glTF |
| Left-handed | Into screen | DirectX, Unity, Unreal |

When importing assets between engines with different handedness, you typically negate or swap one axis component.

## The Coordinate Space Pipeline

A vertex in a 3D scene passes through a series of coordinate spaces before becoming a pixel. Each space exists because it makes a particular computation easier or more natural.

```mermaid
graph LR
    A[Object Space] -->|Model Matrix| B[World Space]
    B -->|View Matrix| C[Camera Space]
    C -->|Projection Matrix| D[Clip Space]
    D -->|Perspective Divide| E[NDC]
    E -->|Viewport Transform| F[Screen Space]
```

### Object Space (Model Space, Local Space)

**What it is:** The coordinate system in which a 3D model was authored. The origin is typically at the model's center or base, and the axes align with the model's natural orientation.

**Why it exists:** Artists model a character or prop in isolation, without worrying about where it will be placed in the scene. A sword is built centered at the origin regardless of whether it will later be in a hand, a rack, or flying through the air.

**Example:** A unit cube has vertices at $(\pm 0.5, \pm 0.5, \pm 0.5)$ in object space, no matter where it appears in the world.

All vertex positions in a mesh file (OBJ, FBX, glTF) are in object space.

### World Space

**What it is:** The shared coordinate system of the entire scene. Every object, light, and camera has a position and orientation in world space.

**How to get there:** Multiply by the **model matrix** $M$, which encodes the object's translation, rotation, and scale:

$$P_{\text{world}} = M \cdot P_{\text{object}}$$

**Why it exists:** Lighting calculations, physics, and spatial queries (like "is this object near that one?") require all objects to share a common frame of reference.

**Example:** You place two instances of the same cube mesh. One is at position $(5, 0, 0)$ and the other at $(0, 3, -2)$. Both share the same object-space vertices, but their model matrices differ, producing different world-space positions.

### Camera Space (View Space, Eye Space)

**What it is:** The world as seen from the camera's perspective. The camera sits at the origin, looking down $-z$ (in OpenGL's right-handed convention), with $+y$ pointing up and $+x$ pointing right.

**How to get there:** Multiply by the **view matrix** $V$, which is the inverse of the camera's own model matrix:

$$P_{\text{camera}} = V \cdot P_{\text{world}}$$

**Why it exists:** Projection (the step that creates perspective) is much simpler when the camera is at the origin looking down a known axis. Rather than writing a general "project from any viewpoint" function, we transform the entire world so that the camera is always in a standard position, then project.

The classic `lookAt` function builds the view matrix from a camera position, target point, and up vector — using cross products internally to construct the camera's orthonormal basis, as covered in lesson 03.

### Clip Space

**What it is:** The coordinate system after the projection matrix has been applied. Vertices have four components $(x, y, z, w)$ — this is **homogeneous coordinate** space.

**How to get there:** Multiply by the **projection matrix** $P$:

$$P_{\text{clip}} = P \cdot P_{\text{camera}}$$

**Why it exists:** The projection matrix encodes either perspective (far objects appear smaller) or orthographic (no size change with distance) projection. It maps the view frustum — the 3D region the camera can see — into a canonical cube.

After this step, the GPU performs **clipping**: any geometry outside the range $-w \leq x, y, z \leq w$ is discarded or trimmed. This is why it's called "clip space."

In a vertex shader, you write to `gl_Position` in clip space:

```glsl
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main() {
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

Note the multiplication order: the matrices are applied right-to-left. The vertex goes from object space, through world space, through camera space, and into clip space in a single expression. In practice, the `projection * view * model` combination is often precomputed as the **MVP matrix**.

### Normalized Device Coordinates (NDC)

**What it is:** Clip space after the **perspective divide** — dividing all components by $w$:

$$\begin{pmatrix} x_{\text{ndc}} \\ y_{\text{ndc}} \\ z_{\text{ndc}} \end{pmatrix} = \begin{pmatrix} x_{\text{clip}} / w_{\text{clip}} \\ y_{\text{clip}} / w_{\text{clip}} \\ z_{\text{clip}} / w_{\text{clip}} \end{pmatrix}$$

**Range:** In OpenGL, NDC coordinates range from $-1$ to $+1$ on all three axes. In Vulkan and DirectX, $z$ ranges from $0$ to $1$.

**Why it exists:** The perspective divide is what makes distant objects smaller — it's the mathematical core of perspective projection. After this step, the visible scene is a normalized cube regardless of the original frustum shape, making the remaining operations (rasterization, depth testing) resolution-independent.

The GPU performs this division automatically between the vertex shader and the fragment shader. You never write code for it.

### Screen Space (Window Space)

**What it is:** The final 2D pixel coordinates on the screen, plus depth.

**How to get there:** The **viewport transform** maps NDC's $[-1, 1]$ range to actual pixel coordinates $[0, \text{width}] \times [0, \text{height}]$:

$$x_{\text{screen}} = \frac{x_{\text{ndc}} + 1}{2} \cdot \text{width}$$

$$y_{\text{screen}} = \frac{y_{\text{ndc}} + 1}{2} \cdot \text{height}$$

The $z$ component is mapped to the depth buffer range (typically $[0, 1]$) and used for depth testing — determining which fragment is in front when multiple triangles overlap at the same pixel.

**Why it exists:** The rasterizer needs to know which pixels each triangle covers, which requires actual pixel positions. You set the viewport with `glViewport(x, y, width, height)`.

## Why Multiple Spaces?

A common question is "why not just work in world space for everything?" The answer is that each space is **optimized for a specific task**:

| Space | Optimized For |
|---|---|
| Object space | Modeling, mesh storage, skeletal animation |
| World space | Lighting, physics, spatial relationships |
| Camera space | Projection setup, view-dependent effects (fog, DoF) |
| Clip space | Frustum clipping, GPU pipeline handoff |
| NDC | Resolution-independent representation |
| Screen space | Rasterization, pixel output, post-processing |

Trying to do everything in one space would make the math for each step far more complicated. The pipeline of transforms is what makes real-time rendering tractable.

## Transforming Between Spaces

Moving between spaces means applying (or inverting) the appropriate matrix:

- **Object to World:** multiply by the **model matrix** $M$
- **World to Camera:** multiply by the **view matrix** $V$
- **Camera to Clip:** multiply by the **projection matrix** $P$
- **Going backwards:** multiply by the **inverse** matrix (e.g., $M^{-1}$ to go from world back to object space)

An important practical consideration: **normals don't transform the same way as positions**. If a model matrix includes non-uniform scaling, normals must be transformed by the **inverse transpose** of the model matrix:

$$\vec{N}_{\text{world}} = (M^{-1})^T \cdot \vec{N}_{\text{object}}$$

Otherwise normals become skewed and lighting breaks. In GLSL:

```glsl
uniform mat3 normalMatrix; // CPU computes inverse-transpose of upper-left 3x3 of model matrix
vec3 worldNormal = normalize(normalMatrix * aNormal);
```

## Exercises

<details>
<summary>Exercise: Identify the Coordinate Space</summary>

<p>For each calculation below, identify which coordinate space it most naturally occurs in:</p>

<p>1. Computing the distance between two characters for an AI check</p>
<p>2. Sampling a normal map texture and applying it to a surface</p>
<p>3. Determining which pixel a vertex lands on</p>
<p>4. Blending skeletal animation bone influences on a vertex</p>
<p>5. Computing fog that increases with distance from the camera</p>

<p><strong>Solutions:</strong></p>

<p>1. <strong>World space</strong> — both characters need a shared reference frame for distance to be meaningful.</p>
<p>2. <strong>Tangent space</strong> (a sub-type of object space) — normal maps store perturbations relative to the surface's local frame.</p>
<p>3. <strong>Screen space</strong> — pixel positions are the output of the viewport transform.</p>
<p>4. <strong>Object space</strong> — bone transforms are applied before the model matrix places the character in the world.</p>
<p>5. <strong>Camera space</strong> — distance from the camera is simply the $z$ coordinate (or length of position vector) in camera space.</p>
</details>

<details>
<summary>Exercise: Determine Handedness</summary>

<p>A coordinate system defines $+x$ as right, $+y$ as up, and $+z$ as into the screen. Is this left-handed or right-handed?</p>

<p><strong>Solution:</strong></p>

<p>Apply the right-hand rule: point fingers along $+x$ (right), curl toward $+y$ (up). Your thumb points <strong>out of the screen</strong>, which would be $+z$ in a right-handed system.</p>

<p>But this system defines $+z$ as <strong>into</strong> the screen — the opposite direction. Therefore, this is a <strong>left-handed</strong> coordinate system.</p>

<p>This is the convention used by DirectX, Unity, and Unreal Engine.</p>
</details>

<details>
<summary>Exercise: Trace a Vertex Through the Pipeline</summary>

<p>A vertex is at position $(1, 2, 0)$ in object space. The model matrix translates by $(10, 0, 0)$. The camera is at $(10, 0, 5)$ looking toward the origin, with $+y$ as up. Describe the vertex's position in world space and qualitatively in camera space.</p>

<p><strong>Solution:</strong></p>

<p><strong>World space:</strong> The model matrix adds $(10, 0, 0)$, so $P_{\text{world}} = (1 + 10,\; 2 + 0,\; 0 + 0) = (11, 2, 0)$.</p>

<p><strong>Camera space (qualitative):</strong> The camera is at $(10, 0, 5)$ looking toward $(0, 0, 0)$. The camera's forward direction is roughly $(-10, 0, -5)$ normalized. The vertex at $(11, 2, 0)$ is slightly to the right of and above the camera, and in front of it (since the camera looks toward the origin and the vertex is near $x = 11$, close to the camera's $x = 10$). In camera space, it would have a small positive $x$ (slightly right), positive $y$ (above camera), and negative $z$ (in front of the camera, since OpenGL's camera space has $-z$ as forward).</p>
</details>

## Key Takeaways

- A coordinate system is defined by an origin, basis vectors, and a handedness convention
- OpenGL uses a **right-handed** system ($+z$ out of screen); DirectX uses **left-handed** ($+z$ into screen)
- Vertices pass through six spaces: **Object -> World -> Camera -> Clip -> NDC -> Screen**
- Each space exists because it makes a specific computation simpler
- The model, view, and projection matrices transform between the first four spaces
- `gl_Position = projection * view * model * vec4(pos, 1.0)` is the core vertex shader operation
- Normals require the **inverse transpose** of the model matrix, not the model matrix itself
