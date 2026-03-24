# Fluid Simulation

Fluids are among the most visually stunning and computationally challenging phenomena to simulate. From ocean waves to smoke and explosions, fluid simulation underpins many effects in games, film, and scientific visualization. The mathematics rests on the **Navier-Stokes equations** — and the art lies in choosing the right discretization.

## The Navier-Stokes Equations

For an **incompressible** fluid with constant density $\rho$, the momentum and continuity equations are:

$$\frac{\partial \mathbf{u}}{\partial t} + (\mathbf{u} \cdot \nabla)\mathbf{u} = -\frac{1}{\rho}\nabla p + \nu \nabla^2 \mathbf{u} + \mathbf{f}$$

$$\nabla \cdot \mathbf{u} = 0$$

where:
- $\mathbf{u}$ — velocity field
- $p$ — pressure
- $\nu$ — kinematic viscosity
- $\mathbf{f}$ — external forces (gravity, etc.)
- $\nabla \cdot \mathbf{u} = 0$ — the **incompressibility constraint** (divergence-free velocity)

Each term has a physical role:
- $(\mathbf{u} \cdot \nabla)\mathbf{u}$ — **advection** (fluid carries itself)
- $-\frac{1}{\rho}\nabla p$ — **pressure** (pushes fluid from high to low pressure)
- $\nu \nabla^2 \mathbf{u}$ — **viscosity** (diffusion of momentum, smoothing)
- $\mathbf{f}$ — **body forces** (gravity, buoyancy)

## Lagrangian vs. Eulerian Viewpoints

### Eulerian (Grid-Based)

Fix a grid in space and ask: "What is the fluid doing at each grid point?" The velocity field $\mathbf{u}(\mathbf{x}, t)$ lives on a fixed spatial grid. Good for smoke, fire, and enclosed fluid volumes.

**Advantages:** Regular memory access, easy pressure solve, natural boundary conditions.

**Disadvantages:** Numerical diffusion, difficulty tracking free surfaces, fixed resolution.

### Lagrangian (Particle-Based)

Track individual fluid particles as they move through space. Each particle carries mass, velocity, and other properties. Good for splashing liquids, spray, and free-surface flows.

**Advantages:** Natural advection (no numerical diffusion), easy free surface, adaptive resolution.

**Disadvantages:** Irregular neighbor queries, harder pressure enforcement, anisotropic particle distributions.

### Hybrid Methods

Modern production systems often combine both: **FLIP/PIC** (Fluid Implicit Particle) uses particles for advection and a grid for the pressure solve, getting the best of both worlds. Houdini and Bifrost use FLIP extensively.

## SPH: Smoothed Particle Hydrodynamics

SPH (Gingold & Monaghan, 1977; adapted for graphics by Muller et al., 2003) approximates continuous fields using **weighted sums over nearby particles**.

### Kernel Functions

Any field quantity $A$ at position $\mathbf{r}$ is approximated by:

$$A(\mathbf{r}) \approx \sum_j m_j \frac{A_j}{\rho_j} W(\mathbf{r} - \mathbf{r}_j, h)$$

where $W$ is a **smoothing kernel** with support radius $h$, and the sum runs over neighboring particles $j$.

#### Poly6 Kernel (for density, color field)

$$W_{poly6}(\mathbf{r}, h) = \frac{315}{64\pi h^9} \begin{cases} (h^2 - |\mathbf{r}|^2)^3 & |\mathbf{r}| \leq h \\ 0 & \text{otherwise} \end{cases}$$

Used for density computation because it is smooth, non-negative, and has a zero gradient at $\mathbf{r} = 0$ (preventing particle clumping artifacts).

#### Spiky Kernel (for pressure)

$$W_{spiky}(\mathbf{r}, h) = \frac{15}{\pi h^6} \begin{cases} (h - |\mathbf{r}|)^3 & |\mathbf{r}| \leq h \\ 0 & \text{otherwise} \end{cases}$$

$$\nabla W_{spiky} = -\frac{45}{\pi h^6} \frac{(h - |\mathbf{r}|)^2}{|\mathbf{r}|} \hat{\mathbf{r}}$$

The spiky kernel has a **non-zero gradient at the origin**, which is essential for pressure forces — particles that are too close experience a strong repulsive force.

#### Viscosity Kernel

$$W_{visc}(\mathbf{r}, h) = \frac{15}{2\pi h^3} \left( -\frac{|\mathbf{r}|^3}{2h^3} + \frac{|\mathbf{r}|^2}{h^2} + \frac{h}{2|\mathbf{r}|} - 1 \right)$$

$$\nabla^2 W_{visc} = \frac{45}{\pi h^6}(h - |\mathbf{r}|)$$

The Laplacian is always positive, ensuring viscosity always dissipates energy (never introduces it).

### Density Computation

Each particle's density is estimated from its neighbors:

$$\rho_i = \sum_j m_j \, W_{poly6}(\mathbf{r}_i - \mathbf{r}_j, h)$$

### Pressure Force

Using the ideal gas equation of state: $p_i = k(\rho_i - \rho_0)$ where $k$ is a stiffness constant and $\rho_0$ is the rest density.

The pressure force on particle $i$:

$$\mathbf{F}_i^{pressure} = -\sum_j m_j \frac{p_i + p_j}{2\rho_j} \nabla W_{spiky}(\mathbf{r}_i - \mathbf{r}_j, h)$$

The symmetrized form $(p_i + p_j)/2$ ensures Newton's third law (equal and opposite forces).

### Viscosity Force

$$\mathbf{F}_i^{viscosity} = \mu \sum_j m_j \frac{\mathbf{u}_j - \mathbf{u}_i}{\rho_j} \nabla^2 W_{visc}(\mathbf{r}_i - \mathbf{r}_j, h)$$

where $\mu$ is the dynamic viscosity coefficient.

### Surface Tension

Surface tension acts on the fluid surface, pulling it toward minimal area (spherical shapes). One approach uses the **color field** $c_i = \sum_j (m_j / \rho_j) W_{poly6}$ and its gradient (surface normal) and Laplacian (curvature):

$$\mathbf{F}_i^{surface} = -\sigma \, \kappa_i \, \hat{\mathbf{n}}_i$$

where $\sigma$ is the surface tension coefficient, $\kappa_i = -\nabla^2 c_i / |\nabla c_i|$ is curvature, and $\hat{\mathbf{n}}_i = \nabla c_i / |\nabla c_i|$ is the surface normal. This force is only applied where $|\nabla c_i|$ is sufficiently large (near the surface).

### SPH Pseudocode

```python
import numpy as np
from scipy.spatial import KDTree

# Parameters
REST_DENSITY = 1000.0   # kg/m^3
GAS_CONSTANT = 2000.0   # stiffness
H = 0.04                # smoothing radius
VISCOSITY = 1.0
DT = 0.001
GRAVITY = np.array([0, -9.81, 0])

def poly6(r_sq, h):
    """Poly6 kernel value (scalar). r_sq = |r|^2."""
    if r_sq >= h * h:
        return 0.0
    coeff = 315.0 / (64.0 * np.pi * h**9)
    return coeff * (h*h - r_sq)**3

def spiky_grad(r_vec, h):
    """Spiky kernel gradient (vector)."""
    r = np.linalg.norm(r_vec)
    if r < 1e-8 or r >= h:
        return np.zeros(3)
    coeff = -45.0 / (np.pi * h**6)
    return coeff * (h - r)**2 / r * r_vec

def visc_laplacian(r, h):
    """Viscosity kernel Laplacian (scalar)."""
    if r >= h:
        return 0.0
    return 45.0 / (np.pi * h**6) * (h - r)

def sph_step(positions, velocities, masses):
    n = len(positions)
    # Neighbor search
    tree = KDTree(positions)
    neighbors = tree.query_ball_tree(tree, H)

    # Compute densities
    densities = np.zeros(n)
    for i in range(n):
        for j in neighbors[i]:
            r_sq = np.sum((positions[i] - positions[j])**2)
            densities[i] += masses[j] * poly6(r_sq, H)

    # Compute pressures
    pressures = GAS_CONSTANT * (densities - REST_DENSITY)

    # Compute forces
    forces = np.zeros_like(positions)
    for i in range(n):
        for j in neighbors[i]:
            if i == j:
                continue
            r_vec = positions[i] - positions[j]
            r = np.linalg.norm(r_vec)

            # Pressure force (symmetrized)
            f_press = -masses[j] * (pressures[i] + pressures[j]) \
                      / (2 * densities[j]) * spiky_grad(r_vec, H)
            forces[i] += f_press

            # Viscosity force
            f_visc = VISCOSITY * masses[j] * (velocities[j] - velocities[i]) \
                     / densities[j] * visc_laplacian(r, H)
            forces[i] += f_visc

        # Gravity
        forces[i] += densities[i] * GRAVITY

    # Integration (symplectic Euler)
    for i in range(n):
        velocities[i] += DT * forces[i] / densities[i]
        positions[i] += DT * velocities[i]

    return positions, velocities
```

## Eulerian Grid Methods

### MAC Staggered Grid

The **Marker-and-Cell** (MAC) grid (Harlow & Welch, 1965) stores quantities at staggered locations to avoid pressure-velocity decoupling:

- **Pressure** $p$: at cell centers
- **Velocity $u$**: at the left/right faces (x-component)
- **Velocity $v$**: at the top/bottom faces (y-component)
- **Velocity $w$**: at the front/back faces (z-component)

```
    +---v---+---v---+
    |       |       |
    u   p   u   p   u
    |       |       |
    +---v---+---v---+
    |       |       |
    u   p   u   p   u
    |       |       |
    +---v---+---v---+
```

This staggering naturally avoids the "checkerboard" pressure instability that arises with collocated grids, and makes the divergence and gradient operators second-order accurate.

### Advection: Semi-Lagrangian Method

The advection term $(\mathbf{u} \cdot \nabla)\mathbf{u}$ moves quantities along the velocity field. The **semi-Lagrangian** method (Stam, 1999) is unconditionally stable:

1. For each grid point $\mathbf{x}$, trace backward along the velocity field: $\mathbf{x}_{prev} = \mathbf{x} - \Delta t \cdot \mathbf{u}(\mathbf{x})$
2. Interpolate the field value at $\mathbf{x}_{prev}$ using bilinear (2D) or trilinear (3D) interpolation
3. Set the new value at $\mathbf{x}$ to this interpolated value

```python
def semi_lagrangian_advect(field, vel_x, vel_y, dt, dx):
    """Semi-Lagrangian advection for a 2D scalar field."""
    ny, nx = field.shape
    new_field = np.zeros_like(field)
    for j in range(ny):
        for i in range(nx):
            # Backtrace
            x_prev = i - dt * vel_x[j, i] / dx
            y_prev = j - dt * vel_y[j, i] / dx

            # Clamp to grid bounds
            x_prev = np.clip(x_prev, 0, nx - 1.001)
            y_prev = np.clip(y_prev, 0, ny - 1.001)

            # Bilinear interpolation
            i0, j0 = int(x_prev), int(y_prev)
            i1, j1 = min(i0 + 1, nx-1), min(j0 + 1, ny-1)
            sx, sy = x_prev - i0, y_prev - j0

            new_field[j, i] = (
                (1-sx)*(1-sy)*field[j0, i0] + sx*(1-sy)*field[j0, i1]
                + (1-sx)*sy*field[j1, i0] + sx*sy*field[j1, i1]
            )
    return new_field
```

The key insight is that this method is **unconditionally stable** — no CFL restriction — because it always interpolates between existing values, never extrapolates. The trade-off is numerical diffusion: the bilinear interpolation smooths out fine details over time.

### Pressure Projection (Poisson Equation)

After advection, the velocity field is generally not divergence-free. The **pressure projection** step enforces incompressibility:

1. Compute the divergence of the velocity field:

$$d_{i,j} = \frac{u_{i+1,j} - u_{i,j}}{\Delta x} + \frac{v_{i,j+1} - v_{i,j}}{\Delta y}$$

2. Solve the **Poisson equation** for pressure:

$$\nabla^2 p = \frac{\rho}{\Delta t} \nabla \cdot \mathbf{u}$$

Discretized on a 2D grid:

$$p_{i-1,j} + p_{i+1,j} + p_{i,j-1} + p_{i,j+1} - 4p_{i,j} = \frac{\rho \Delta x^2}{\Delta t} d_{i,j}$$

This is a large sparse linear system solved via iterative methods (Jacobi, Gauss-Seidel, or conjugate gradient).

3. Subtract the pressure gradient from velocity:

$$u_{i,j}^{new} = u_{i,j} - \frac{\Delta t}{\rho \Delta x}(p_{i,j} - p_{i-1,j})$$
$$v_{i,j}^{new} = v_{i,j} - \frac{\Delta t}{\rho \Delta y}(p_{i,j} - p_{i,j-1})$$

After projection, $\nabla \cdot \mathbf{u}^{new} = 0$ (up to solver tolerance).

## Stable Fluids Algorithm (Stam, 1999)

Jos Stam's **Stable Fluids** algorithm is a complete Eulerian fluid solver that is unconditionally stable at any timestep. The algorithm splits each timestep into four stages via **operator splitting**:

### The Four Stages

**1. Add Forces:** Apply external forces (gravity, user input) to the velocity field:

$$\mathbf{u}^* = \mathbf{u}^n + \Delta t \cdot \mathbf{f}$$

**2. Diffuse (Viscosity):** Solve the diffusion equation $\frac{\partial \mathbf{u}}{\partial t} = \nu \nabla^2 \mathbf{u}$ implicitly:

$$(I - \nu \Delta t \nabla^2) \mathbf{u}^{**} = \mathbf{u}^*$$

This is solved by iterative relaxation (Gauss-Seidel). Implicit diffusion is unconditionally stable.

**3. Advect (Semi-Lagrangian):** Move the velocity field along itself using the semi-Lagrangian method described above.

**4. Project (Pressure):** Solve the Poisson equation and subtract the pressure gradient to make the velocity divergence-free.

```python
def stable_fluids_step(u, v, density, dt, dx, viscosity, rho):
    """One step of the Stable Fluids algorithm (2D)."""
    # Stage 1: Add forces
    v -= dt * 9.81  # gravity on y-velocity

    # Stage 2: Diffuse (implicit, via Gauss-Seidel)
    u = diffuse_implicit(u, viscosity, dt, dx, iterations=20)
    v = diffuse_implicit(v, viscosity, dt, dx, iterations=20)

    # Stage 3: Advect (semi-Lagrangian)
    u = semi_lagrangian_advect(u, u, v, dt, dx)
    v = semi_lagrangian_advect(v, u, v, dt, dx)

    # Stage 4: Pressure projection
    div = compute_divergence(u, v, dx)
    pressure = solve_poisson(div, dx, dt, rho, iterations=50)
    u, v = subtract_gradient(u, v, pressure, dx, dt, rho)

    # Advect density (passive scalar)
    density = semi_lagrangian_advect(density, u, v, dt, dx)

    return u, v, density
```

## Position-Based Fluids (Macklin & Muller, 2013)

**PBF** adapts the Position-Based Dynamics framework to fluid simulation. Instead of computing pressure forces, it enforces a **density constraint** at each particle:

$$C_i(\mathbf{x}_1, \ldots, \mathbf{x}_n) = \frac{\rho_i}{\rho_0} - 1 = 0$$

The constraint is projected iteratively using the PBD position correction formula. This produces an incompressible SPH-like simulation with the stability guarantees of PBD.

### Key Innovations

- **Tensile instability correction:** Adds a small artificial pressure term to prevent particle clumping:

$$s_{corr} = -k \left(\frac{W(\mathbf{r}, h)}{W(\Delta q \cdot \hat{\mathbf{e}}, h)}\right)^n$$

where $\Delta q = 0.1h-0.3h$, $k \approx 0.1$, $n = 4$.

- **Vorticity confinement:** Re-injects lost rotational energy:

$$\mathbf{f}_i^{vorticity} = \epsilon \left(\frac{\nabla|\boldsymbol{\omega}|}{|\nabla|\boldsymbol{\omega}||} \times \boldsymbol{\omega}_i\right)$$

- **XSPH viscosity:** Smooths velocity for coherent motion:

$$\mathbf{v}_i^{new} = \mathbf{v}_i + c \sum_j \frac{m_j}{\rho_j}(\mathbf{v}_j - \mathbf{v}_i) W(\mathbf{r}_i - \mathbf{r}_j, h)$$

PBF is used in NVIDIA FleX and Unreal Engine's Chaos Destruction for real-time fluid effects.

## Worked Example: SPH Density Estimation

**Setup:** Three particles in 2D with support radius $h = 1.0$, mass $m = 1.0$, using the poly6 kernel.

Positions: $\mathbf{r}_1 = (0, 0)$, $\mathbf{r}_2 = (0.5, 0)$, $\mathbf{r}_3 = (0.3, 0.4)$.

**Step 1:** Compute all pairwise squared distances:

$$|\mathbf{r}_1 - \mathbf{r}_2|^2 = 0.25$$
$$|\mathbf{r}_1 - \mathbf{r}_3|^2 = 0.09 + 0.16 = 0.25$$
$$|\mathbf{r}_2 - \mathbf{r}_3|^2 = 0.04 + 0.16 = 0.20$$

All distances are $< h = 1.0$, so all pairs contribute.

**Step 2:** Evaluate poly6 kernel. With $h = 1$:

$$W_{poly6}(r^2, 1) = \frac{315}{64\pi} (1 - r^2)^3$$

The coefficient: $\frac{315}{64\pi} \approx 1.5668$ (in 2D, the coefficient differs; for this example we use the 3D formula).

$$W(0.25, 1) = 1.5668 \times (0.75)^3 = 1.5668 \times 0.4219 = 0.6609$$
$$W(0.20, 1) = 1.5668 \times (0.80)^3 = 1.5668 \times 0.5120 = 0.8022$$
$$W(0, 1) = 1.5668 \times 1^3 = 1.5668 \quad \text{(self-contribution)}$$

**Step 3:** Compute density for particle 1:

$$\rho_1 = m_1 W(0) + m_2 W(0.25) + m_3 W(0.25) = 1.5668 + 0.6609 + 0.6609 = 2.8886$$

**Step 4:** Densities for all particles:

$$\rho_1 = 1.5668 + 0.6609 + 0.6609 = 2.8886$$
$$\rho_2 = 0.6609 + 1.5668 + 0.8022 = 3.0299$$
$$\rho_3 = 0.6609 + 0.8022 + 1.5668 = 3.0299$$

Particles 2 and 3 have higher density because they are closer to each other ($|r_{23}|^2 = 0.20 < 0.25$), meaning more overlap.

## Recent Developments

### DFSPH and IISPH (2015-2024)

**Divergence-Free SPH** (Bender & Koschier, 2015) and **Implicit Incompressible SPH** (Ihmsen et al., 2014) dramatically improve incompressibility enforcement. DFSPH solves both a density constraint and a divergence-free constraint, achieving near-perfect incompressibility with minimal iteration.

### GPU-Accelerated Frameworks (2024)

Modern SPH frameworks leverage CUDA and Taichi for GPU parallelism, handling millions of particles in real time. The SPlisHSPlasH library (Bender et al.) provides a comprehensive open-source reference implementation with WCSPH, PCISPH, DFSPH, and IISPH solvers.

### Neural Fluid Simulation (2023-2025)

Machine learning approaches are increasingly used to either accelerate pressure solves or learn fluid dynamics end-to-end. Graph neural network-based particle methods can generalize across fluid scenarios, though accuracy remains below traditional solvers for production use.

<details>
<summary>Exercise 1: Implement 2D SPH dam break</summary>

Create a 2D SPH simulation with ~200 particles:

1. Initialize particles in a rectangular block on the left side of a box
2. Apply gravity, pressure, and viscosity forces using the kernels described above
3. Use symplectic Euler integration
4. Add boundary particles (fixed, high-mass) along the walls

Use parameters: $h = 0.04$, $\rho_0 = 1000$, $k = 2000$, $\mu = 1.0$, $\Delta t = 0.001$.

**Hint:** The neighbor search is the bottleneck. Use a spatial hash grid with cell size $h$ for $O(n)$ neighbor queries.
</details>

<details>
<summary>Exercise 2: Stable Fluids on a 64x64 grid</summary>

Implement the full Stable Fluids algorithm on a 2D MAC grid:

1. Add a density source (e.g., at the bottom center)
2. Apply buoyancy force proportional to density: $f_y = \alpha \cdot \rho'$
3. Use 50 Gauss-Seidel iterations for the pressure solve
4. Visualize the density field as a grayscale image

Verify that smoke rises and swirls naturally. The simulation should remain stable even at large timesteps.
</details>

<details>
<summary>Exercise 3: Compare SPH kernel functions</summary>

For a 1D arrangement of 5 equally spaced particles (spacing $= 0.2h$), compute:

1. The density using poly6 kernel
2. The pressure gradient magnitude using spiky kernel
3. The viscous force using viscosity kernel

Plot each kernel function and its relevant derivative over $[0, h]$. Observe that poly6 has zero gradient at $r=0$ (good for density), while spiky has a strong gradient at $r=0$ (good for repulsion).
</details>

## Key Takeaways

- The **Navier-Stokes equations** describe incompressible fluid motion: advection + pressure + viscosity + external forces
- **SPH** approximates continuous fields via weighted particle sums using kernel functions (poly6, spiky, viscosity) — each chosen for specific mathematical properties
- The **MAC staggered grid** avoids pressure decoupling; **semi-Lagrangian advection** provides unconditional stability
- **Stable Fluids** (Stam, 1999) splits the timestep into forces, diffusion, advection, and projection — each stage handled by a stable method
- **Position-Based Fluids** (Macklin & Muller, 2013) brings PBD's robustness to fluid simulation via density constraints
- Modern SPH variants (DFSPH, IISPH) achieve near-perfect incompressibility with GPU acceleration handling millions of particles

**References:**
- Muller, M. et al., "Particle-Based Fluid Simulation for Interactive Applications," SCA (2003)
- Stam, J., "Stable Fluids," SIGGRAPH (1999)
- Macklin, M. & Muller, M., "Position Based Fluids," ACM TOG (2013)
- Bender, J. & Koschier, D., "Divergence-Free Smoothed Particle Hydrodynamics," SCA (2015)
- Harlow, F. & Welch, J., "Numerical Calculation of Time-Dependent Viscous Incompressible Flow," Physics of Fluids (1965)
- SPlisHSPlasH — github.com/InteractiveComputerGraphics/SPlisHSPlasH
