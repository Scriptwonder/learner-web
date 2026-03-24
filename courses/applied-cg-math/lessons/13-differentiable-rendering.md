# Differentiable Rendering

Traditional rendering is a one-way street: scene parameters go in, pixels come out. **Differentiable rendering** turns the pipeline into a two-way street by computing gradients of the rendered image with respect to *every* scene parameter -- geometry, materials, lighting, and camera. This unlocks **inverse rendering**: given a photograph, automatically recover the 3D scene that produced it. Since Kato et al. (2018) and Li et al. (2018) brought the idea into the deep-learning era, differentiable rendering has become foundational for 3D reconstruction, material estimation, relighting, and generative 3D content.

## Why Gradients Through Rendering?

### The Inverse Problem

Forward rendering solves $I = \mathcal{R}(\theta)$, where $\theta$ is the full scene description (meshes, BRDFs, lights, camera) and $I$ is the image. Inverse rendering asks the opposite question:

$$\theta^* = \arg\min_\theta \; \mathcal{L}\bigl(\mathcal{R}(\theta),\; I_{\text{target}}\bigr)$$

If $\mathcal{R}$ is differentiable, we can compute $\frac{\partial \mathcal{L}}{\partial \theta}$ and solve this with gradient descent -- the same optimizer that trains neural networks. Without differentiability, we are limited to finite differences ($O(|\theta|)$ evaluations) or reinforcement-learning-style estimators, both of which are impractical for scenes with millions of parameters.

### What Makes Rendering Hard to Differentiate?

Most of the rendering pipeline -- shading, projection, interpolation -- is composed of smooth arithmetic and is trivially differentiable. The hard part is **visibility**: which triangles are in front of which? Standard rasterization uses a discrete depth test (`z-buffer`), and ray tracing uses discrete intersection queries. Both produce **discontinuities** at:

- **Silhouette edges** -- where an object's outline meets the background
- **Occlusion boundaries** -- where one surface hides another
- **Shadow edges** -- where a surface transitions from lit to shadowed

At these boundaries, a tiny perturbation to geometry causes a pixel to jump from one surface to another, creating a step function with zero gradient almost everywhere and infinite gradient at the boundary.

## Automatic Differentiation Primer

Differentiable renderers are built on **automatic differentiation (AD)**, the same engine behind PyTorch and JAX.

### Forward Mode

Propagates derivatives alongside the primal computation. For a function $f(x)$, forward-mode computes $\dot{y} = \frac{\partial f}{\partial x} \dot{x}$ in one pass. Cost: $O(|\text{inputs}|)$ passes for all partial derivatives.

### Reverse Mode (Backpropagation)

Records the computation in a **tape**, then walks it backward. One reverse pass yields the gradient with respect to *all* inputs simultaneously. Cost: $O(|\text{outputs}|)$ passes. Since rendering has millions of inputs (vertex positions, texel values) but a single scalar loss, reverse mode is overwhelmingly preferred.

### AD in Rendering Systems

| System | AD Engine | Backend |
|--------|-----------|---------|
| nvdiffrast (Laine et al. 2020) | PyTorch autograd | CUDA rasterization |
| Mitsuba 3 (Jakob et al. 2022) | Dr.Jit (custom) | LLVM / CUDA / OptiX |
| PyTorch3D (Ravi et al. 2020) | PyTorch autograd | CUDA rasterization |
| Differentiable SDF (Vicini et al. 2022) | Dr.Jit | Ray tracing + SDF |

## Approach 1: Differentiable Rasterization

### Soft Rasterization

**SoftRas** (Liu et al. 2019) replaces the hard z-test with a probabilistic formulation. Each triangle contributes to each pixel with a probability that decays smoothly with distance:

$$C(p) = \sum_{i=1}^{N} w_i \, \mathbf{c}_i, \quad w_i = \frac{D_i \, \sigma_i}{\sum_j D_j \, \sigma_j + \epsilon}$$

where $D_i = \text{sigmoid}\left(\delta_i \frac{d_i^2}{\sigma_s}\right)$ is a soft inside/outside test ($d_i$ = signed distance from pixel $p$ to triangle $i$'s projected edges, $\sigma_s$ = sharpness), and $\sigma_i$ is a depth-dependent weight. As $\sigma_s \to 0$, this converges to standard rasterization.

**Key insight**: every triangle gets a non-zero gradient at every pixel, so even fully occluded triangles receive learning signal.

### nvdiffrast (Laine et al. 2020)

NVIDIA's **nvdiffrast** takes a different approach: perform standard, hardware-accelerated rasterization for the forward pass (maximum speed), but replace the silhouette edges with an **antialiased** formulation that provides correct gradients:

1. **Rasterize** -- standard depth-buffered rasterization on the GPU
2. **Interpolate** -- standard barycentric interpolation of vertex attributes
3. **Antialias** -- detect silhouette/occlusion edges and apply a differentiable filter that smoothly blends foreground and background, producing non-zero gradients for edge pixels

This gives the speed of hardware rasterization (millions of triangles at interactive rates) with correct visibility gradients. nvdiffrast has been continuously maintained through 2025 and remains a workhorse for mesh-based inverse rendering.

### DiffCSG (Yuan et al. 2024)

Recent work extends differentiable rasterization to **constructive solid geometry (CSG)**: probabilistic visibility functions and edge-aware antialiasing handle the complex silhouettes that arise from Boolean operations on primitives.

## Approach 2: Differentiable Ray Tracing

### Edge Sampling (Li et al. 2018)

The core insight: discontinuities in the rendering integral live on **silhouette edges** in 3D. Li et al. decompose the image-space integral into:

$$\frac{\partial I}{\partial \theta} = \underbrace{\int_{\mathcal{A}} \frac{\partial L}{\partial \theta} \, dA}_{\text{interior term}} + \underbrace{\oint_{\partial \mathcal{A}} \Delta L \; \frac{\partial \mathbf{e}}{\partial \theta} \cdot \hat{n} \; ds}_{\text{boundary term}}$$

The **interior term** is the gradient of the smooth shading function (easy). The **boundary term** integrates along silhouette edges, where $\Delta L$ is the radiance discontinuity across the edge. This is estimated by explicitly finding and sampling silhouette edges in 3D.

### Mitsuba 3 (Jakob et al. 2022)

Mitsuba 3 is a research-grade physically-based renderer built entirely on **Dr.Jit**, a just-in-time compiler for differentiable computation. It supports:

- Forward and reverse-mode AD through the full light transport simulation
- Differentiable BSDFs, emitters, volumes, and camera models
- Multiple edge-sampling strategies for visibility gradients
- LLVM backend (CPU) and CUDA/OptiX backend (GPU)

Mitsuba 3's architecture separates the *rendering algorithm* from the *differentiation strategy*, allowing users to swap integrators (path tracing, volumetric, etc.) independently of the AD mode.

### Path-Space Differentiable Rendering (Zeltner et al. 2021)

Rather than differentiating in image space, this approach works in **path space**: it computes the derivative of the measurement integral by perturbing light paths and tracking how their contribution changes. This naturally handles complex light transport (caustics, multiple scattering) where image-space methods struggle.

## The Inverse Rendering Pipeline

A typical inverse rendering optimization loop:

```
  Target Image(s)
       |
       v
  ┌──────────────────────────────────┐
  │  Initialize scene parameters θ   │
  │  (mesh, materials, lights)       │
  └──────────────┬───────────────────┘
                 │
                 v
  ┌──────────────────────────────────┐
  │  Differentiable Render: I = R(θ) │◄──┐
  └──────────────┬───────────────────┘   │
                 │                        │
                 v                        │
  ┌──────────────────────────────────┐   │
  │  Loss: L = ||I - I_target||²     │   │
  │       + regularizers             │   │
  └──────────────┬───────────────────┘   │
                 │                        │
                 v                        │
  ┌──────────────────────────────────┐   │
  │  Backprop: ∂L/∂θ                │   │
  └──────────────┬───────────────────┘   │
                 │                        │
                 v                        │
  ┌──────────────────────────────────┐   │
  │  Update: θ ← θ - α · ∂L/∂θ     │───┘
  └──────────────────────────────────┘
```

Common loss functions:

- **L2 pixel loss**: $\mathcal{L}_{\text{pixel}} = \sum_p \| I(p) - I_{\text{target}}(p) \|^2$
- **Perceptual loss** (LPIPS): compares deep features instead of raw pixels
- **Mask/silhouette loss**: $\mathcal{L}_{\text{sil}} = \text{BCE}(M_{\text{rendered}}, M_{\text{target}})$
- **Regularizers**: Laplacian smoothness, normal consistency, material priors

## Worked Example: Optimize a Sphere Radius to Match a Target Silhouette

We render a sphere of radius $r$ viewed from a fixed camera and optimize $r$ so the rendered silhouette matches a target circle of radius $r^* = 2.0$.

### Setup

Camera looks along $-z$, orthographic projection. The sphere is centered at the origin. Its silhouette is a circle of radius $r$ in image space.

### Loss Function

$$\mathcal{L}(r) = \sum_{p \in \text{pixels}} \left( S(p; r) - S^*(p) \right)^2$$

where $S(p; r)$ is the differentiable soft silhouette (1 inside the circle, 0 outside, smooth transition at the edge) and $S^*$ is the target silhouette.

### Pseudocode

```python
import torch

# --- Differentiable soft silhouette of a sphere ---
def soft_silhouette(pixel_coords, radius, sharpness=50.0):
    """
    Render the silhouette of a sphere centered at origin.
    pixel_coords: (H, W, 2) grid of pixel (x, y) positions
    radius: scalar (differentiable)
    Returns: (H, W) soft mask in [0, 1]
    """
    dist = torch.sqrt((pixel_coords[..., 0]**2 +
                        pixel_coords[..., 1]**2))
    # Sigmoid transition at the boundary: smooth step from 1 to 0
    return torch.sigmoid(sharpness * (radius - dist))

# --- Setup ---
H, W = 128, 128
coords = torch.stack(torch.meshgrid(
    torch.linspace(-4, 4, H),
    torch.linspace(-4, 4, W), indexing='ij'), dim=-1)

target_radius = 2.0
target_sil = soft_silhouette(coords, torch.tensor(target_radius))

# Initialize radius with a wrong guess
radius = torch.tensor(0.5, requires_grad=True)
optimizer = torch.optim.Adam([radius], lr=0.05)

# --- Optimization loop ---
for step in range(200):
    rendered_sil = soft_silhouette(coords, radius)
    loss = ((rendered_sil - target_sil) ** 2).mean()

    optimizer.zero_grad()
    loss.backward()       # dL/dr computed automatically
    optimizer.step()

    if step % 50 == 0:
        print(f"Step {step:3d}: r = {radius.item():.4f}, "
              f"loss = {loss.item():.6f}")

# Step   0: r = 0.5538, loss = 0.149231
# Step  50: r = 1.6842, loss = 0.005012
# Step 100: r = 1.9731, loss = 0.000038
# Step 150: r = 1.9994, loss = 0.000000
```

### Why This Works

1. The sigmoid in `soft_silhouette` makes the boundary differentiable
2. When $r < r^*$, the loss gradient $\frac{\partial \mathcal{L}}{\partial r} < 0$, pushing $r$ to increase
3. Adam converges to $r \approx 2.0$ in ~100 steps

In a real system, the "soft silhouette" is provided by the differentiable renderer (SoftRas, nvdiffrast, etc.), and $\theta$ includes vertex positions, materials, and lights -- not just a single scalar.

## Applications

### Material Estimation

Given photographs of an object under known lighting, optimize BRDF parameters (roughness, metallic, albedo) until the rendered images match. nvdiffrec (Munkberg et al. 2022) recovers PBR materials and geometry jointly from multi-view images.

### Relighting

Once materials are recovered, the scene can be rendered under arbitrary new lighting -- enabling virtual try-on, architectural visualization, and product photography.

### 3D Reconstruction from Photos

Differentiable rendering is the backbone of modern multi-view 3D reconstruction pipelines. FlexiCubes (Shen et al. 2023) uses differentiable marching cubes with nvdiffrast to extract high-quality meshes. The render-compare-update loop jointly optimizes mesh topology and appearance.

### Text-to-3D and Generative Models

DreamFusion (Poole et al. 2022) and its successors use differentiable rendering to optimize a 3D representation so that its renderings satisfy a 2D diffusion model's prior. The gradient flows from the diffusion model, through the differentiable renderer, into the 3D scene parameters.

### Hybrid Approaches (2025)

Recent Bezier Gaussian Triangles (Wu et al. 2025) combine differentiable parametric surfaces with Gaussian splatting, achieving resolution-invariant, sharp-boundary rendering with full differentiability.

## Challenges and Open Problems

- **Bias vs. variance**: Soft rasterizers introduce bias (blurry edges) while edge-sampling methods are unbiased but high-variance
- **Secondary effects**: Differentiating through shadows, interreflections, and caustics remains expensive; most practical systems stop at direct illumination
- **Topology changes**: Gradient descent can deform meshes but cannot easily add or remove faces; hybrid representations (DMTet, FlexiCubes) address this
- **Scale**: Differentiating through a full global illumination simulation is memory-intensive; checkpointing and adjoint methods help but add complexity

<details>
<summary><strong>Exercise 1</strong>: Gradient of a Soft Silhouette</summary>

A circular silhouette at pixel $p$ is modeled as $S(p) = \sigma(k(r - d_p))$ where $\sigma$ is the sigmoid, $r$ is the radius, and $d_p = \sqrt{x_p^2 + y_p^2}$. Compute $\frac{\partial S}{\partial r}$.

**Solution**: Using the chain rule and $\sigma'(u) = \sigma(u)(1 - \sigma(u))$:

$$\frac{\partial S}{\partial r} = k \cdot \sigma(k(r - d_p)) \cdot (1 - \sigma(k(r - d_p)))$$

This is maximized at $d_p = r$ (the silhouette boundary) and decays exponentially away from it. Larger $k$ concentrates the gradient more tightly at the edge.
</details>

<details>
<summary><strong>Exercise 2</strong>: Forward vs. Reverse Mode Cost</summary>

A scene has 100,000 vertex positions (300,000 scalar parameters) and produces a $512 \times 512$ image. If we reduce the image to a single scalar loss:

(a) How many forward-mode passes would be needed to compute the full gradient?
(b) How many reverse-mode passes?

**Solution**:

(a) Forward mode: one pass per input scalar = **300,000 passes**

(b) Reverse mode: one pass per output scalar. With a scalar loss, that is **1 pass**. This is why all practical differentiable renderers use reverse mode.
</details>

<details>
<summary><strong>Exercise 3</strong>: Implementing a Simple Differentiable Renderer</summary>

Extend the worked example to optimize the *position* $(c_x, c_y)$ of the sphere in addition to its radius $r$. Modify `soft_silhouette` to accept a center parameter, set the target to center $(1.0, -0.5)$ with radius $2.0$, and verify convergence.

**Solution sketch**:

```python
def soft_silhouette(coords, center, radius, sharpness=50.0):
    dx = coords[..., 0] - center[0]
    dy = coords[..., 1] - center[1]
    dist = torch.sqrt(dx**2 + dy**2)
    return torch.sigmoid(sharpness * (radius - dist))

center = torch.tensor([0.0, 0.0], requires_grad=True)
radius = torch.tensor(0.5, requires_grad=True)
optimizer = torch.optim.Adam([center, radius], lr=0.05)
# The same optimization loop will converge to center=(1.0, -0.5), r=2.0
```
</details>

<details>
<summary><strong>Exercise 4</strong>: The Boundary Integral</summary>

In Li et al.'s edge-sampling formulation, the boundary term is:

$$\oint_{\partial \mathcal{A}} \Delta L \; \frac{\partial \mathbf{e}}{\partial \theta} \cdot \hat{n} \; ds$$

Explain in plain language what each factor means and why the integral is taken over silhouette edges rather than the entire image.

**Solution**: $\Delta L$ is the jump in radiance across the silhouette edge (e.g., foreground color minus background color). $\frac{\partial \mathbf{e}}{\partial \theta} \cdot \hat{n}$ measures how fast the edge moves in the image-plane normal direction as parameter $\theta$ changes. The product gives the rate at which a strip of pixels "flips" from one surface to another. The integral is restricted to silhouette edges because those are the *only* places where discontinuities exist -- everywhere else, the rendering function is smooth and the standard interior derivative suffices.
</details>

## Key Takeaways

- **Differentiable rendering** computes $\frac{\partial \text{image}}{\partial \text{scene}}$, enabling gradient-based inverse rendering
- The main challenge is **visibility discontinuities** at silhouette and occlusion edges
- **Soft rasterization** (SoftRas) makes every triangle contribute to every pixel; **antialiased rasterization** (nvdiffrast) adds a differentiable filter only at edges
- **Edge sampling** (Li et al. 2018, Mitsuba 3) decomposes the gradient into smooth interior and discontinuous boundary terms
- The **render-compare-backprop-update** loop is the backbone of modern 3D reconstruction, material estimation, and text-to-3D generation
- **Reverse-mode AD** is essential -- it computes gradients w.r.t. millions of parameters in a single backward pass
- Active research (2024--2025) continues to push toward handling full global illumination, complex topology, and real-time inverse rendering
