# Numerical Integration for Physics Simulation

Simulating physical systems means solving **ordinary differential equations** (ODEs) over time. The choice of numerical integrator determines accuracy, stability, and energy conservation — all critical for believable real-time physics.

## The ODE Initial Value Problem

Most physics simulations reduce to solving an initial value problem (IVP):

$$\frac{d\mathbf{x}}{dt} = f(\mathbf{x}, t), \quad \mathbf{x}(t_0) = \mathbf{x}_0$$

where $\mathbf{x}$ is the **state vector** (position, velocity, etc.) and $f$ describes how the state evolves. For a particle under force:

$$\frac{dx}{dt} = v, \quad \frac{dv}{dt} = \frac{F(x,t)}{m}$$

We march forward in discrete timesteps $\Delta t$, producing a sequence $\mathbf{x}_0, \mathbf{x}_1, \mathbf{x}_2, \ldots$ that approximates the true continuous trajectory.

## Explicit (Forward) Euler

The simplest integrator. Evaluate the derivative at the current state and step forward:

$$\mathbf{x}_{n+1} = \mathbf{x}_n + \Delta t \cdot f(\mathbf{x}_n, t_n)$$

For a particle with position $x$ and velocity $v$:

$$v_{n+1} = v_n + \Delta t \cdot \frac{F(x_n, t_n)}{m}$$
$$x_{n+1} = x_n + \Delta t \cdot v_n$$

### Error Analysis

The **local truncation error** (per-step) is $O(\Delta t^2)$, making it a **first-order** method. Over $N = T/\Delta t$ steps the **global error** accumulates to $O(\Delta t)$.

Taylor expansion reveals why:

$$x(t + \Delta t) = x(t) + \Delta t \cdot x'(t) + \frac{\Delta t^2}{2} x''(t) + \cdots$$

Euler keeps only the first two terms, discarding the $O(\Delta t^2)$ remainder each step.

### The Energy Problem

For conservative systems (e.g., orbits, springs), explicit Euler **adds energy** over time. A circular orbit spirals outward. This is the fundamental reason it is unsuitable for long-running simulations.

```python
def euler_step(x, v, dt, force_fn, m):
    """Explicit Euler integrator."""
    a = force_fn(x) / m
    v_new = v + dt * a
    x_new = x + dt * v
    return x_new, v_new
```

## Symplectic Euler (Semi-Implicit Euler)

A small but critical change: update velocity **first**, then use the **new** velocity to update position:

$$v_{n+1} = v_n + \Delta t \cdot \frac{F(x_n, t_n)}{m}$$
$$x_{n+1} = x_n + \Delta t \cdot v_{n+1}$$

This is still first-order accurate, but it is **symplectic** — it preserves the symplectic structure of Hamiltonian systems. In practice this means:

- Energy oscillates around the true value but does **not** drift
- Orbits remain closed (slightly distorted ellipses instead of spirals)
- Phase-space volume is conserved

The symplectic Euler is the default choice in most real-time physics engines (Box2D, Bullet) due to its excellent stability-to-cost ratio (Catto, GDC 2006).

```python
def symplectic_euler_step(x, v, dt, force_fn, m):
    """Symplectic (semi-implicit) Euler integrator."""
    a = force_fn(x) / m
    v_new = v + dt * a
    x_new = x + dt * v_new  # uses updated velocity
    return x_new, v_new
```

## Verlet Integration

### Basic (Störmer) Verlet

The original Verlet method (Störmer, 1907; Verlet, 1967) works directly with positions — no explicit velocity variable:

$$x_{n+1} = 2x_n - x_{n-1} + \Delta t^2 \cdot \frac{F(x_n)}{m}$$

**Derivation:** Add the forward and backward Taylor expansions:

$$x(t + \Delta t) = x(t) + \Delta t \cdot v + \frac{\Delta t^2}{2} a + \frac{\Delta t^3}{6} j + O(\Delta t^4)$$
$$x(t - \Delta t) = x(t) - \Delta t \cdot v + \frac{\Delta t^2}{2} a - \frac{\Delta t^3}{6} j + O(\Delta t^4)$$

Summing cancels the odd-order terms:

$$x(t + \Delta t) + x(t - \Delta t) = 2x(t) + \Delta t^2 a + O(\Delta t^4)$$

This is **second-order** accurate ($O(\Delta t^2)$ global error) and symplectic.

**Strengths:** Velocity-free formulation, time-reversible, excellent for particle systems.

**Weakness:** Velocity is only implicitly available as $v_n \approx (x_{n+1} - x_{n-1}) / (2\Delta t)$, which is inconvenient when you need it for damping or rendering.

```python
def stormer_verlet_step(x_curr, x_prev, dt, force_fn, m):
    """Störmer-Verlet (position-based, velocity-free)."""
    a = force_fn(x_curr) / m
    x_next = 2 * x_curr - x_prev + dt**2 * a
    return x_next, x_curr  # returns (new position, previous position)
```

### Velocity Verlet

The most popular variant. Maintains an explicit velocity and achieves second-order accuracy:

$$x_{n+1} = x_n + \Delta t \cdot v_n + \frac{\Delta t^2}{2} a_n$$
$$a_{n+1} = \frac{F(x_{n+1})}{m}$$
$$v_{n+1} = v_n + \frac{\Delta t}{2} (a_n + a_{n+1})$$

This is mathematically equivalent to Störmer-Verlet but gives velocity at each step. It is also symplectic and time-reversible.

```python
def velocity_verlet_step(x, v, a, dt, force_fn, m):
    """Velocity Verlet integrator."""
    x_new = x + dt * v + 0.5 * dt**2 * a
    a_new = force_fn(x_new) / m
    v_new = v + 0.5 * dt * (a + a_new)
    return x_new, v_new, a_new
```

## Runge-Kutta 4 (RK4)

The classic fourth-order method. It evaluates the derivative at **four** carefully chosen points per timestep, achieving $O(\Delta t^4)$ global accuracy.

### Full Derivation

Given $\mathbf{y}' = f(\mathbf{y}, t)$, one step of RK4 computes:

$$k_1 = f(\mathbf{y}_n,\; t_n)$$
$$k_2 = f\!\left(\mathbf{y}_n + \frac{\Delta t}{2} k_1,\; t_n + \frac{\Delta t}{2}\right)$$
$$k_3 = f\!\left(\mathbf{y}_n + \frac{\Delta t}{2} k_2,\; t_n + \frac{\Delta t}{2}\right)$$
$$k_4 = f(\mathbf{y}_n + \Delta t \cdot k_3,\; t_n + \Delta t)$$

$$\mathbf{y}_{n+1} = \mathbf{y}_n + \frac{\Delta t}{6}\left(k_1 + 2k_2 + 2k_3 + k_4\right)$$

**Why these weights?** The coefficients $(1, 2, 2, 1)/6$ come from matching the Taylor expansion through the fourth-order term. $k_1$ samples the start, $k_2$ and $k_3$ both sample the midpoint (each using the other's estimate), and $k_4$ samples the end. The Simpson's-rule-like weighting achieves fourth-order accuracy with only four function evaluations — an optimal balance.

### Implementation for a Spring-Mass System

For state $\mathbf{y} = [x, v]^T$ with spring force $F = -kx - cv$:

```python
import numpy as np

def rk4_step(y, t, dt, deriv_fn):
    """Classic Runge-Kutta 4 integrator.
    y: state vector, t: current time, dt: timestep
    deriv_fn(y, t) -> dy/dt
    """
    k1 = deriv_fn(y, t)
    k2 = deriv_fn(y + 0.5 * dt * k1, t + 0.5 * dt)
    k3 = deriv_fn(y + 0.5 * dt * k2, t + 0.5 * dt)
    k4 = deriv_fn(y + dt * k3, t + dt)
    return y + (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)

def spring_deriv(y, t, k=10.0, c=0.0, m=1.0):
    """Derivative for spring-mass: F = -kx - cv."""
    x, v = y[0], y[1]
    a = (-k * x - c * v) / m
    return np.array([v, a])
```

### Trade-offs

RK4 is extremely accurate for smooth force fields, but it is **not symplectic**. For periodic systems (orbits, undamped springs), it slowly loses energy over long simulations. It also costs 4 force evaluations per step — 4x the cost of Euler.

## Stability Analysis

### The Test Equation

Stability is analyzed using the scalar test equation:

$$\frac{dy}{dt} = \lambda y, \quad \lambda \in \mathbb{C}$$

An integrator applied to this equation produces $y_{n+1} = R(z) \cdot y_n$ where $z = \lambda \Delta t$ and $R(z)$ is the **amplification factor**. The method is stable when $|R(z)| \leq 1$.

### Amplification Factors

| Method | $R(z)$ | Order |
|--------|---------|-------|
| Explicit Euler | $1 + z$ | 1 |
| Symplectic Euler | depends on formulation | 1 |
| RK4 | $1 + z + \frac{z^2}{2} + \frac{z^3}{6} + \frac{z^4}{24}$ | 4 |

For a spring with $\lambda = i\omega$ (purely imaginary), explicit Euler gives $|R| = |1 + i\omega\Delta t| = \sqrt{1 + \omega^2\Delta t^2} > 1$ — **always unstable**. This is why explicit Euler spirals outward for undamped oscillators.

Symplectic Euler applied to the spring gives $|R| = 1$ exactly — energy is conserved to machine precision for the test equation.

RK4 gives $|R(i\omega\Delta t)|$ that is very close to 1 but not exactly, leading to slow energy drift.

### Practical Stability Limit

For explicit methods with real negative $\lambda$ (damped systems), the critical timestep is:

$$\Delta t < \frac{2}{|\lambda|}$$

For a stiff spring with $\omega = \sqrt{k/m}$, the stability limit is approximately $\Delta t < 2/\omega$. Exceeding this causes the simulation to **explode**.

## Timestep Selection

### Fixed vs. Adaptive

**Fixed timestep** is standard in games (e.g., 1/60 s or 1/120 s). Advantages: deterministic, reproducible, simple.

**Adaptive timestep** (used in scientific computing) estimates the local error and adjusts $\Delta t$ accordingly. The embedded RK methods (e.g., Dormand-Prince / RK45) compute two estimates of different orders and use their difference as an error estimate.

### CFL Condition

For wave-like phenomena, the Courant-Friedrichs-Lewy (CFL) condition bounds the timestep:

$$\Delta t \leq \frac{\Delta x}{c}$$

where $\Delta x$ is spatial resolution and $c$ is wave speed. Violating CFL causes information to propagate faster than the grid can track.

### Substeps

Games often use **substeps** — running physics at a higher rate than rendering. If the display is 60 Hz, physics might run at 240 Hz (4 substeps per frame) for stability with stiff constraints.

## Worked Example: Spring-Mass Energy Comparison

A mass $m=1$ on a spring with $k=10$, starting at $x_0=1, v_0=0$. The exact solution is $x(t) = \cos(\omega t)$ where $\omega = \sqrt{10} \approx 3.162$.

The total energy should remain constant at $E = \frac{1}{2}kx_0^2 = 5.0$.

```python
import numpy as np

# Parameters
k, m, x0, v0 = 10.0, 1.0, 1.0, 0.0
dt = 0.05
steps = 2000  # 100 seconds
omega = np.sqrt(k / m)

def spring_force(x):
    return -k * x

def compute_energy(x, v):
    return 0.5 * k * x**2 + 0.5 * m * v**2

# --- Explicit Euler ---
x, v = x0, v0
euler_energy = []
for _ in range(steps):
    euler_energy.append(compute_energy(x, v))
    a = spring_force(x) / m
    x, v = x + dt * v, v + dt * a

# --- Symplectic Euler ---
x, v = x0, v0
symp_energy = []
for _ in range(steps):
    symp_energy.append(compute_energy(x, v))
    a = spring_force(x) / m
    v = v + dt * a
    x = x + dt * v

# --- Velocity Verlet ---
x, v = x0, v0
a = spring_force(x) / m
verlet_energy = []
for _ in range(steps):
    verlet_energy.append(compute_energy(x, v))
    x_new = x + dt * v + 0.5 * dt**2 * a
    a_new = spring_force(x_new) / m
    v = v + 0.5 * dt * (a + a_new)
    x, a = x_new, a_new

# --- RK4 ---
y = np.array([x0, v0])
rk4_energy = []
for i in range(steps):
    rk4_energy.append(compute_energy(y[0], y[1]))
    t = i * dt
    def deriv(y, t):
        return np.array([y[1], -k * y[0] / m])
    k1 = deriv(y, t)
    k2 = deriv(y + 0.5*dt*k1, t + 0.5*dt)
    k3 = deriv(y + 0.5*dt*k2, t + 0.5*dt)
    k4 = deriv(y + dt*k3, t + dt)
    y = y + (dt/6) * (k1 + 2*k2 + 2*k3 + k4)

# Results after 100 seconds:
print(f"Explicit Euler:   E = {euler_energy[-1]:.4f}  (drifts UP)")
print(f"Symplectic Euler: E = {symp_energy[-1]:.4f}  (oscillates)")
print(f"Velocity Verlet:  E = {verlet_energy[-1]:.4f}  (oscillates)")
print(f"RK4:              E = {rk4_energy[-1]:.4f}  (slow drift DOWN)")
```

**Typical output** (dt=0.05, after 100 s):
- **Explicit Euler:** Energy grows exponentially — simulation explodes
- **Symplectic Euler:** Energy oscillates within ~0.06 of $E_0 = 5.0$
- **Velocity Verlet:** Energy oscillates within ~0.003 of $E_0 = 5.0$
- **RK4:** Energy decays slowly, losing ~0.0001 per 100 seconds

## Choosing an Integrator

| Use Case | Recommended | Why |
|----------|------------|-----|
| Game physics (general) | Symplectic Euler | Cheap, stable, energy-conserving |
| Cloth / particles | Verlet / Velocity Verlet | Position-based, second-order |
| Orbital mechanics | Velocity Verlet | Symplectic + second-order |
| Smooth external forces | RK4 | High accuracy for non-stiff systems |
| Stiff systems (springs) | Implicit Euler or substeps | Unconditional stability |

<details>
<summary>Exercise 1: Implement a leapfrog integrator</summary>

The **leapfrog** method staggers velocity by half a timestep:

$$v_{n+1/2} = v_{n-1/2} + \Delta t \cdot a_n$$
$$x_{n+1} = x_n + \Delta t \cdot v_{n+1/2}$$

Implement this for the spring-mass system. Verify that it is equivalent to Störmer-Verlet and produces the same energy behavior.

**Hint:** To initialize, compute $v_{1/2} = v_0 + \frac{\Delta t}{2} a_0$.
</details>

<details>
<summary>Exercise 2: Stability boundary of explicit Euler</summary>

For the test equation $y' = \lambda y$ with $\lambda = -100$ (a stiff system):

1. What is the maximum stable timestep for explicit Euler?
2. Verify numerically that $\Delta t = 0.019$ is stable but $\Delta t = 0.021$ diverges.

**Solution:** The stability region of explicit Euler is $|1 + z| \leq 1$ where $z = \lambda \Delta t$. For real negative $\lambda$: $|1 + \lambda \Delta t| \leq 1 \Rightarrow -2 \leq \lambda \Delta t \leq 0$, so $\Delta t \leq 2/|\lambda| = 0.02$.
</details>

<details>
<summary>Exercise 3: RK4 for a pendulum</summary>

A simple pendulum with $\theta'' = -(g/L)\sin\theta$. Set $g = 9.81$, $L = 1$, $\theta_0 = \pi/4$, $\omega_0 = 0$.

Use RK4 with $\Delta t = 0.01$ to simulate 10 seconds. Plot $\theta(t)$ and total energy $E = \frac{1}{2}mL^2\omega^2 - mgL\cos\theta$.

**Hint:** State vector is $[\theta, \omega]^T$. The derivative function returns $[\omega, -(g/L)\sin\theta]^T$.
</details>

## Key Takeaways

- **Explicit Euler** is simple but first-order and adds energy — avoid for anything long-running
- **Symplectic Euler** is the game industry workhorse: same cost as Euler, but preserves phase-space structure
- **Velocity Verlet** is second-order and symplectic — ideal for particle systems and molecular dynamics
- **RK4** is fourth-order accurate but not symplectic — best for smooth, non-oscillatory problems
- Always check that your timestep satisfies the **stability limit** $\Delta t < 2/\omega$ for the stiffest frequency in your system
- When in doubt, use substeps rather than switching to a higher-order method

**References:**
- Hairer, Lubich & Wanner, *Geometric Numerical Integration* (2006)
- Verlet, L., "Computer experiments on classical fluids" (1967)
- Glenn Fiedler, *Integration Basics* — gafferongames.com
- Erin Catto, *Sequential Impulses*, GDC (2006)
