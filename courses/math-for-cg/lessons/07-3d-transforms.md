# 3D Transforms

3D transforms follow the same principles as 2D — scale, rotate, translate — but with an extra dimension that introduces real complexity, especially for rotations. This lesson covers the 4x4 transform matrices, the three axis rotations, Euler angles, gimbal lock, and the axis-angle alternative.

## 4x4 Matrices for 3D

Just as 2D transforms use $3 \times 3$ matrices (2D + homogeneous coordinate), 3D transforms use $4 \times 4$ matrices (3D + homogeneous coordinate). A 3D point $(x, y, z)$ becomes $(x, y, z, 1)$.

The general structure of a 4x4 transform matrix:

$$M = \begin{pmatrix} r_{00} & r_{01} & r_{02} & t_x \\ r_{10} & r_{11} & r_{12} & t_y \\ r_{20} & r_{21} & r_{22} & t_z \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

- **Upper-left 3x3**: rotation and scale
- **Right column** $(t_x, t_y, t_z)$: translation
- **Bottom row** $(0, 0, 0, 1)$: keeps homogeneous coordinates intact (for affine transforms)

## 3D Scale

Scaling along each axis independently:

$$S = \begin{pmatrix} s_x & 0 & 0 & 0 \\ 0 & s_y & 0 & 0 \\ 0 & 0 & s_z & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Uniform scale: $s_x = s_y = s_z$. Non-uniform scale distorts the object and can cause problems with normals — you need the inverse-transpose matrix to transform normals correctly after non-uniform scaling.

## 3D Translation

$$T = \begin{pmatrix} 1 & 0 & 0 & t_x \\ 0 & 1 & 0 & t_y \\ 0 & 0 & 1 & t_z \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Same idea as 2D — the translation sits in the rightmost column and only affects points ($w = 1$), not directions ($w = 0$).

## Rotation About the Principal Axes

In 3D there are three fundamental rotations — one around each coordinate axis. Each one is essentially a 2D rotation in the plane perpendicular to that axis.

### Rotation about X

The X axis stays fixed. $Y$ and $Z$ rotate:

$$R_x(\theta) = \begin{pmatrix} 1 & 0 & 0 & 0 \\ 0 & \cos\theta & -\sin\theta & 0 \\ 0 & \sin\theta & \cos\theta & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Think of it as: looking down the X axis toward the origin, you see the YZ plane, and the rotation happens there.

### Rotation about Y

The Y axis stays fixed. $X$ and $Z$ rotate:

$$R_y(\theta) = \begin{pmatrix} \cos\theta & 0 & \sin\theta & 0 \\ 0 & 1 & 0 & 0 \\ -\sin\theta & 0 & \cos\theta & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Note the **sign swap**: the $-\sin\theta$ is in the bottom-left, not the top-right. This is because the cyclic order of axes is $X \rightarrow Y \rightarrow Z \rightarrow X$. For the Y rotation, the roles of the "sin" entries swap to maintain a consistent right-handed rotation.

### Rotation about Z

The Z axis stays fixed. $X$ and $Y$ rotate:

$$R_z(\theta) = \begin{pmatrix} \cos\theta & -\sin\theta & 0 & 0 \\ \sin\theta & \cos\theta & 0 & 0 \\ 0 & 0 & 1 & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

This is the familiar 2D rotation matrix, extended to 4x4. The Z axis points "out of the screen" in a right-handed coordinate system, so rotating around Z spins things in the XY plane.

### Memory Trick

For each axis rotation, the row and column corresponding to that axis contain the identity (1 on diagonal, 0 elsewhere). The other $2 \times 2$ block is the standard 2D rotation — except for $R_y$, which has the signs swapped.

## Euler Angles

**Euler angles** describe a 3D orientation as three sequential rotations around different axes. The most common convention in games:

- **Yaw** ($\psi$) — rotation around Y (turn left/right)
- **Pitch** ($\phi$) — rotation around X (look up/down)
- **Roll** ($\gamma$) — rotation around Z (tilt head)

The combined rotation:

$$R = R_y(\psi) \cdot R_x(\phi) \cdot R_z(\gamma)$$

Euler angles are intuitive — humans think in terms of "look left, look up, tilt head." Game engines expose them in inspector panels for exactly this reason.

### The Catch

Euler angles have **three serious problems**:

1. **Order dependence**: $R_x \cdot R_y \neq R_y \cdot R_x$. There are 12 different Euler angle conventions depending on which axes you pick and in what order. Mixing them up is a common source of bugs.

2. **Ambiguity**: multiple sets of angles can describe the same orientation. $(180°, 0°, 0°)$ and $(0°, 180°, 180°)$ may produce the same result depending on convention.

3. **Gimbal lock**: the big one.

## Gimbal Lock

Gimbal lock occurs when one rotation aligns two of the three rotation axes, causing a **loss of one degree of freedom**.

### What Happens

Imagine three nested rings (gimbals), each rotating around a different axis: outer = yaw (Y), middle = pitch (X), inner = roll (Z).

When **pitch reaches $\pm 90°$**, the yaw ring and roll ring end up rotating around the **same axis**. You have lost the ability to rotate around one axis independently.

### Concrete Example

With the $YXZ$ convention, set pitch to $90°$:

$$R_x(90°) = \begin{pmatrix} 1 & 0 & 0 & 0 \\ 0 & 0 & -1 & 0 \\ 0 & 1 & 0 & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

Now compute $R_y(\psi) \cdot R_x(90°) \cdot R_z(\gamma)$:

$$= \begin{pmatrix} \cos\psi & 0 & \sin\psi & 0 \\ 0 & 1 & 0 & 0 \\ -\sin\psi & 0 & \cos\psi & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix} \begin{pmatrix} 1 & 0 & 0 & 0 \\ 0 & 0 & -1 & 0 \\ 0 & 1 & 0 & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix} \begin{pmatrix} \cos\gamma & -\sin\gamma & 0 & 0 \\ \sin\gamma & \cos\gamma & 0 & 0 \\ 0 & 0 & 1 & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$$

After multiplication, the result only depends on $(\psi - \gamma)$ — changing yaw and roll independently produces the same effect. Two controls collapsed into one. **One degree of freedom is lost.**

### Why It Matters

- In a flight sim, an airplane pitched straight up cannot yaw vs. roll — the controls "lock"
- Interpolating Euler angles through $90°$ pitch produces erratic motion
- Camera systems using Euler angles glitch when looking straight up/down

This is why production engines use **quaternions** for rotations (covered in a later lesson). Quaternions do not suffer from gimbal lock.

## Axis-Angle Rotation: Rodrigues' Formula

Instead of decomposing into three axis rotations, you can rotate by angle $\theta$ around an **arbitrary unit axis** $\hat{n} = (n_x, n_y, n_z)$.

**Rodrigues' rotation formula** for rotating vector $\vec{v}$:

$$\vec{v'} = \vec{v} \cos\theta + (\hat{n} \times \vec{v}) \sin\theta + \hat{n}(\hat{n} \cdot \vec{v})(1 - \cos\theta)$$

The three terms:
1. $\vec{v} \cos\theta$ — the component that shrinks as $\theta$ grows
2. $(\hat{n} \times \vec{v}) \sin\theta$ — the perpendicular component that drives rotation
3. $\hat{n}(\hat{n} \cdot \vec{v})(1 - \cos\theta)$ — restores the component parallel to the axis

The corresponding $3 \times 3$ rotation matrix (with $c = \cos\theta$, $s = \sin\theta$, $t = 1 - \cos\theta$):

$$R = \begin{pmatrix} t n_x^2 + c & t n_x n_y - s n_z & t n_x n_z + s n_y \\ t n_x n_y + s n_z & t n_y^2 + c & t n_y n_z - s n_x \\ t n_x n_z - s n_y & t n_y n_z + s n_x & t n_z^2 + c \end{pmatrix}$$

When the axis is a principal axis, this collapses back to the simpler $R_x$, $R_y$, or $R_z$.

## Combining Rotations

Rotation composition in 3D follows the same rule: multiply right-to-left. But the non-commutativity is more dramatic.

Example: rotating $90°$ around X, then $90°$ around Y is **not** the same as $90°$ around Y, then $90°$ around X.

$$R_y(90°) \cdot R_x(90°) \neq R_x(90°) \cdot R_y(90°)$$

You can verify: take a book, rotate it $90°$ around one axis, then another, and repeat in the opposite order. The final orientations differ.

## GLSL: Constructing Rotation Matrices

```glsl
// Rotation around an arbitrary axis (Rodrigues)
mat4 rotationMatrix(vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    float t = 1.0 - c;
    vec3 n = normalize(axis);

    return mat4(
        t*n.x*n.x + c,     t*n.x*n.y + s*n.z, t*n.x*n.z - s*n.y, 0.0,
        t*n.x*n.y - s*n.z, t*n.y*n.y + c,     t*n.y*n.z + s*n.x, 0.0,
        t*n.x*n.z + s*n.y, t*n.y*n.z - s*n.x, t*n.z*n.z + c,     0.0,
        0.0,                0.0,                0.0,                1.0
    );
}

// Usage in vertex shader
uniform float u_angle;
uniform vec3 u_axis;

void main() {
    mat4 rot = rotationMatrix(u_axis, u_angle);
    vec4 rotated = rot * vec4(position, 1.0);
    gl_Position = projection * view * model * rotated;
}
```

## C++/GLM Examples

```cpp
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

// Rotation around Y axis
glm::mat4 model = glm::mat4(1.0f);
model = glm::rotate(model, glm::radians(45.0f), glm::vec3(0.0f, 1.0f, 0.0f));

// Arbitrary axis rotation
glm::vec3 axis = glm::normalize(glm::vec3(1.0f, 1.0f, 0.0f));
model = glm::rotate(model, glm::radians(30.0f), axis);

// Full TRS
glm::mat4 transform = glm::mat4(1.0f);
transform = glm::translate(transform, glm::vec3(2.0f, 0.0f, -5.0f));  // T (applied last)
transform = glm::rotate(transform, angle, glm::vec3(0, 1, 0));         // R (applied second)
transform = glm::scale(transform, glm::vec3(0.5f));                    // S (applied first)
```

Note: GLM applies each call by **post-multiplying** — `glm::rotate(M, ...)` computes $M \cdot R$. So the last call in code is applied **first** to the vertex. This matches the TRS convention.

<details>
<summary>Exercise: Apply a rotation matrix to a point</summary>

<p>Rotate the point $(1, 0, 0)$ by $90°$ around the Z axis.</p>

<p>$R_z(90°) = \begin{pmatrix} 0 & -1 & 0 & 0 \\ 1 & 0 & 0 & 0 \\ 0 & 0 & 1 & 0 \\ 0 & 0 & 0 & 1 \end{pmatrix}$</p>

<p>$R_z(90°) \begin{pmatrix} 1 \\ 0 \\ 0 \\ 1 \end{pmatrix} = \begin{pmatrix} 0 \\ 1 \\ 0 \\ 1 \end{pmatrix}$</p>

<p>The point moved from the positive X axis to the positive Y axis — correct for a $90°$ counter-clockwise rotation in the XY plane.</p>
</details>

<details>
<summary>Exercise: Identify the gimbal lock scenario</summary>

<p>You are building a flight simulator with Euler angles (Yaw-Pitch-Roll). A player pitches the plane straight up ($90°$). What happens?</p>

<p>When pitch = $90°$, the plane's nose points straight up. The yaw axis (originally "turn left/right") and the roll axis (originally "tilt wings") now both rotate around the same world axis. The pilot loses independent control of yaw vs. roll — adjusting either one produces the same motion. This is gimbal lock.</p>

<p>To fix it: use quaternions for orientation storage, and only convert to Euler angles for the UI display. Quaternion interpolation (slerp) smoothly passes through any orientation without singularities.</p>
</details>

<details>
<summary>Exercise: Composition order</summary>

<p>You want to place an object at position $(3, 0, -5)$, rotated $45°$ around Y, scaled to half size. Write the correct GLM call order and explain why.</p>

<p>
```cpp
glm::mat4 M = glm::mat4(1.0f);
M = glm::translate(M, glm::vec3(3.0f, 0.0f, -5.0f));
M = glm::rotate(M, glm::radians(45.0f), glm::vec3(0, 1, 0));
M = glm::scale(M, glm::vec3(0.5f));
```
</p>

<p>GLM post-multiplies, so the last call (scale) is applied first to the vertex. Order of application: Scale $\rightarrow$ Rotate $\rightarrow$ Translate. This is TRS — the standard order that keeps scaling in local space and translation in world space.</p>
</details>

## Key Takeaways

- 3D transforms use $4 \times 4$ homogeneous matrices: upper-left $3 \times 3$ for rotation/scale, right column for translation
- There are three fundamental rotation matrices $R_x$, $R_y$, $R_z$ — note the sign swap in $R_y$
- Euler angles (yaw/pitch/roll) are intuitive but suffer from **gimbal lock** at $\pm 90°$ pitch
- Gimbal lock causes loss of one degree of freedom — two axes align and produce identical rotations
- Rodrigues' formula rotates around any arbitrary axis without decomposing into XYZ
- Rotation order matters even more in 3D — always be explicit about your convention
- Production code uses quaternions; Euler angles are mainly for UI display
