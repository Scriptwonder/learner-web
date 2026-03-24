# Position-Based Dynamics

**Position-Based Dynamics** (PBD) is a simulation framework that manipulates particle positions directly rather than computing forces and integrating accelerations. Introduced by Muller et al. (2007), PBD quickly became the dominant method for real-time deformable body simulation — cloth, soft bodies, ropes, and hair — due to its simplicity, robustness, and visual plausibility.

## Force-Based vs. Position-Based

### Traditional Force-Based Pipeline

1. Accumulate forces ($\mathbf{F} = -\nabla U$)
2. Compute accelerations ($\mathbf{a} = \mathbf{F}/m$)
3. Integrate velocities and positions
4. Handle constraint violations as post-processing

**Problem:** Stiff forces (large $k$) require tiny timesteps for stability. Implicit integration helps but introduces complexity and cost.

### PBD Pipeline

1. Apply external forces to velocity (gravity, wind)
2. Predict new positions: $\tilde{\mathbf{x}}_i = \mathbf{x}_i + \Delta t \cdot \mathbf{v}_i$
3. **Project constraints** directly on positions — iteratively move particles to satisfy constraints
4. Update velocities from position changes: $\mathbf{v}_i = (\mathbf{x}_i^{new} - \mathbf{x}_i) / \Delta t$

No stiffness parameters, no stability issues — constraints are satisfied geometrically. The trade-off: stiffness depends on iteration count and timestep.

## The PBD Algorithm

```python
def pbd_step(particles, constraints, dt, num_iterations):
    # Step 1: Apply external forces
    for p in particles:
        p.vel += dt * p.force / p.mass
        p.predicted = p.pos + dt * p.vel

    # Step 2: Project constraints (Gauss-Seidel)
    for _ in range(num_iterations):
        for c in constraints:
            c.project(particles)

    # Step 3: Update velocities and positions
    for p in particles:
        p.vel = (p.predicted - p.pos) / dt
        p.pos = p.predicted
```

## Constraint Projection

A constraint is a function $C(\mathbf{x}_1, \ldots, \mathbf{x}_n) = 0$ (equality) or $C \geq 0$ (inequality). The projection step moves particles to satisfy $C = 0$ along the constraint gradient.

### Position Correction Formula

For a constraint $C(\mathbf{x}_1, \ldots, \mathbf{x}_n)$ involving $n$ particles, the correction for particle $i$ is:

$$\Delta \mathbf{x}_i = -\frac{w_i}{\sum_j w_j |\nabla_j C|^2} \, C(\mathbf{x}_1, \ldots, \mathbf{x}_n) \, \nabla_i C$$

where $w_i = 1/m_i$ is the inverse mass. This moves each particle proportionally to the gradient and inversely proportionally to its mass — heavier particles move less.

### Gauss-Seidel Iteration

Constraints are projected **sequentially**, each using the most recently updated positions. This is a **Gauss-Seidel** relaxation pattern. Convergence is not guaranteed in a fixed number of iterations, but in practice 4-20 iterations produce visually convincing results.

Randomizing or cycling the constraint processing order improves convergence by avoiding systematic bias.

## Distance Constraints (Cloth)

The most fundamental constraint maintains a fixed distance $d$ between two particles:

$$C(\mathbf{x}_1, \mathbf{x}_2) = |\mathbf{x}_1 - \mathbf{x}_2| - d = 0$$

The gradient with respect to each particle:

$$\nabla_1 C = \frac{\mathbf{x}_1 - \mathbf{x}_2}{|\mathbf{x}_1 - \mathbf{x}_2|} = \hat{\mathbf{n}}, \quad \nabla_2 C = -\hat{\mathbf{n}}$$

Position corrections:

$$\Delta \mathbf{x}_1 = -\frac{w_1}{w_1 + w_2} \, C \, \hat{\mathbf{n}}$$
$$\Delta \mathbf{x}_2 = +\frac{w_2}{w_1 + w_2} \, C \, \hat{\mathbf{n}}$$

```python
def distance_constraint(p1, p2, rest_length):
    """Project a distance constraint between two particles."""
    delta = p1.predicted - p2.predicted
    dist = np.linalg.norm(delta)
    if dist < 1e-8:
        return
    n = delta / dist
    C = dist - rest_length
    w1, w2 = 1.0 / p1.mass, 1.0 / p2.mass
    w_sum = w1 + w2
    p1.predicted -= (w1 / w_sum) * C * n
    p2.predicted += (w2 / w_sum) * C * n
```

### Building a Cloth Mesh

A cloth is a grid of particles connected by:
- **Stretch constraints:** between adjacent particles (horizontal and vertical)
- **Shear constraints:** between diagonal neighbors
- **Bend constraints:** between particles two steps apart (skip one)

## Bending Constraints

For cloth, bending resistance prevents a mesh from folding too easily. A bending constraint operates on **four** particles sharing an edge (two triangles). The constraint measures the **dihedral angle** $\phi$ between the triangle normals:

$$C_{bend}(\mathbf{x}_1, \mathbf{x}_2, \mathbf{x}_3, \mathbf{x}_4) = \phi - \phi_0$$

where $\phi_0$ is the rest angle. The gradient computation is more involved (see Muller et al. 2007 for the full derivation), but the projection pattern remains the same.

A simpler alternative for grid-based cloth uses **long-range distance constraints** between particles separated by two edges — effectively resisting bending by maintaining a target distance.

## Volume Conservation

For soft bodies, we need to preserve volume. The volume of a tetrahedron with vertices $\mathbf{x}_1, \mathbf{x}_2, \mathbf{x}_3, \mathbf{x}_4$ is:

$$V = \frac{1}{6}(\mathbf{x}_2 - \mathbf{x}_1) \cdot [(\mathbf{x}_3 - \mathbf{x}_1) \times (\mathbf{x}_4 - \mathbf{x}_1)]$$

The volume constraint:

$$C_{vol} = V - V_0 = 0$$

For a closed triangular mesh, the total volume can be computed as a sum of signed tetrahedra volumes, and a single global constraint $C = V_{total} - V_0$ can be projected by pushing vertices along their face normals.

## Collision Constraints

### Particle-Plane Collision

For a plane with normal $\mathbf{n}$ and offset $d$:

$$C(\mathbf{x}) = \mathbf{x} \cdot \mathbf{n} - d \geq 0$$

If violated, project:

$$\Delta \mathbf{x} = (\mathbf{x} \cdot \mathbf{n} - d) \cdot \mathbf{n}$$

### Particle-Particle Collision

Prevent interpenetration of particles with radii $r_1, r_2$:

$$C(\mathbf{x}_1, \mathbf{x}_2) = |\mathbf{x}_1 - \mathbf{x}_2| - (r_1 + r_2) \geq 0$$

This is an **inequality constraint** — only projected when $C < 0$.

### Self-Collision

Cloth self-collision uses spatial hashing to find nearby particle-triangle pairs, then applies inequality distance constraints. This is often the most expensive part of a cloth simulation.

## XPBD: Extended Position-Based Dynamics

Standard PBD has a fundamental limitation: constraint stiffness depends on both the **iteration count** and the **timestep**. Doubling the substeps makes everything stiffer. This makes artist tuning extremely difficult.

**XPBD** (Macklin, Muller & Chentanez, 2016) solves this by introducing a **compliance** parameter $\alpha$ that has physical units, making stiffness independent of the solver configuration.

### The Compliance Parameter

Compliance $\alpha$ (units: $1/\text{stiffness}$) is the inverse of the spring constant:

$$\alpha = \frac{1}{k}$$

A compliance of $0$ means infinitely stiff (hard constraint). A larger $\alpha$ means softer.

The time-scaled compliance is:

$$\tilde{\alpha} = \frac{\alpha}{\Delta t^2}$$

### XPBD Constraint Projection Formula

XPBD introduces a Lagrange multiplier $\lambda$ per constraint that tracks the accumulated constraint force. The update per iteration:

$$\Delta \lambda = \frac{-C(\mathbf{x}) - \tilde{\alpha} \lambda}{\nabla C^T \mathbf{M}^{-1} \nabla C + \tilde{\alpha}}$$

$$\Delta \mathbf{x}_i = \frac{w_i}{\nabla C^T \mathbf{M}^{-1} \nabla C + \tilde{\alpha}} \, (-C - \tilde{\alpha}\lambda) \, \nabla_i C$$

Or equivalently, combining into a single expression:

$$\Delta \mathbf{x}_i = w_i \, \Delta\lambda \, \nabla_i C$$

The $\lambda$ values are initialized to zero each timestep and accumulated across iterations.

### Connection to Implicit Euler

XPBD can be shown to be equivalent to solving the implicit Euler equations for a system with elastic potential $U = \frac{1}{2\alpha}C^2$. This means:

- XPBD with compliance $\alpha = 0$ solves hard constraints (like a rigid distance)
- XPBD with finite $\alpha$ simulates a spring with stiffness $k = 1/\alpha$
- The result is independent of iteration count and timestep (given sufficient iterations to converge)

```python
def xpbd_distance_constraint(p1, p2, rest_length, compliance, dt, lam):
    """XPBD distance constraint projection.
    lam: accumulated Lagrange multiplier (scalar, mutable list [value]).
    Returns updated lambda.
    """
    delta = p1.predicted - p2.predicted
    dist = np.linalg.norm(delta)
    if dist < 1e-8:
        return
    n = delta / dist
    C = dist - rest_length

    w1, w2 = 1.0 / p1.mass, 1.0 / p2.mass
    w_sum = w1 + w2
    alpha_tilde = compliance / (dt * dt)

    delta_lambda = (-C - alpha_tilde * lam[0]) / (w_sum + alpha_tilde)
    lam[0] += delta_lambda

    p1.predicted += w1 * delta_lambda * n
    p2.predicted -= w2 * delta_lambda * n
```

### XPBD Algorithm

```python
def xpbd_step(particles, constraints, dt, num_iterations):
    # Step 1: Predict positions
    for p in particles:
        p.vel += dt * p.force / p.mass
        p.predicted = p.pos + dt * p.vel

    # Step 2: Initialize Lagrange multipliers
    for c in constraints:
        c.lam = 0.0

    # Step 3: Solve constraints
    for _ in range(num_iterations):
        for c in constraints:
            c.project_xpbd(particles, dt)

    # Step 4: Update velocities
    for p in particles:
        p.vel = (p.predicted - p.pos) / dt
        p.pos = p.predicted
```

## Worked Example: 4-Particle Cloth Patch

Simulate a minimal cloth: a square of 4 particles connected by 4 edge constraints and 2 diagonal constraints. Particles 0 and 1 are pinned (infinite mass).

```
  0 ------- 1     (pinned)
  |  \   /  |
  |    X    |
  |  /   \  |
  2 ------- 3     (free, mass = 1)
```

```python
import numpy as np

class Particle:
    def __init__(self, pos, mass=1.0, pinned=False):
        self.pos = np.array(pos, dtype=float)
        self.vel = np.zeros(3)
        self.predicted = np.copy(self.pos)
        self.mass = mass if not pinned else 1e18  # large mass = pinned

# Create particles (rest shape: unit square in xz-plane, y=0)
particles = [
    Particle([0, 0, 0], pinned=True),   # 0: top-left, pinned
    Particle([1, 0, 0], pinned=True),   # 1: top-right, pinned
    Particle([0, 0, 1]),                 # 2: bottom-left
    Particle([1, 0, 1]),                 # 3: bottom-right
]

# Constraints: (i, j, rest_length, compliance)
edges = [
    (0, 1, 1.0),  (2, 3, 1.0),     # horizontal
    (0, 2, 1.0),  (1, 3, 1.0),     # vertical
    (0, 3, np.sqrt(2)),              # diagonal
    (1, 2, np.sqrt(2)),              # diagonal
]

gravity = np.array([0, -9.81, 0])
dt = 0.016  # 60 Hz
compliance = 0.0  # rigid distance constraints
num_iterations = 10

# Simulation loop
for frame in range(300):
    # Predict
    for p in particles:
        p.vel += dt * gravity
        p.predicted = p.pos + dt * p.vel

    # Initialize lambdas
    lambdas = [0.0] * len(edges)

    # XPBD solve
    alpha_tilde = compliance / (dt * dt) if compliance > 0 else 0.0
    for _ in range(num_iterations):
        for idx, (i, j, rest_len) in enumerate(edges):
            p1, p2 = particles[i], particles[j]
            delta = p1.predicted - p2.predicted
            dist = np.linalg.norm(delta)
            if dist < 1e-10:
                continue
            n = delta / dist
            C = dist - rest_len

            w1 = 1.0 / p1.mass
            w2 = 1.0 / p2.mass
            denom = w1 + w2 + alpha_tilde

            dlam = (-C - alpha_tilde * lambdas[idx]) / denom
            lambdas[idx] += dlam

            p1.predicted += w1 * dlam * n
            p2.predicted -= w2 * dlam * n

    # Update
    for p in particles:
        p.vel = (p.predicted - p.pos) / dt
        p.pos = np.copy(p.predicted)

    if frame % 60 == 0:
        print(f"Frame {frame}: particle 2 = {particles[2].pos}, "
              f"particle 3 = {particles[3].pos}")
```

**Expected behavior:** Particles 2 and 3 fall under gravity, stretch the constraints, then oscillate and settle into a hanging configuration — a "V" shape with the two free particles dangling below the pinned ones, connected by taut edges.

## Recent Developments

### XPBI: Inelastic Materials (2024)

**XPBI** (Extended Position-Based Inelasticity) extends XPBD to handle continuum inelastic behaviors — mud, viscoplastic paint, brittle fracture, sand, and snow — by incorporating constitutive laws into the PBD framework (2024).

### MGPBD: Multigrid Acceleration (2025)

**MGPBD** (Multigrid Position-Based Dynamics) introduces algebraic multigrid preconditioning to the global XPBD system, dramatically accelerating convergence for large-scale simulations with a lazy update strategy that defers costly setup phases (2025).

### Muller's "Ten Minute Physics"

Matthias Muller (co-inventor of PBD and XPBD) created the excellent "Ten Minute Physics" YouTube series, providing accessible implementations of PBD cloth, soft bodies, fluids, and rigid bodies — highly recommended as a practical learning resource.

<details>
<summary>Exercise 1: Add damping to the cloth</summary>

Modify the XPBD cloth example to include velocity damping. After the constraint solve, apply:

$$\mathbf{v}_i \leftarrow (1 - k_d) \cdot \mathbf{v}_i$$

where $k_d = 0.01$ is a small damping factor. Observe how the cloth settles faster.

**Bonus:** Implement proper constraint-based damping using XPBD's dissipation framework with a damping compliance $\beta$.
</details>

<details>
<summary>Exercise 2: Compare PBD and XPBD stiffness</summary>

Run the cloth simulation with classic PBD (no compliance, just direct projection) at 5 iterations and 20 iterations. Observe how the cloth is much stretchier at 5 iterations.

Then switch to XPBD with $\alpha = 0$ (rigid). Verify that both iteration counts produce approximately the same stiffness — this is the key advantage of XPBD.
</details>

<details>
<summary>Exercise 3: Implement a balloon</summary>

Create a tetrahedron with 4 particles and add:
- 6 edge distance constraints (the edges)
- 1 volume constraint ($V \geq V_0$)

The volume constraint gradient for vertex $i$ is proportional to the cross product of the opposite face's edges. Inflate the balloon by setting $V_0$ larger than the initial volume and use XPBD with a finite compliance.
</details>

## Key Takeaways

- **PBD** projects constraints directly on positions — no forces, no stiffness explosion, unconditionally stable
- The **Gauss-Seidel** iteration pattern converges quickly in practice (4-20 iterations for real-time)
- **Distance constraints** are the workhorse: cloth, ropes, rigid connectors
- Standard PBD ties stiffness to iteration count and timestep — a major usability problem
- **XPBD** introduces the compliance parameter $\tilde{\alpha} = \alpha / \Delta t^2$ and Lagrange multipliers, making stiffness physically meaningful and solver-independent
- XPBD is equivalent to implicit Euler for elastic potentials $U = \frac{1}{2\alpha}C^2$
- Modern extensions (XPBI, MGPBD) bring inelastic materials and multigrid acceleration to the PBD family

**References:**
- Muller, M. et al., "Position Based Dynamics," J. Visual Communication and Image Representation (2007)
- Macklin, M., Muller, M. & Chentanez, N., "XPBD: Position-Based Simulation of Compliant Constrained Dynamics," MIG (2016)
- Muller, M., "Ten Minute Physics" — matthias-research.github.io/pages/tenMinutePhysics
- XPBI: Position-Based Dynamics with Smoothing Kernels for Continuum Inelasticity (2024)
- MGPBD: A Multigrid Accelerated Global XPBD Solver (2025)
