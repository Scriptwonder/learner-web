# Camera & View Matrix

In a 3D scene, the **camera** determines what the viewer sees. But here is the fundamental insight: there is no actual camera object in the rendering pipeline. Instead, the **view matrix** transforms every object in the world so that the camera appears to sit at the origin, looking down the negative $z$-axis. Understanding how this matrix is built is essential for controlling the virtual camera in any 3D application.

## What the View Matrix Does

The view matrix converts coordinates from **world space** to **view space** (also called eye space or camera space). After this transform, the camera is at the origin $(0, 0, 0)$, its right direction aligns with $+x$, its up direction aligns with $+y$, and it looks along $-z$.

$$\vec{v}_{\text{view}} = \mathbf{V} \cdot \vec{v}_{\text{world}}$$

The key idea: **the camera never moves**. When you "move the camera to the right," you actually shift the entire world to the left. When you "rotate the camera to look left," you rotate the entire world to the right. The view matrix encodes the inverse of the camera's own transformation.

If the camera has a model matrix $\mathbf{M}_{\text{cam}}$ describing its position and orientation in the world, then:

$$\mathbf{V} = \mathbf{M}_{\text{cam}}^{-1}$$

Computing a general matrix inverse is expensive. The **LookAt** function gives us a cheap, elegant way to construct $\mathbf{V}$ directly.

## The LookAt Function

The LookAt function takes three inputs:

| Parameter | Meaning |
|-----------|---------|
| `eye` | The camera's position in world space |
| `target` | The point the camera looks at |
| `up` | A reference "up" direction (usually $(0, 1, 0)$) |

From these, we derive three mutually perpendicular axes that define the camera's orientation, then combine them with a translation to produce the view matrix.

## Deriving the View Matrix Step by Step

### Step 1: Compute the Forward Vector

The camera looks from `eye` toward `target`. The forward direction is:

$$\vec{f} = \text{target} - \text{eye}$$

$$\hat{f} = \text{normalize}(\vec{f}) = \frac{\vec{f}}{|\vec{f}|}$$

Note: OpenGL convention looks down $-z$, so many implementations negate this to get $\hat{f}$ pointing from the target back toward the eye. We will follow the convention where $\hat{f}$ points from eye to target, and negate it when building the matrix.

### Step 2: Compute the Right Vector

The right axis is perpendicular to both the forward direction and the world up vector. We find it with the cross product:

$$\hat{r} = \text{normalize}(\hat{f} \times \vec{up})$$

The cross product gives a vector perpendicular to both inputs. By crossing forward with up, we get the camera's right direction. We normalize to ensure it is a unit vector.

### Step 3: Compute the True Up Vector

The world up vector we passed in may not be exactly perpendicular to the forward vector (it usually is not). To get the camera's actual up axis, we cross right with forward:

$$\hat{u} = \hat{r} \times \hat{f}$$

This is already unit length because $\hat{r}$ and $\hat{f}$ are both unit vectors and perpendicular, so no normalization is needed.

Now $\hat{r}$, $\hat{u}$, and $\hat{f}$ form an orthonormal basis — three mutually perpendicular unit vectors.

### Step 4: Build the Rotation + Translation Matrix

The view matrix must do two things:

1. **Translate** the world so the camera's position moves to the origin.
2. **Rotate** the world so the camera's axes align with the standard axes.

Translation by $-\text{eye}$:

$$\mathbf{T} = \begin{pmatrix} 1 & 0 & 0 & -e_x \\ 0 & 1 & 0 & -e_y \\ 0 & 0 & 1 & -e_z \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Rotation to align camera axes with world axes. Because rotation matrices are orthogonal, the inverse is the transpose — we place the camera's basis vectors as **rows** (not columns):

$$\mathbf{R} = \begin{pmatrix} r_x & r_y & r_z & 0 \\ u_x & u_y & u_z & 0 \\ -f_x & -f_y & -f_z & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

The forward vector is negated because the camera looks along $-z$ in view space.

## The Full LookAt Matrix

Combining rotation and translation ($\mathbf{V} = \mathbf{R} \cdot \mathbf{T}$):

$$\text{LookAt} = \begin{pmatrix} r_x & r_y & r_z & -(\hat{r} \cdot \text{eye}) \\ u_x & u_y & u_z & -(\hat{u} \cdot \text{eye}) \\ -f_x & -f_y & -f_z & (\hat{f} \cdot \text{eye}) \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

The dot products in the last column come from multiplying the rotation matrix by the translation. They represent the camera position expressed in camera-local coordinates — effectively "how far along each camera axis is the origin from the eye."

## Why the Camera Does Not Move

Consider a scene with a cube at world position $(5, 0, -3)$. If the camera is at $(0, 0, 5)$, applying the view matrix translates the cube to $(5, 0, -8)$ relative to the camera. The cube moved; the camera did not. The GPU only ever draws geometry at the origin-centered camera. This "moving the world" trick is equivalent to an observer-centered coordinate change and is one of the most elegant concepts in real-time graphics.

## GLM and GLSL: Camera Setup

In C++ with GLM, constructing the view matrix is a single call:

```glsl
// GLM (C++ side)
glm::mat4 view = glm::lookAt(
    glm::vec3(0.0f, 0.0f, 5.0f),   // eye position
    glm::vec3(0.0f, 0.0f, 0.0f),   // target (look-at point)
    glm::vec3(0.0f, 1.0f, 0.0f)    // world up
);
```

In the vertex shader, you multiply by the view matrix:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

The multiplication order matters. Reading right to left: model transform first (local to world), then view transform (world to eye), then projection (eye to clip space).

## FPS Camera: Yaw and Pitch

A first-person camera is controlled by mouse movement. The two relevant Euler angles are:

- **Yaw** ($\theta$): rotation around the $y$-axis (looking left/right)
- **Pitch** ($\phi$): rotation around the $x$-axis (looking up/down)

From yaw and pitch, we reconstruct the forward vector:

$$f_x = \cos(\phi) \cdot \sin(\theta)$$

$$f_y = \sin(\phi)$$

$$f_z = -\cos(\phi) \cdot \cos(\theta)$$

(The negative sign on $f_z$ ensures that zero yaw looks toward $-z$, which is the default OpenGL forward direction.)

Then the view matrix is simply:

```glsl
// C++ / GLM
glm::vec3 forward;
forward.x = cos(glm::radians(pitch)) * sin(glm::radians(yaw));
forward.y = sin(glm::radians(pitch));
forward.z = -cos(glm::radians(pitch)) * cos(glm::radians(yaw));
forward = glm::normalize(forward);

glm::vec3 target = eye + forward;
glm::mat4 view = glm::lookAt(eye, target, worldUp);
```

### Clamping Pitch

Pitch should be clamped to the range $(-89^\circ, 89^\circ)$ to prevent the camera from flipping. At exactly $\pm 90^\circ$, the forward vector becomes parallel to the up vector, and the cross product in LookAt degenerates (producing a zero-length right vector). This is related to **gimbal lock**.

### Movement

For WASD movement, you move the `eye` position along the camera's axes:

```glsl
// Forward/backward (along forward, ignoring y for ground movement)
glm::vec3 flatForward = glm::normalize(glm::vec3(forward.x, 0.0, forward.z));
eye += flatForward * speed * deltaTime;  // W key
eye -= flatForward * speed * deltaTime;  // S key

// Strafe left/right
glm::vec3 right = glm::normalize(glm::cross(forward, worldUp));
eye += right * speed * deltaTime;  // D key
eye -= right * speed * deltaTime;  // A key
```

## Exercises

<details>
<summary>Exercise: Construct a LookAt Matrix by Hand</summary>

<p>Given: eye $= (4, 3, 5)$, target $= (0, 0, 0)$, up $= (0, 1, 0)$.</p>

<p>Step 1 — Forward vector:<br/>
$\vec{f} = (0,0,0) - (4,3,5) = (-4, -3, -5)$<br/>
$|\vec{f}| = \sqrt{16+9+25} = \sqrt{50} = 5\sqrt{2}$<br/>
$\hat{f} = (-0.5657, -0.4243, -0.7071)$</p>

<p>Step 2 — Right vector:<br/>
$\hat{r} = \text{normalize}(\hat{f} \times (0,1,0))$<br/>
$\hat{f} \times (0,1,0) = (-0.4243 \cdot 0 - (-0.7071) \cdot 1,\; -0.7071 \cdot 0 - (-0.5657) \cdot 0,\; -0.5657 \cdot 1 - (-0.4243) \cdot 0)$<br/>
$= (0.7071, 0, -0.5657)$<br/>
$|\cdot| = \sqrt{0.5 + 0 + 0.32} = \sqrt{0.82} \approx 0.9056$<br/>
$\hat{r} \approx (0.7809, 0, -0.6247)$</p>

<p>Step 3 — True up: $\hat{u} = \hat{r} \times \hat{f}$</p>

<p>Step 4 — Assemble the matrix with the formula above and compute the dot-product translation terms.</p>
</details>

<details>
<summary>Exercise: FPS Camera Vectors from Yaw and Pitch</summary>

<p>A camera has yaw $= 45°$ and pitch $= 30°$. Compute the forward vector.</p>

<p>$f_x = \cos(30°)\sin(45°) = 0.8660 \times 0.7071 = 0.6124$</p>

<p>$f_y = \sin(30°) = 0.5$</p>

<p>$f_z = -\cos(30°)\cos(45°) = -0.8660 \times 0.7071 = -0.6124$</p>

<p>$\hat{f} = (0.6124, 0.5, -0.6124)$</p>

<p>Verify: $|\hat{f}| = \sqrt{0.375 + 0.25 + 0.375} = \sqrt{1.0} = 1.0$ (unit vector confirmed).</p>
</details>

<details>
<summary>Exercise: Why Does the World Move?</summary>

<p>A camera is at $(0, 0, 5)$ looking at the origin. A vertex is at world position $(2, 1, 0)$. What is the vertex's position in view space?</p>

<p>The view matrix for this camera (looking along $-z$, no rotation) is simply a translation by $(0, 0, -5)$:</p>

<p>$v_{\text{view}} = (2, 1, 0 - 5) = (2, 1, -5)$</p>

<p>The vertex is now 5 units in front of the camera (at $z = -5$ in view space), confirming that the world was shifted rather than the camera.</p>
</details>

## Key Takeaways

- The view matrix transforms world coordinates into camera-relative coordinates, placing the camera at the origin looking down $-z$.
- **LookAt** builds the view matrix from an eye position, target point, and up vector by constructing an orthonormal basis (right, up, forward) and combining rotation with translation.
- The camera does not move in the pipeline — the entire world is transformed inversely.
- For FPS cameras, yaw and pitch angles reconstruct the forward vector, which feeds into LookAt.
- Always clamp pitch to avoid gimbal lock near $\pm 90°$.
- In GLSL, the vertex shader multiplies `projection * view * model * position` — right to left: model, then view, then projection.
