# Quaternions

If you have worked with 3D rotations using Euler angles, you have likely encountered gimbal lock — that infuriating moment when two rotation axes align and you lose a degree of freedom. Rotation matrices avoid gimbal lock, but interpolating between two rotation matrices produces ugly, non-uniform motion. Quaternions solve both problems elegantly. They are the standard rotation representation in game engines, animation systems, and skeletal rigs, and understanding them is essential for any serious CG work.

## The Problem with Euler Angles

Euler angles represent a 3D rotation as three successive rotations around the coordinate axes — for example, rotate by $\alpha$ around X, then $\beta$ around Y, then $\gamma$ around Z. This is intuitive, but it breaks down in practice.

**Gimbal lock** occurs when one rotation causes two axes to align. For example, if the Y rotation is exactly $90°$, the X and Z rotations now both rotate around the same physical axis. The system effectively collapses from three degrees of freedom to two. This is not a software bug — it is a mathematical property of parameterizing 3D rotations with three angles.

Rotation matrices avoid gimbal lock (they have nine numbers to encode three degrees of freedom), but they are expensive to interpolate. Linearly interpolating the entries of two rotation matrices does not produce a valid rotation matrix — the result is not orthogonal, so the mesh will stretch and skew.

## Quaternion Definition

A quaternion is a four-dimensional number system that extends complex numbers. A quaternion $q$ is written as:

$$q = w + xi + yj + zk$$

where $w, x, y, z$ are real numbers and $i, j, k$ are imaginary units satisfying:

$$i^2 = j^2 = k^2 = ijk = -1$$

We often write a quaternion as a scalar-vector pair:

$$q = (w, \vec{v}) \quad \text{where} \quad \vec{v} = (x, y, z)$$

The scalar part $w$ is sometimes called the "real" part, and $\vec{v}$ is the "imaginary" or "vector" part.

## Unit Quaternions and Rotations

A **unit quaternion** has magnitude 1:

$$|q| = \sqrt{w^2 + x^2 + y^2 + z^2} = 1$$

Unit quaternions represent 3D rotations. A rotation of angle $\theta$ around a unit axis $\hat{n} = (n_x, n_y, n_z)$ is encoded as:

$$q = \left(\cos\frac{\theta}{2},\; \sin\frac{\theta}{2}\,\hat{n}\right)$$

The half-angle $\frac{\theta}{2}$ is not a typo — it is fundamental to why quaternion algebra works for rotations. Notice that $q$ and $-q$ represent the same rotation (negating all four components flips $\theta$ by $360°$, which is equivalent). This "double cover" of rotations is a key property.

**Example:** A $90°$ rotation around the Y-axis:

$$q = \left(\cos 45°,\; \sin 45° \cdot (0, 1, 0)\right) = \left(\frac{\sqrt{2}}{2},\; 0,\; \frac{\sqrt{2}}{2},\; 0\right)$$

## Quaternion Operations

### Conjugate and Inverse

The **conjugate** of a quaternion negates the vector part:

$$q^* = (w, -\vec{v}) = w - xi - yj - zk$$

For a **unit quaternion**, the inverse equals the conjugate:

$$q^{-1} = q^* \quad \text{(when } |q| = 1\text{)}$$

This is extremely convenient — inverting a rotation requires no division, just negating three components.

For a non-unit quaternion, the inverse is:

$$q^{-1} = \frac{q^*}{|q|^2}$$

### Quaternion Multiplication (Hamilton Product)

Quaternion multiplication combines two rotations. Given $q_1 = (w_1, \vec{v}_1)$ and $q_2 = (w_2, \vec{v}_2)$:

$$q_1 q_2 = (w_1 w_2 - \vec{v}_1 \cdot \vec{v}_2,\; w_1 \vec{v}_2 + w_2 \vec{v}_1 + \vec{v}_1 \times \vec{v}_2)$$

In component form:

$$q_1 q_2 = \begin{pmatrix} w_1 w_2 - x_1 x_2 - y_1 y_2 - z_1 z_2 \\ w_1 x_2 + x_1 w_2 + y_1 z_2 - z_1 y_2 \\ w_1 y_2 - x_1 z_2 + y_1 w_2 + z_1 x_2 \\ w_1 z_2 + x_1 y_2 - y_1 x_2 + z_1 w_2 \end{pmatrix}$$

Quaternion multiplication is **associative** but **not commutative**: $q_1 q_2 \neq q_2 q_1$ in general. This matches the fact that 3D rotations do not commute — rotating X then Y is different from rotating Y then X.

**Composing rotations:** To apply rotation $q_1$ followed by rotation $q_2$, multiply $q_2 \cdot q_1$ (right-to-left, just like matrices).

## Rotating a Point

To rotate a 3D point $\vec{p}$ by quaternion $q$, encode the point as a pure quaternion $p = (0, \vec{p})$, then compute the **conjugate sandwich**:

$$p' = q \, p \, q^{-1}$$

The result $p'$ is a pure quaternion whose vector part gives the rotated point. For unit quaternions, $q^{-1} = q^*$, so:

$$p' = q \, p \, q^*$$

This double multiplication ensures the result is a proper rotation (no scaling, no skewing).

## SLERP: Spherical Linear Interpolation

SLERP smoothly interpolates between two rotations $q_0$ and $q_1$ along the shortest arc on the 4D unit sphere:

$$\text{slerp}(q_0, q_1, t) = q_0 \frac{\sin((1-t)\Omega)}{\sin\Omega} + q_1 \frac{\sin(t\Omega)}{\sin\Omega}$$

where $\Omega = \arccos(q_0 \cdot q_1)$ is the angle between the two quaternions (using the 4D dot product).

**Key properties:**
- Constant angular velocity — the rotation speed is uniform across the interpolation
- Shortest path — always takes the shortest arc (if $q_0 \cdot q_1 < 0$, negate one quaternion first)
- $t = 0$ returns $q_0$, $t = 1$ returns $q_1$

When $\Omega$ is very small (quaternions nearly identical), SLERP degenerates numerically. In practice, fall back to normalized linear interpolation (NLERP) when $|\sin\Omega| < \epsilon$:

$$\text{nlerp}(q_0, q_1, t) = \text{normalize}((1-t) q_0 + t \, q_1)$$

NLERP does not have constant angular velocity, but it is much cheaper to compute and visually indistinguishable for small angles.

## Quaternion to Rotation Matrix

A unit quaternion $(w, x, y, z)$ converts to a $3 \times 3$ rotation matrix:

$$M = \begin{pmatrix} 1 - 2(y^2 + z^2) & 2(xy - wz) & 2(xz + wy) \\ 2(xy + wz) & 1 - 2(x^2 + z^2) & 2(yz - wx) \\ 2(xz - wy) & 2(yz + wx) & 1 - 2(x^2 + y^2) \end{pmatrix}$$

This is the formula used by every game engine to convert quaternion bone rotations into the matrix form the GPU expects.

## Rotation Matrix to Quaternion

Given a rotation matrix $M$, extract the quaternion using Shepperd's method. First compute the trace $\text{tr} = M_{00} + M_{11} + M_{22}$:

If $\text{tr} > 0$:

$$w = \frac{1}{2}\sqrt{1 + \text{tr}}, \quad x = \frac{M_{21} - M_{12}}{4w}, \quad y = \frac{M_{02} - M_{20}}{4w}, \quad z = \frac{M_{10} - M_{01}}{4w}$$

When $\text{tr} \leq 0$, find the largest diagonal element and use the corresponding formula to avoid numerical instability from dividing by a near-zero value.

## Why Quaternions Win

| Property | Euler Angles | Matrix (3x3) | Quaternion |
|---|---|---|---|
| Storage | 3 floats | 9 floats | 4 floats |
| Gimbal lock | Yes | No | No |
| Smooth interpolation | Difficult | Difficult | SLERP |
| Composition | Complex | Matrix multiply | Hamilton product |
| Normalization | N/A | Re-orthogonalize (expensive) | Normalize 4 floats |

## Code: Quaternion Operations

```cpp
struct Quat {
    float w, x, y, z;

    // Construct from axis-angle
    static Quat fromAxisAngle(Vec3 axis, float angle) {
        float half = angle * 0.5f;
        float s = sinf(half);
        return { cosf(half), axis.x * s, axis.y * s, axis.z * s };
    }

    Quat conjugate() const { return { w, -x, -y, -z }; }

    float dot(const Quat& b) const {
        return w * b.w + x * b.x + y * b.y + z * b.z;
    }

    Quat operator*(const Quat& b) const {
        return {
            w * b.w - x * b.x - y * b.y - z * b.z,
            w * b.x + x * b.w + y * b.z - z * b.y,
            w * b.y - x * b.z + y * b.w + z * b.x,
            w * b.z + x * b.y - y * b.x + z * b.w
        };
    }

    Quat normalized() const {
        float len = sqrtf(w*w + x*x + y*y + z*z);
        return { w/len, x/len, y/len, z/len };
    }

    Vec3 rotate(Vec3 v) const {
        Quat p = { 0, v.x, v.y, v.z };
        Quat result = (*this) * p * this->conjugate();
        return { result.x, result.y, result.z };
    }
};

Quat slerp(Quat q0, Quat q1, float t) {
    float d = q0.dot(q1);

    // Ensure shortest path
    if (d < 0.0f) {
        q1 = { -q1.w, -q1.x, -q1.y, -q1.z };
        d = -d;
    }

    // Fall back to NLERP for nearly identical quaternions
    if (d > 0.9995f) {
        Quat result = {
            q0.w + t * (q1.w - q0.w),
            q0.x + t * (q1.x - q0.x),
            q0.y + t * (q1.y - q0.y),
            q0.z + t * (q1.z - q0.z)
        };
        return result.normalized();
    }

    float omega = acosf(d);
    float sinOmega = sinf(omega);
    float s0 = sinf((1.0f - t) * omega) / sinOmega;
    float s1 = sinf(t * omega) / sinOmega;

    return {
        s0 * q0.w + s1 * q1.w,
        s0 * q0.x + s1 * q1.x,
        s0 * q0.y + s1 * q1.y,
        s0 * q0.z + s1 * q1.z
    };
}
```

```glsl
// GLSL: quaternion multiply
vec4 qmul(vec4 a, vec4 b) {
    return vec4(
        a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz),
        a.w * b.w - dot(a.xyz, b.xyz)
    );
}

// GLSL: rotate vector by unit quaternion
vec3 qrot(vec4 q, vec3 v) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w * t + cross(q.xyz, t);
}

// GLSL: quaternion to 3x3 rotation matrix
mat3 quatToMat3(vec4 q) {
    float x = q.x, y = q.y, z = q.z, w = q.w;
    return mat3(
        1.0 - 2.0*(y*y + z*z), 2.0*(x*y + w*z),       2.0*(x*z - w*y),
        2.0*(x*y - w*z),       1.0 - 2.0*(x*x + z*z),  2.0*(y*z + w*x),
        2.0*(x*z + w*y),       2.0*(y*z - w*x),         1.0 - 2.0*(x*x + y*y)
    );
}
```

Note that the GLSL `qrot` function uses an optimized form of the conjugate sandwich that avoids constructing the pure quaternion entirely. It is algebraically equivalent to $q p q^*$ but uses only two cross products and some additions.

## Exercises

<details>
<summary>Exercise: Axis-Angle to Quaternion</summary>

<p>Convert a $180°$ rotation around the axis $\hat{n} = (0, 0, 1)$ (the Z-axis) into a quaternion.</p>

<p><strong>Solution:</strong></p>

<p>Using the formula $q = (\cos\frac{\theta}{2}, \sin\frac{\theta}{2}\,\hat{n})$ with $\theta = 180°$:</p>

<p>$\cos(90°) = 0$</p>
<p>$\sin(90°) = 1$</p>

<p>$q = (0,\; 0 \cdot 1,\; 0 \cdot 1,\; 1 \cdot 1) = (0, 0, 0, 1)$</p>

<p>Verify: $|q| = \sqrt{0 + 0 + 0 + 1} = 1$ — it is a unit quaternion. This rotation flips everything $180°$ around Z, so $(1, 0, 0)$ maps to $(-1, 0, 0)$.</p>
</details>

<details>
<summary>Exercise: Compose Two Rotations</summary>

<p>Let $q_1$ represent a $90°$ rotation around the Y-axis, and $q_2$ represent a $90°$ rotation around the X-axis. Compute the combined quaternion for applying $q_1$ first, then $q_2$.</p>

<p><strong>Solution:</strong></p>

<p>First, encode each rotation:</p>

<p>$q_1 = (\cos 45°, 0, \sin 45°, 0) = \left(\frac{\sqrt{2}}{2}, 0, \frac{\sqrt{2}}{2}, 0\right)$</p>

<p>$q_2 = (\cos 45°, \sin 45°, 0, 0) = \left(\frac{\sqrt{2}}{2}, \frac{\sqrt{2}}{2}, 0, 0\right)$</p>

<p>The combined rotation is $q_2 \cdot q_1$ (right-to-left). Using the Hamilton product with $s = \frac{\sqrt{2}}{2} \approx 0.7071$:</p>

<p>$w = s \cdot s - (s)(0) - (0)(s) - (0)(0) = 0.5$</p>
<p>$x = s \cdot 0 + s \cdot s + 0 \cdot 0 - 0 \cdot s = 0.5$</p>
<p>$y = s \cdot s - s \cdot 0 + 0 \cdot s + 0 \cdot 0 = 0.5$</p>
<p>$z = s \cdot 0 + s \cdot 0 - 0 \cdot s + 0 \cdot s = 0$ ... wait, let us be more careful:</p>

<p>$z = w_2 z_1 + x_2 y_1 - y_2 x_1 + z_2 w_1 = s \cdot 0 + s \cdot s - 0 \cdot 0 + 0 \cdot s = 0.5$</p>

<p>So $q_{combined} = (0.5, 0.5, 0.5, 0.5)$, which has $|q| = 1$. This single quaternion encodes the composed rotation — no gimbal lock, no matrix multiplications needed.</p>
</details>

<details>
<summary>Exercise: SLERP Between Two Rotations</summary>

<p>You have two quaternions: $q_0 = (1, 0, 0, 0)$ (identity, no rotation) and $q_1 = (0, 0, 1, 0)$ (a $180°$ rotation around Y). What is $\text{slerp}(q_0, q_1, 0.5)$?</p>

<p><strong>Solution:</strong></p>

<p>First, compute $\Omega = \arccos(q_0 \cdot q_1) = \arccos(1 \cdot 0 + 0 + 0 + 0) = \arccos(0) = 90°$</p>

<p>$\sin\Omega = \sin 90° = 1$</p>

<p>$s_0 = \frac{\sin(0.5 \cdot 90°)}{\sin 90°} = \frac{\sin 45°}{1} = \frac{\sqrt{2}}{2}$</p>

<p>$s_1 = \frac{\sin(0.5 \cdot 90°)}{\sin 90°} = \frac{\sqrt{2}}{2}$</p>

<p>$q_{0.5} = \frac{\sqrt{2}}{2}(1, 0, 0, 0) + \frac{\sqrt{2}}{2}(0, 0, 1, 0) = \left(\frac{\sqrt{2}}{2}, 0, \frac{\sqrt{2}}{2}, 0\right)$</p>

<p>This is exactly a $90°$ rotation around Y — halfway between no rotation and $180°$ around Y, as expected.</p>
</details>

## Key Takeaways

- Quaternions are four-component numbers $q = (w, x, y, z)$ that represent 3D rotations without gimbal lock
- A rotation of angle $\theta$ around axis $\hat{n}$ is encoded as $q = (\cos\frac{\theta}{2}, \sin\frac{\theta}{2}\hat{n})$
- The Hamilton product composes rotations; the conjugate sandwich $qpq^*$ rotates points
- For unit quaternions, the inverse is just the conjugate — negate the vector part
- SLERP interpolates rotations with constant angular velocity along the shortest arc
- Quaternions are the standard in skeletal animation, physics engines, and anywhere smooth rotation blending is needed
- At 4 floats, quaternions are more compact than 3x3 matrices (9 floats) and more robust than Euler angles (3 floats)
