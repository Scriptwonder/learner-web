# Rigid Body Dynamics

A **rigid body** is an idealized solid where the distance between any two points remains constant. Unlike particles, rigid bodies can rotate, requiring us to track orientation, angular velocity, and inertia — making the math significantly richer.

## Center of Mass

The center of mass (CoM) is the mass-weighted average position of all particles in a body:

$$\mathbf{r}_{cm} = \frac{1}{M} \int \mathbf{r} \, dm = \frac{1}{M} \int \rho(\mathbf{r}) \, \mathbf{r} \, dV$$

where $M = \int dm$ is the total mass. For a uniform-density body, this simplifies to the geometric centroid. In simulation, we treat the CoM as the body's position — all forces effectively act through it for translational motion.

## Inertia Tensor

The inertia tensor $\mathbf{I}$ is a $3 \times 3$ symmetric matrix that describes how mass is distributed relative to the rotation axes:

$$I_{ij} = \int \rho(\mathbf{r}) \left( |\mathbf{r}|^2 \delta_{ij} - r_i r_j \right) dV$$

In matrix form:

$$\mathbf{I} = \begin{pmatrix} I_{xx} & -I_{xy} & -I_{xz} \\ -I_{yx} & I_{yy} & -I_{yz} \\ -I_{zx} & -I_{zy} & I_{zz} \end{pmatrix}$$

where, for example:

$$I_{xx} = \int \rho(y^2 + z^2) \, dV, \quad I_{xy} = \int \rho \, xy \, dV$$

### Derivation for Common Shapes

**Solid Box** (dimensions $w \times h \times d$, mass $M$):

$$\mathbf{I}_{box} = \frac{M}{12} \begin{pmatrix} h^2 + d^2 & 0 & 0 \\ 0 & w^2 + d^2 & 0 \\ 0 & 0 & w^2 + h^2 \end{pmatrix}$$

*Derivation:* For a uniform box centered at origin with $-w/2 \leq x \leq w/2$:

$$I_{xx} = \frac{M}{whd} \int_{-d/2}^{d/2}\int_{-h/2}^{h/2}\int_{-w/2}^{w/2} (y^2 + z^2) \, dx\,dy\,dz = \frac{M}{12}(h^2 + d^2)$$

**Solid Sphere** (radius $R$, mass $M$):

$$\mathbf{I}_{sphere} = \frac{2}{5}MR^2 \, \mathbf{I}_3$$

*Derivation:* By symmetry all diagonal terms are equal. Using spherical coordinates:

$$I_{xx} = \frac{M}{\frac{4}{3}\pi R^3} \int_0^R \int_0^\pi \int_0^{2\pi} (r^2\sin^2\phi)(r^2 \sin\phi) \, d\theta \, d\phi \, dr = \frac{2}{5}MR^2$$

The off-diagonal terms vanish for axes aligned with principal axes. The inertia tensor rotates with the body:

$$\mathbf{I}_{world} = \mathbf{R} \, \mathbf{I}_{body} \, \mathbf{R}^T$$

where $\mathbf{R}$ is the body's rotation matrix.

## Newton-Euler Equations of Motion

### Translational Motion

Newton's second law for the center of mass:

$$\mathbf{F} = M \mathbf{a}_{cm} = M \frac{d\mathbf{v}}{dt}$$

Or equivalently in terms of linear momentum $\mathbf{p} = M\mathbf{v}$:

$$\frac{d\mathbf{p}}{dt} = \mathbf{F}$$

### Rotational Motion

Euler's equation relates torque to angular acceleration:

$$\boldsymbol{\tau} = \mathbf{I} \boldsymbol{\alpha} + \boldsymbol{\omega} \times (\mathbf{I} \boldsymbol{\omega})$$

where $\boldsymbol{\omega}$ is angular velocity, $\boldsymbol{\alpha} = d\boldsymbol{\omega}/dt$ is angular acceleration, and the $\boldsymbol{\omega} \times (\mathbf{I}\boldsymbol{\omega})$ term accounts for the gyroscopic effect (the inertia tensor changes in world space as the body rotates).

In terms of angular momentum $\mathbf{L} = \mathbf{I}\boldsymbol{\omega}$:

$$\frac{d\mathbf{L}}{dt} = \boldsymbol{\tau}$$

Solving for angular acceleration:

$$\boldsymbol{\alpha} = \mathbf{I}^{-1}\left(\boldsymbol{\tau} - \boldsymbol{\omega} \times (\mathbf{I}\boldsymbol{\omega})\right)$$

## Angular Velocity and Quaternion Integration

### Why Quaternions?

Rotation matrices have 9 components with 6 constraints (orthonormality), and Euler angles suffer from gimbal lock. **Unit quaternions** $q = (w, x, y, z)$ with $|q| = 1$ represent rotations with only 4 components and 1 constraint, and interpolate smoothly.

### Quaternion Time Derivative

Given angular velocity $\boldsymbol{\omega} = (\omega_x, \omega_y, \omega_z)$, the quaternion derivative is:

$$\frac{dq}{dt} = \frac{1}{2} \boldsymbol{\omega} \otimes q$$

where $\boldsymbol{\omega}$ is treated as a pure quaternion $(0, \omega_x, \omega_y, \omega_z)$ and $\otimes$ is quaternion multiplication.

### Integration Step

Using symplectic Euler for the full rigid body state:

```python
import numpy as np

def quat_multiply(q1, q2):
    """Hamilton product of two quaternions [w, x, y, z]."""
    w1, x1, y1, z1 = q1
    w2, x2, y2, z2 = q2
    return np.array([
        w1*w2 - x1*x2 - y1*y2 - z1*z2,
        w1*x2 + x1*w2 + y1*z2 - z1*y2,
        w1*y2 - x1*z2 + y1*w2 + z1*x2,
        w1*z2 + x1*y2 - y1*x2 + z1*w2
    ])

def integrate_rigid_body(pos, vel, quat, omega, force, torque,
                         mass, I_body_inv, dt):
    """One symplectic Euler step for a rigid body."""
    # Translational
    vel_new = vel + dt * force / mass
    pos_new = pos + dt * vel_new

    # Rotational — compute world-space inverse inertia
    R = quat_to_matrix(quat)
    I_inv_world = R @ I_body_inv @ R.T
    I_world = np.linalg.inv(I_inv_world)

    # Euler's equation: alpha = I_inv * (tau - omega x (I * omega))
    alpha = I_inv_world @ (torque - np.cross(omega, I_world @ omega))
    omega_new = omega + dt * alpha

    # Quaternion integration
    omega_quat = np.array([0, *omega_new])
    dq = 0.5 * quat_multiply(omega_quat, quat)
    quat_new = quat + dt * dq
    quat_new /= np.linalg.norm(quat_new)  # re-normalize

    return pos_new, vel_new, quat_new, omega_new
```

## Collision Detection

Collision detection is typically split into two phases for performance.

### Broad Phase: Sweep-and-Prune

The goal is to quickly reject pairs that **cannot** be colliding. **Sweep-and-Prune** (SAP) projects each body's axis-aligned bounding box (AABB) onto each axis and sorts the interval endpoints.

Algorithm:
1. For each axis, maintain a sorted list of AABB min/max endpoints
2. Sweep through the list; when you encounter a "begin" marker, add the body to the active set
3. When you encounter an "end" marker, remove it from the active set
4. Two bodies potentially overlap if they overlap on **all three** axes

Temporal coherence makes this $O(n)$ amortized per frame since the lists change little between frames. This is the approach used by Bullet Physics and Jolt Physics (Rouwe, 2022).

### Narrow Phase: GJK Algorithm

The **Gilbert-Johnson-Keerthi** (GJK) algorithm determines whether two convex shapes overlap by computing the distance between them using their **Minkowski difference**.

**Key concept:** Two convex shapes $A$ and $B$ overlap if and only if their Minkowski difference $A \ominus B = \{a - b \mid a \in A, b \in B\}$ contains the origin.

GJK iteratively builds a **simplex** (point, line, triangle, tetrahedron) on the boundary of $A \ominus B$ that approaches the origin:

1. Pick an initial direction $\mathbf{d}$
2. Compute support point: $s = \text{support}_A(\mathbf{d}) - \text{support}_B(-\mathbf{d})$
3. If $s \cdot \mathbf{d} < 0$, no collision (origin is unreachable)
4. Add $s$ to the simplex, update $\mathbf{d}$ toward the origin
5. If the simplex encloses the origin, **collision detected**

The **support function** returns the point on a shape farthest in a given direction — it is the only shape-specific function needed, making GJK work for any convex shape.

### EPA: Contact Points

When GJK confirms overlap, the **Expanding Polytope Algorithm** (EPA) finds the **penetration depth** and **contact normal**. It takes GJK's final simplex and iteratively expands it toward the boundary of the Minkowski difference, finding the closest face to the origin. The normal of that face is the contact normal, and its distance to the origin is the penetration depth.

## Contact Resolution: Impulse-Based Method

When two bodies collide, we apply an **impulse** — an instantaneous change in momentum — to separate them and produce the correct bounce.

### Computing the Impulse

At a contact point with normal $\mathbf{n}$, the relative velocity is:

$$v_{rel} = (\mathbf{v}_1 + \boldsymbol{\omega}_1 \times \mathbf{r}_1) - (\mathbf{v}_2 + \boldsymbol{\omega}_2 \times \mathbf{r}_2)$$

where $\mathbf{r}_i$ is the vector from body $i$'s CoM to the contact point.

The closing speed along the normal is $v_n = v_{rel} \cdot \mathbf{n}$.

If $v_n > 0$, bodies are separating — no impulse needed.

The impulse magnitude $j$ using the coefficient of restitution $e$:

$$j = \frac{-(1 + e) \, v_n}{\frac{1}{m_1} + \frac{1}{m_2} + \left(\mathbf{I}_1^{-1}(\mathbf{r}_1 \times \mathbf{n}) \times \mathbf{r}_1 + \mathbf{I}_2^{-1}(\mathbf{r}_2 \times \mathbf{n}) \times \mathbf{r}_2\right) \cdot \mathbf{n}}$$

Apply the impulse:

$$\Delta\mathbf{v}_1 = +\frac{j}{m_1}\mathbf{n}, \quad \Delta\boldsymbol{\omega}_1 = +\mathbf{I}_1^{-1}(\mathbf{r}_1 \times j\mathbf{n})$$
$$\Delta\mathbf{v}_2 = -\frac{j}{m_2}\mathbf{n}, \quad \Delta\boldsymbol{\omega}_2 = -\mathbf{I}_2^{-1}(\mathbf{r}_2 \times j\mathbf{n})$$

## Sequential Impulse Solver

Real scenes have many simultaneous contacts. The **Sequential Impulse** (SI) solver (Catto, GDC 2006) handles this by iterating:

1. For each contact, compute and apply a pairwise impulse as if it were the only contact
2. **Clamp** the impulse so it never pulls bodies together ($j \geq 0$)
3. Repeat for all contacts, multiple iterations (typically 4-10)
4. **Warm-starting:** use the previous frame's impulse as the initial guess — dramatically improves convergence due to temporal coherence

The SI solver is a form of **projected Gauss-Seidel** iteration. It converges to the global solution under mild conditions and is used by Box2D, Bullet, Jolt, and PhysX.

```python
def sequential_impulse_solve(contacts, bodies, iterations=8):
    """Sequential impulse solver with warm-starting."""
    # Warm-start: apply cached impulses from previous frame
    for c in contacts:
        apply_impulse(c.body_a, c.body_b, c.normal, c.cached_impulse, c.ra, c.rb)

    for _ in range(iterations):
        for c in contacts:
            v_rel = relative_velocity(c.body_a, c.body_b, c.ra, c.rb)
            vn = np.dot(v_rel, c.normal)

            # Compute impulse increment
            dj = -(1 + c.restitution) * vn * c.effective_mass

            # Accumulate and clamp (never pull)
            old_impulse = c.accumulated_impulse
            c.accumulated_impulse = max(0, old_impulse + dj)
            dj = c.accumulated_impulse - old_impulse

            apply_impulse(c.body_a, c.body_b, c.normal, dj, c.ra, c.rb)

    # Cache for warm-starting next frame
    for c in contacts:
        c.cached_impulse = c.accumulated_impulse
```

## Friction: Coulomb Model

Friction acts tangent to the contact surface, opposing sliding motion. The **Coulomb friction** model states:

$$|f_t| \leq \mu \cdot |f_n|$$

where $\mu$ is the friction coefficient and $f_n$ is the normal force magnitude.

In impulse-based simulation, the tangential impulse $j_t$ is clamped:

$$j_t = \text{clamp}(j_t, -\mu \cdot j_n, +\mu \cdot j_n)$$

The tangent direction is computed from the relative velocity:

$$\mathbf{t} = \text{normalize}(v_{rel} - (v_{rel} \cdot \mathbf{n})\mathbf{n})$$

This creates a **friction cone** — the tangential force can point in any direction as long as its magnitude stays within $\mu \cdot |f_n|$.

## Worked Example: Sphere Hitting a Plane

**Setup:** A sphere (mass $m=2$ kg, radius $R=0.5$ m, $\mathbf{I} = \frac{2}{5}mR^2\mathbf{I}_3 = 0.2 \, \mathbf{I}_3$) falls onto a static infinite plane (infinite mass). At the moment of contact:

- Sphere velocity: $\mathbf{v}_1 = (0, -5, 0)$ m/s
- Sphere angular velocity: $\boldsymbol{\omega}_1 = (0, 0, 0)$
- Contact normal: $\mathbf{n} = (0, 1, 0)$ (pointing up)
- Contact point offset: $\mathbf{r}_1 = (0, -0.5, 0)$
- Restitution: $e = 0.7$

**Step 1:** Relative velocity at contact:

$$v_{rel} = \mathbf{v}_1 + \boldsymbol{\omega}_1 \times \mathbf{r}_1 = (0, -5, 0) + (0, 0, 0) = (0, -5, 0)$$

**Step 2:** Normal closing speed:

$$v_n = v_{rel} \cdot \mathbf{n} = -5 \text{ m/s}$$

Negative means approaching — impulse is needed.

**Step 3:** Effective mass denominator. Since the plane has infinite mass ($1/m_2 = 0$, $\mathbf{I}_2^{-1} = \mathbf{0}$):

$$\frac{1}{m_1} + \frac{1}{m_2} + [\mathbf{I}_1^{-1}(\mathbf{r}_1 \times \mathbf{n}) \times \mathbf{r}_1] \cdot \mathbf{n}$$

Compute $\mathbf{r}_1 \times \mathbf{n} = (0, -0.5, 0) \times (0, 1, 0) = (0, 0, 0)$.

So the rotational term vanishes (the contact is directly below the CoM), and:

$$\text{denom} = \frac{1}{2} + 0 + 0 = 0.5$$

**Step 4:** Impulse magnitude:

$$j = \frac{-(1 + 0.7)(-5)}{0.5} = \frac{8.5}{0.5} = 17 \text{ N·s}$$

**Step 5:** New velocity:

$$\mathbf{v}_1' = \mathbf{v}_1 + \frac{j}{m_1}\mathbf{n} = (0, -5, 0) + \frac{17}{2}(0, 1, 0) = (0, 3.5, 0)$$

The sphere bounces up at $3.5$ m/s $= 0.7 \times 5$ m/s — consistent with the restitution coefficient.

<details>
<summary>Exercise 1: Compute inertia tensor for a thin rod</summary>

A thin rod of mass $M$ and length $L$ aligned along the x-axis, centered at the origin.

Show that $I_{yy} = I_{zz} = \frac{1}{12}ML^2$ and $I_{xx} = 0$ (treating the rod as infinitely thin).

**Solution:** $I_{yy} = \int_{-L/2}^{L/2} \frac{M}{L} x^2 \, dx = \frac{M}{L} \cdot \frac{x^3}{3}\Big|_{-L/2}^{L/2} = \frac{M}{L} \cdot \frac{L^3}{12} = \frac{ML^2}{12}$.
</details>

<details>
<summary>Exercise 2: Off-center collision impulse</summary>

Repeat the sphere-plane example, but with the sphere having angular velocity $\boldsymbol{\omega}_1 = (0, 0, 10)$ rad/s at impact. Now the contact point has additional tangential velocity from rotation. Compute the new relative velocity at the contact point and the normal impulse.

**Hint:** $v_{rel} = \mathbf{v}_1 + \boldsymbol{\omega}_1 \times \mathbf{r}_1$ where $\boldsymbol{\omega}_1 \times \mathbf{r}_1 = (0, 0, 10) \times (0, -0.5, 0) = (5, 0, 0)$.
</details>

<details>
<summary>Exercise 3: Quaternion rotation</summary>

Given quaternion $q = (\frac{\sqrt{2}}{2}, \frac{\sqrt{2}}{2}, 0, 0)$ (90-degree rotation about x-axis) and angular velocity $\boldsymbol{\omega} = (0, 0, \pi)$ rad/s:

Compute the quaternion derivative $dq/dt = \frac{1}{2} \boldsymbol{\omega} \otimes q$.

**Hint:** The pure quaternion for $\boldsymbol{\omega}$ is $(0, 0, 0, \pi)$.
</details>

## Key Takeaways

- The **inertia tensor** encodes mass distribution and must be transformed to world space each frame via $\mathbf{I}_{world} = \mathbf{R}\mathbf{I}_{body}\mathbf{R}^T$
- **Newton-Euler equations** govern both translation ($\mathbf{F} = m\mathbf{a}$) and rotation ($\boldsymbol{\tau} = \mathbf{I}\boldsymbol{\alpha} + \boldsymbol{\omega} \times \mathbf{I}\boldsymbol{\omega}$)
- Use **quaternions** for orientation — they avoid gimbal lock and integrate cleanly
- **Broad phase** (sweep-and-prune) culls impossible pairs; **narrow phase** (GJK + EPA) finds exact contacts
- The **sequential impulse solver** iteratively resolves all contacts and is the industry standard (Box2D, Bullet, Jolt)
- **Coulomb friction** constrains tangential impulse to a friction cone: $|j_t| \leq \mu \cdot j_n$

**References:**
- Erin Catto, *Sequential Impulses*, GDC (2006); *Modeling and Solving Constraints*, GDC (2009)
- Rouwe, J., *Jolt Physics* — github.com/jrouwe/JoltPhysics (2022)
- Gilbert, Johnson & Keerthi, "A fast procedure for computing the distance between complex objects in 3D" (1988)
- Baraff, D., *Physically Based Modeling*, SIGGRAPH Course Notes (2001)
