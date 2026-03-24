# Dual Quaternions

In the previous quaternion lesson, we saw how unit quaternions elegantly represent rotations. But skeletal animation requires **rigid transformations** — rotation *and* translation combined. The standard approach is to pack a quaternion and a translation vector separately, but this creates problems when blending transforms for skinning. Dual quaternions unify rotation and translation into a single algebraic object that blends correctly, preventing the infamous "candy wrapper" artifact of linear blend skinning. This lesson develops dual quaternions from first principles and culminates in a production-ready GLSL skinning shader.

## Dual Numbers

Before we can define dual quaternions, we need **dual numbers** — a simple extension of the reals.

A dual number has the form:

$$\hat{a} = a_0 + \varepsilon \, a_1$$

where $a_0$ and $a_1$ are real numbers and $\varepsilon$ is the **dual unit** with the defining property:

$$\varepsilon^2 = 0, \quad \varepsilon \neq 0$$

This is not a contradiction — $\varepsilon$ is an infinitesimal-like quantity whose square vanishes. Dual numbers form a commutative ring, not a field (since $\varepsilon$ has no multiplicative inverse).

### Arithmetic

Addition is component-wise:

$$(a_0 + \varepsilon a_1) + (b_0 + \varepsilon b_1) = (a_0 + b_0) + \varepsilon(a_1 + b_1)$$

Multiplication uses $\varepsilon^2 = 0$:

$$(a_0 + \varepsilon a_1)(b_0 + \varepsilon b_1) = a_0 b_0 + \varepsilon(a_0 b_1 + a_1 b_0)$$

Notice how the $\varepsilon^2 a_1 b_1$ term vanishes. This is the key algebraic property that makes dual numbers useful.

**Numeric example:**

$$(3 + \varepsilon \cdot 2)(4 + \varepsilon \cdot 5) = 12 + \varepsilon(3 \cdot 5 + 2 \cdot 4) = 12 + \varepsilon \cdot 23$$

### Connection to Automatic Differentiation

A function applied to a dual number automatically computes the derivative:

$$f(a_0 + \varepsilon a_1) = f(a_0) + \varepsilon \, a_1 f'(a_0)$$

This is not a coincidence — it is the foundation of forward-mode automatic differentiation. For our purposes, the key takeaway is that $\varepsilon$ encodes "infinitesimal displacement" — exactly what we need to bolt translation onto rotation.

## Dual Quaternion Definition

A **dual quaternion** is a quaternion whose components are dual numbers, or equivalently, a dual number whose components are quaternions:

$$\hat{q} = q_r + \varepsilon \, q_d$$

where $q_r$ (the **real part**) and $q_d$ (the **dual part**) are both ordinary quaternions. A dual quaternion thus has 8 scalar components:

$$\hat{q} = (w_r + x_r i + y_r j + z_r k) + \varepsilon(w_d + x_d i + y_d j + z_d k)$$

### Operations

**Addition:** component-wise on real and dual parts.

$$\hat{q}_1 + \hat{q}_2 = (q_{r1} + q_{r2}) + \varepsilon(q_{d1} + q_{d2})$$

**Multiplication:** using $\varepsilon^2 = 0$ and quaternion multiplication:

$$\hat{q}_1 \hat{q}_2 = q_{r1} q_{r2} + \varepsilon(q_{r1} q_{d2} + q_{d1} q_{r2})$$

Note that quaternion multiplication is non-commutative, so order matters.

**Conjugate:** There are three types of conjugate for dual quaternions. The one used for rigid transformations is:

$$\hat{q}^* = q_r^* + \varepsilon \, q_d^*$$

where $q_r^*$ and $q_d^*$ are the ordinary quaternion conjugates (negate the vector parts).

**Norm:** The dual quaternion norm is:

$$\|\hat{q}\| = \hat{q}^* \hat{q}$$

For a **unit dual quaternion** (representing a rigid transformation):

$$\|q_r\| = 1 \quad \text{and} \quad q_r \cdot q_d = 0$$

where $q_r \cdot q_d$ is the 4D dot product. These two constraints reduce the 8 degrees of freedom to 6, matching the 6 DOF of rigid transformations (3 rotation + 3 translation).

## Encoding Rigid Transformations

A rigid transformation consists of a rotation $r$ (unit quaternion) and a translation $\vec{t} = (t_x, t_y, t_z)$. The corresponding unit dual quaternion is:

$$\hat{q} = r + \varepsilon \frac{1}{2} t \, r$$

where $t = (0, t_x, t_y, t_z)$ is the translation encoded as a pure quaternion.

### Derivation

The dual quaternion encodes the transformation "rotate by $r$, then translate by $\vec{t}$." A pure translation $\vec{t}$ is encoded as the dual quaternion:

$$\hat{t} = 1 + \varepsilon \frac{1}{2} t$$

A pure rotation $r$ is encoded as:

$$\hat{r} = r + \varepsilon \cdot 0$$

The combined rigid transformation is their product:

$$\hat{q} = \hat{t} \, \hat{r} = (1 + \varepsilon \frac{1}{2} t)(r + \varepsilon \cdot 0) = r + \varepsilon \frac{1}{2} t \, r$$

The $\varepsilon^2$ term vanishes, giving us the formula above.

### Extracting Rotation and Translation

Given a unit dual quaternion $\hat{q} = q_r + \varepsilon \, q_d$:

**Rotation:** The real part $q_r$ is directly the rotation quaternion.

**Translation:** Recover $\vec{t}$ from:

$$t = 2 \, q_d \, q_r^*$$

The vector part of the resulting pure quaternion gives $(t_x, t_y, t_z)$.

### Worked Example

**Problem:** Encode a $90°$ rotation around the Y-axis followed by a translation of $\vec{t} = (3, 0, 5)$.

**Step 1:** Rotation quaternion for $90°$ around Y:

$$r = \left(\cos 45°,\; 0,\; \sin 45°,\; 0\right) = \left(\frac{\sqrt{2}}{2},\; 0,\; \frac{\sqrt{2}}{2},\; 0\right) \approx (0.7071, 0, 0.7071, 0)$$

**Step 2:** Translation as pure quaternion:

$$t = (0,\; 3,\; 0,\; 5)$$

**Step 3:** Compute $\frac{1}{2} t \, r$:

$$\frac{1}{2} t = (0,\; 1.5,\; 0,\; 2.5)$$

Multiply $(0, 1.5, 0, 2.5) \times (0.7071, 0, 0.7071, 0)$ using the Hamilton product:

$$w = 0 \cdot 0.7071 - (1.5 \cdot 0 + 0 \cdot 0.7071 + 2.5 \cdot 0) = 0 - 0 = 0$$

Wait — let us use the full formula. With $q_1 = (w_1, x_1, y_1, z_1) = (0, 1.5, 0, 2.5)$ and $q_2 = (w_2, x_2, y_2, z_2) = (0.7071, 0, 0.7071, 0)$:

$$w = w_1 w_2 - x_1 x_2 - y_1 y_2 - z_1 z_2 = 0 \cdot 0.7071 - 1.5 \cdot 0 - 0 \cdot 0.7071 - 2.5 \cdot 0 = 0$$

$$x = w_1 x_2 + x_1 w_2 + y_1 z_2 - z_1 y_2 = 0 + 1.5 \cdot 0.7071 + 0 - 2.5 \cdot 0.7071 = -0.7071$$

$$y = w_1 y_2 - x_1 z_2 + y_1 w_2 + z_1 x_2 = 0 - 0 + 0 + 0 = 0$$

$$z = w_1 z_2 + x_1 y_2 - y_1 x_2 + z_1 w_2 = 0 + 1.5 \cdot 0.7071 - 0 + 2.5 \cdot 0.7071 = 2.8284$$

So $q_d = (0, -0.7071, 0, 2.8284)$.

**Result:**

$$\hat{q} = \underbrace{(0.7071, 0, 0.7071, 0)}_{q_r} + \varepsilon \underbrace{(0, -0.7071, 0, 2.8284)}_{q_d}$$

**Verify** by recovering translation: $t = 2 q_d q_r^* = 2 (0, -0.7071, 0, 2.8284)(0.7071, 0, -0.7071, 0)$:

$$w = 2[0 \cdot 0.7071 - ((-0.7071)(0) + 0 \cdot (-0.7071) + 2.8284 \cdot 0)] = 0$$

$$x = 2[0 \cdot 0 + (-0.7071)(0.7071) + 0 \cdot 0 - 2.8284(-0.7071)] = 2[-0.5 + 2.0] = 3.0$$

$$y = 2[0(-0.7071) - (-0.7071)(0) + 0 \cdot 0.7071 + 2.8284 \cdot 0] = 0$$

$$z = 2[0 \cdot 0 + (-0.7071)(-0.7071) - 0 \cdot 0 + 2.8284 \cdot 0.7071] = 2[0.5 + 2.0] = 5.0$$

Translation recovered: $\vec{t} = (3, 0, 5)$. Correct.

## Conversion to/from 4x4 Matrix

### Dual Quaternion to Matrix

Given unit dual quaternion $\hat{q} = q_r + \varepsilon \, q_d$ with $q_r = (w, x, y, z)$:

**Rotation** (upper-left $3\times3$) — same as ordinary quaternion-to-matrix:

$$R = \begin{pmatrix} 1 - 2(y^2 + z^2) & 2(xy - wz) & 2(xz + wy) \\ 2(xy + wz) & 1 - 2(x^2 + z^2) & 2(yz - wx) \\ 2(xz - wy) & 2(yz + wx) & 1 - 2(x^2 + y^2) \end{pmatrix}$$

**Translation** (right column) — extract via $\vec{t} = 2 \, q_d \, q_r^*$, taking the vector part.

The full $4\times4$ homogeneous matrix:

$$M = \begin{pmatrix} R & \vec{t} \\ 0 \; 0 \; 0 & 1 \end{pmatrix}$$

### Matrix to Dual Quaternion

1. Extract the rotation quaternion $q_r$ from the upper-left $3\times3$ using Shepperd's method (see Lesson 16).
2. Extract the translation vector $\vec{t} = (M_{03}, M_{13}, M_{23})$.
3. Compute the dual part: $q_d = \frac{1}{2} t \, q_r$ where $t = (0, t_x, t_y, t_z)$.

## The Candy Wrapper Problem: LBS vs. DLB

### Linear Blend Skinning (LBS)

In standard skeletal animation, each vertex is influenced by multiple bones. **Linear blend skinning** computes the vertex position as a weighted sum of bone transformations applied to the rest pose:

$$\vec{v}' = \sum_{i=1}^{n} w_i \, M_i \, \vec{v}$$

where $w_i$ are the blend weights (summing to 1) and $M_i$ are the $4\times4$ bone transformation matrices.

**The problem:** linearly blending $4\times4$ matrices does not produce a valid rigid transformation. The blended matrix can contain scaling and shear. When two bones rotate in opposite directions (e.g., twisting a forearm $180°$), the blended matrix collapses the mesh to a line — the **candy wrapper artifact**.

```
LBS candy wrapper artifact:

Bone A rotates +90°    Bone B rotates -90°
    ╱╲                      ╱╲
   ╱  ╲                    ╱  ╲
  ╱    ╲                  ╱    ╲
 ╱      ╲ ──────────── ╱      ╲
          ↑ blended region collapses
          (volume → 0, mesh pinches)
```

### Why LBS Fails (Mathematically)

Consider two rotation matrices $R_1$ (rotate $+90°$ around X) and $R_2$ (rotate $-90°$ around X), blended with equal weights:

$$M_{\text{blend}} = 0.5 R_1 + 0.5 R_2$$

Since the rotations are opposite, many terms cancel. The $y$ and $z$ rows of the blended matrix shrink toward zero — the determinant approaches 0, meaning the mesh collapses. The blend of two valid rotations is not a valid rotation.

### Dual Quaternion Linear Blending (DLB)

**DLB** replaces matrix blending with dual quaternion blending:

$$\hat{q}_{\text{blend}} = \frac{\sum_{i=1}^{n} w_i \, \hat{q}_i}{\left\|\sum_{i=1}^{n} w_i \, \hat{q}_i\right\|}$$

The weighted sum of dual quaternions is normalized to produce a valid unit dual quaternion. This is the core insight of Kavan et al. (2007, 2008): the space of unit dual quaternions is a smooth manifold, and normalizing the linear combination projects back onto that manifold while preserving the "average" transformation.

### Why DLB Prevents Volume Loss

The key mathematical reason DLB avoids the candy wrapper:

1. **Quaternion antipodality:** Before blending, we ensure all $q_{ri}$ are in the same hemisphere (if $q_{r0} \cdot q_{ri} < 0$, negate $\hat{q}_i$). This prevents catastrophic cancellation.

2. **Normalization preserves rigidity:** After linear blending, the result $\hat{q}_{\text{blend}}$ is generally not a unit dual quaternion. But normalization maps it back to the constraint surface $\|q_r\| = 1$, $q_r \cdot q_d = 0$. The resulting transformation is a valid rigid motion — no scaling, no shear, no volume loss.

3. **Geometric interpretation:** Linear blending of unit quaternions produces a quaternion inside the unit sphere. Normalization projects it back to the surface. For small angular differences, this is very close to SLERP. Even for large differences (after hemisphere correction), the projected result remains a reasonable rotation — it never collapses to zero.

**Numeric demonstration:** Blend $+90°$ and $-90°$ around X with equal weights.

$$q_1 = (\cos 45°, \sin 45°, 0, 0) = (0.7071, 0.7071, 0, 0)$$
$$q_2 = (\cos(-45°), \sin(-45°), 0, 0) = (0.7071, -0.7071, 0, 0)$$

LBS would blend the matrices and get collapse. DLB blends the quaternions:

$$q_{\text{blend}} = 0.5(0.7071, 0.7071, 0, 0) + 0.5(0.7071, -0.7071, 0, 0) = (0.7071, 0, 0, 0)$$

Normalize: $\|(0.7071, 0, 0, 0)\| = 0.7071$, so $q_{\text{normalized}} = (1, 0, 0, 0)$ — the identity rotation. The mesh stays at rest pose, fully intact. No collapse, no volume loss.

## ScLERP (Screw Linear Interpolation)

**ScLERP** is the dual quaternion analog of SLERP. While SLERP interpolates pure rotations along the shortest arc on $S^3$, ScLERP interpolates rigid transformations along a **screw motion** — simultaneous rotation and translation along a single axis (Chasles' theorem states that any rigid motion can be expressed as a screw motion).

Given two unit dual quaternions $\hat{q}_1$ and $\hat{q}_2$, ScLERP at parameter $t$ is:

$$\text{ScLERP}(\hat{q}_1, \hat{q}_2, t) = \hat{q}_1 \left(\hat{q}_1^* \hat{q}_2\right)^t$$

Computing $\hat{q}^t$ requires the dual quaternion exponential/logarithm, which decomposes the transformation into its screw parameters (axis, angle, pitch, moment) and scales them by $t$.

**Properties:**
- Constant-speed interpolation along the screw axis
- Shortest path in the rigid transformation space $SE(3)$
- Reduces to SLERP when translation is zero
- Bi-invariant: result is independent of coordinate frame choice

In practice, DLB (linear blend + normalize) is used far more often than ScLERP for skinning, because:
1. DLB handles $n > 2$ influences directly; ScLERP is inherently pairwise
2. DLB is much cheaper to compute
3. The visual difference is negligible for typical bone configurations (Kavan et al. 2008 showed DLB and ScLERP produce nearly identical results for blending angles under $180°$)

ScLERP remains useful for keyframe interpolation between two specific poses.

## Normalization

A dual quaternion $\hat{q} = q_r + \varepsilon q_d$ is normalized to unit length as follows:

**Step 1:** Normalize the real part:

$$q_r' = \frac{q_r}{\|q_r\|}$$

**Step 2:** Enforce orthogonality $q_r' \cdot q_d' = 0$:

$$q_d' = \frac{q_d}{\|q_r\|} - q_r' \frac{q_r \cdot q_d}{\|q_r\|^2}$$

For skinning, a simplified normalization is typically sufficient — just divide both parts by $\|q_r\|$:

$$q_r' = \frac{q_r}{\|q_r\|}, \quad q_d' = \frac{q_d}{\|q_r\|}$$

This works because the input dual quaternions are already unit (from bone transforms), and the linear blend only slightly de-normalizes them. The orthogonality correction is negligible for well-posed skinning weights.

## Practical GLSL Skinning Shader

Here is a complete vertex shader implementing dual quaternion skinning, based on the approach described in Kavan et al. (2008):

```glsl
#version 330 core

// Per-vertex attributes
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_texcoord;
layout(location = 3) in ivec4 a_boneIndices;   // up to 4 bone influences
layout(location = 4) in vec4  a_boneWeights;    // corresponding weights

// Bone dual quaternions: each bone has real part [0] and dual part [1]
// Stored as 2 vec4s per bone: (x, y, z, w) quaternion layout
uniform mat2x4 u_boneDQ[128];  // mat2x4 = 2 rows of 4 floats = 8 floats

uniform mat4 u_viewProjection;

out vec3 v_normal;
out vec2 v_texcoord;

// Dual quaternion blending with antipodality correction
mat2x4 blendDualQuaternions() {
    // Start with first bone's dual quaternion
    mat2x4 dq0 = u_boneDQ[a_boneIndices.x];
    mat2x4 blended = a_boneWeights.x * dq0;

    // Blend remaining bones, correcting for antipodality
    for (int i = 1; i < 4; i++) {
        int idx;
        float w;
        if (i == 1)      { idx = a_boneIndices.y; w = a_boneWeights.y; }
        else if (i == 2)  { idx = a_boneIndices.z; w = a_boneWeights.z; }
        else              { idx = a_boneIndices.w; w = a_boneWeights.w; }

        mat2x4 dqi = u_boneDQ[idx];

        // Antipodality: if real parts point in opposite directions, negate
        float sign = sign(dot(dq0[0], dqi[0]));
        if (sign < 0.0) sign = -1.0; else sign = 1.0;

        blended += w * sign * dqi;
    }

    return blended;
}

// Transform position by unit dual quaternion
vec3 dqTransformPoint(mat2x4 dq, vec3 p) {
    vec4 qr = dq[0];  // real part (rotation)
    vec4 qd = dq[1];  // dual part (translation encoded)

    // Rotate point by quaternion (optimized formula)
    vec3 t = 2.0 * cross(qr.xyz, p);
    vec3 rotated = p + qr.w * t + cross(qr.xyz, t);

    // Extract translation: t = 2 * qd * conjugate(qr)
    vec3 trans = 2.0 * (qr.w * qd.xyz - qd.w * qr.xyz + cross(qr.xyz, qd.xyz));

    return rotated + trans;
}

// Transform normal (rotation only — normals ignore translation)
vec3 dqTransformNormal(mat2x4 dq, vec3 n) {
    vec4 qr = dq[0];
    vec3 t = 2.0 * cross(qr.xyz, n);
    return n + qr.w * t + cross(qr.xyz, t);
}

void main() {
    // Blend dual quaternions from influencing bones
    mat2x4 blended = blendDualQuaternions();

    // Normalize: divide both parts by length of real part
    float len = length(blended[0]);
    blended[0] /= len;
    blended[1] /= len;

    // Transform vertex
    vec3 worldPos = dqTransformPoint(blended, a_position);
    v_normal = normalize(dqTransformNormal(blended, a_normal));
    v_texcoord = a_texcoord;

    gl_Position = u_viewProjection * vec4(worldPos, 1.0);
}
```

### CPU Side: Converting Bone Matrices to Dual Quaternions

```python
import numpy as np
from scipy.spatial.transform import Rotation

def matrix_to_dual_quaternion(M):
    """Convert a 4x4 rigid transformation matrix to a dual quaternion.

    Returns (qr, qd) where each is a 4-element array [x, y, z, w].
    """
    # Extract rotation as quaternion (scipy uses [x, y, z, w] order)
    R = M[:3, :3]
    rot = Rotation.from_matrix(R)
    qr = rot.as_quat()  # [x, y, z, w]

    # Extract translation
    t = M[:3, 3]

    # Compute dual part: qd = 0.5 * t_quat * qr
    # t as pure quaternion: [tx, ty, tz, 0]
    t_quat = np.array([t[0], t[1], t[2], 0.0])

    # Hamilton product: t_quat * qr
    def qmul(a, b):
        return np.array([
            a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
            a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
            a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
            a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
        ])

    qd = 0.5 * qmul(t_quat, qr)

    return qr, qd

# Example: 90° around Y, translate (3, 0, 5)
M = np.eye(4)
angle = np.radians(90)
M[:3, :3] = Rotation.from_rotvec([0, angle, 0]).as_matrix()
M[:3, 3] = [3, 0, 5]

qr, qd = matrix_to_dual_quaternion(M)
print(f"Real part: {qr}")  # [0, 0.7071, 0, 0.7071]
print(f"Dual part: {qd}")  # [-0.7071, 0, 2.8284, 0] (approx)
```

## Comparison: LBS vs. DLB

| Property | LBS (Linear Blend Skinning) | DLB (Dual Quaternion Blending) |
|---|---|---|
| Representation | 4x4 matrices (12 floats each) | Dual quaternions (8 floats each) |
| Blending | Linear matrix blend | Linear DQ blend + normalize |
| Volume preservation | No — candy wrapper, collapse | Yes — rigid result guaranteed |
| Cost | Matrix-vector multiply | Slightly more ALU, less bandwidth |
| Joint artifacts | Collapse at ~180° twist | Slight bulging at extreme angles |
| GPU bandwidth | 48 bytes/bone (mat3x4) | 32 bytes/bone (2x vec4) |
| Industry adoption | Legacy default | Unreal Engine, Unity, many AAA titles |

DLB's main artifact is a slight **bulging** at joints with extreme bending angles, where the normalized average rotation overshoots slightly. This is far less objectionable than LBS collapse and can be mitigated by adjusting blend weights or using optimized blending schemes (Kavan et al. 2008 "approximate dual quaternion blending").

## References

- **Kavan, L., Collins, S., Zara, J., O'Sullivan, C.** "Skinning with Dual Quaternions." *Proc. I3D*, 2007. — Introduced DLB for skeletal animation.
- **Kavan, L., Collins, S., Zara, J., O'Sullivan, C.** "Geometric Skinning with Approximate Dual Quaternion Blending." *ACM Transactions on Graphics* 27(4), 2008. — The definitive reference, with optimized GPU implementation and analysis of DLB vs. ScLERP.
- **Kenwright, B.** "Dual-Quaternion Interpolation." *arXiv:2303.13395*, 2023. — Comprehensive survey of dual quaternion interpolation methods including ScLERP variants.

## Exercises

<details>
<summary>Exercise: Dual Number Multiplication</summary>

<p>Compute $(2 + \varepsilon \cdot 7)(5 + \varepsilon \cdot 3)$ using dual number arithmetic.</p>

<p><strong>Solution:</strong></p>

<p>$(2 + \varepsilon \cdot 7)(5 + \varepsilon \cdot 3) = 2 \cdot 5 + \varepsilon(2 \cdot 3 + 7 \cdot 5) + \varepsilon^2(7 \cdot 3)$</p>

<p>Since $\varepsilon^2 = 0$:</p>

<p>$= 10 + \varepsilon(6 + 35) = 10 + 41\varepsilon$</p>
</details>

<details>
<summary>Exercise: Build a Dual Quaternion from Scratch</summary>

<p>Encode a pure translation of $\vec{t} = (4, -2, 0)$ (no rotation) as a dual quaternion. What are $q_r$ and $q_d$?</p>

<p><strong>Solution:</strong></p>

<p>For no rotation, $r = (1, 0, 0, 0)$ (identity quaternion).</p>

<p>Translation as pure quaternion: $t = (0, 4, -2, 0)$.</p>

<p>$q_d = \frac{1}{2} t \cdot r = \frac{1}{2}(0, 4, -2, 0)(1, 0, 0, 0)$</p>

<p>The Hamilton product of any quaternion with identity is itself:</p>

<p>$q_d = \frac{1}{2}(0, 4, -2, 0) = (0, 2, -1, 0)$</p>

<p>Result: $\hat{q} = (1, 0, 0, 0) + \varepsilon(0, 2, -1, 0)$</p>

<p>Verify: $t = 2 q_d q_r^* = 2(0, 2, -1, 0)(1, 0, 0, 0) = (0, 4, -2, 0)$, giving $\vec{t} = (4, -2, 0)$. Correct.</p>
</details>

<details>
<summary>Exercise: DLB vs. LBS at 180° Twist</summary>

<p>Two bones influence a vertex equally ($w_1 = w_2 = 0.5$). Bone 1 rotates $+90°$ around Z, bone 2 rotates $-90°$ around Z. Both have zero translation. Show that LBS produces a degenerate result while DLB gives the identity.</p>

<p><strong>Solution:</strong></p>

<p><strong>LBS:</strong> The rotation matrices are:</p>

<p>$R_1 = \begin{pmatrix} 0 & -1 & 0 \\ 1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix}, \quad R_2 = \begin{pmatrix} 0 & 1 & 0 \\ -1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix}$</p>

<p>$R_{\text{blend}} = 0.5 R_1 + 0.5 R_2 = \begin{pmatrix} 0 & 0 & 0 \\ 0 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix}$</p>

<p>This matrix has $\det = 0$ — it projects all geometry onto the Z-axis. The mesh collapses to a line (candy wrapper).</p>

<p><strong>DLB:</strong> The quaternions are:</p>

<p>$q_1 = (\cos 45°, 0, 0, \sin 45°) = (0.7071, 0, 0, 0.7071)$</p>
<p>$q_2 = (\cos(-45°), 0, 0, \sin(-45°)) = (0.7071, 0, 0, -0.7071)$</p>

<p>$q_{\text{blend}} = 0.5(0.7071, 0, 0, 0.7071) + 0.5(0.7071, 0, 0, -0.7071) = (0.7071, 0, 0, 0)$</p>

<p>Normalize: $q_{\text{norm}} = (1, 0, 0, 0)$ — the identity. The vertex stays at rest pose, fully intact.</p>
</details>

## Key Takeaways

- **Dual numbers** ($a + \varepsilon b$ with $\varepsilon^2 = 0$) extend reals with an infinitesimal unit; dual quaternions extend quaternions the same way, giving 8 components
- A **unit dual quaternion** $\hat{q} = r + \varepsilon \frac{1}{2} t r$ encodes a complete rigid transformation (rotation $r$ + translation $\vec{t}$) in a single algebraic object
- **DLB** (weighted sum + normalize) produces valid rigid transformations, preventing the candy wrapper collapse of linear blend skinning
- The **antipodality correction** (ensuring all $q_r$ are in the same hemisphere) is essential — without it, blending opposite quaternions cancels catastrophically
- **ScLERP** interpolates along screw motions at constant speed but is rarely used for skinning; DLB is preferred for its simplicity and multi-bone support
- Dual quaternions use **32 bytes per bone** vs. 48 for mat3x4, reducing GPU bandwidth — a meaningful optimization for characters with 100+ bones
- Converting between dual quaternions and matrices is straightforward: the real part gives rotation, and $\vec{t} = 2 q_d q_r^*$ gives translation
