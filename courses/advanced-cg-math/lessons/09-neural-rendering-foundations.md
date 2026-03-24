# Neural Rendering Foundations

Traditional rendering is a one-way street: you set up geometry, materials, lights, and camera, then the pipeline produces pixels. But what if you could run it *backwards* — start with photographs and recover the 3D scene? That is the core promise of **neural rendering**: making the rendering pipeline differentiable so that gradients can flow from pixel errors back to scene parameters. This lesson builds the mathematical machinery that Neural Radiance Fields and 3D Gaussian Splatting depend on.

## What Is Neural Rendering?

Neural rendering sits at the intersection of classical computer graphics and deep learning. The term encompasses any technique that:

1. Represents scenes (geometry, appearance, or both) using neural networks or learned parameters
2. Renders images through a **differentiable** process
3. Optimizes scene parameters by minimizing a loss between rendered and observed images

The key insight is **differentiability**. If every operation in the rendering pipeline has a well-defined gradient, then we can use gradient descent to solve *inverse rendering* — recovering geometry, materials, and lighting from photographs.

## The Differentiable Rendering Pipeline

A classical rasterization pipeline looks like this:

$$\text{3D Scene} \xrightarrow{\text{Vertex Transform}} \xrightarrow{\text{Rasterize}} \xrightarrow{\text{Fragment Shade}} \text{Image}$$

To make this differentiable, every stage must support backpropagation:

### Stage 1: Scene Representation

The scene is parameterized by a vector $\theta$ (network weights, point positions, Gaussian parameters, etc.). This is what we optimize.

### Stage 2: Differentiable Projection

Given a camera with intrinsics $K$ and extrinsics $[R | \mathbf{t}]$, a 3D point $\mathbf{p} \in \mathbb{R}^3$ projects to pixel:

$$\mathbf{u} = \pi(\mathbf{p}) = K \cdot (R\mathbf{p} + \mathbf{t})$$

The Jacobian $\frac{\partial \mathbf{u}}{\partial \mathbf{p}}$ exists everywhere except at $z = 0$, so projection is differentiable.

### Stage 3: Differentiable Rendering

This is the hard part. Rasterization involves discrete operations (which triangle covers which pixel?) that have zero gradient almost everywhere. Two main strategies exist:

**Soft rasterization**: Replace hard triangle-pixel coverage with smooth probability functions (SoftRas, Kato et al. 2018). Every triangle contributes to every pixel with a weight that falls off smoothly, providing gradient everywhere.

**Modular differentiable rasterization**: Keep the forward pass identical to hardware rasterization but carefully handle gradients at triangle edges using antialiasing (nvdiffrast, Laine et al. 2020).

### Stage 4: Loss and Backpropagation

Given a rendered image $\hat{I}$ and a ground-truth photograph $I$, the photometric loss drives optimization:

$$\mathcal{L} = \| \hat{I} - I \|_2^2 + \lambda \cdot \mathcal{L}_{\text{reg}}$$

Gradients $\frac{\partial \mathcal{L}}{\partial \theta}$ flow through the entire pipeline to update scene parameters.

## Differentiable Rasterization: nvdiffrast

Laine et al. (2020) introduced **nvdiffrast**, a modular library that makes the standard GPU rasterization pipeline differentiable. It provides four primitive operations:

1. **Rasterization** — determines which triangle covers each pixel (forward: standard z-buffer; backward: antialiasing-based gradients)
2. **Interpolation** — barycentric interpolation of vertex attributes (straightforwardly differentiable)
3. **Texturing** — filtered texture lookups (mipmapped, differentiable)
4. **Antialiasing** — edge-aware filtering that provides gradients for silhouette edges

The antialiasing layer is critical: without it, moving a triangle edge by a sub-pixel amount produces zero gradient (the coverage mask doesn't change). Nvdiffrast uses an analytic edge integral to compute the correct gradient at silhouette boundaries.

```python
# Pseudocode: nvdiffrast forward pass
import nvdiffrast.torch as dr

glctx = dr.RasterizeGLContext()
# Rasterize: triangle ID + barycentric coords per pixel
rast_out, _ = dr.rasterize(glctx, pos_clip, tri, resolution)
# Interpolate vertex attributes
attr_out, _ = dr.interpolate(vertex_attrs, rast_out, tri)
# Texture lookup
color = dr.texture(texture_map, texcoords)
# Antialias for silhouette gradients
color = dr.antialias(color, rast_out, pos_clip, tri)
```

## Differentiable Ray Tracing

While rasterization projects triangles onto pixels, ray tracing shoots rays from pixels into the scene. Differentiable ray tracing computes gradients of the rendered image with respect to:

- **Geometry** (vertex positions, surface parameters)
- **Materials** (BRDF parameters, texture values)
- **Lighting** (light positions, intensities, environment maps)

Libraries like **Mitsuba 3** (Jakob et al. 2022) provide a fully differentiable physically-based renderer. The main challenge is handling **discontinuities** at visibility boundaries — when a surface edge moves, it can suddenly occlude or reveal objects behind it, creating a step function in the rendered image.

Mitsuba 3 handles this via **reparameterized integrals** that convert boundary integrals into smooth functions amenable to Monte Carlo estimation.

## Implicit Neural Representations

Classical 3D representations (meshes, point clouds, voxel grids) store geometry explicitly. **Implicit neural representations** instead encode geometry as the level set of a continuous function parameterized by a neural network:

$$f_\theta : \mathbb{R}^3 \rightarrow \mathbb{R}$$

A 3D coordinate $\mathbf{x} = (x, y, z)$ goes in; a scalar value comes out. The surface is defined as the zero level set $\{ \mathbf{x} : f_\theta(\mathbf{x}) = 0 \}$.

### Signed Distance Functions (DeepSDF, Park et al. 2019)

DeepSDF learns a continuous SDF where $f_\theta(\mathbf{x})$ returns the signed distance to the nearest surface:

- $f_\theta(\mathbf{x}) > 0$: point is outside the shape
- $f_\theta(\mathbf{x}) = 0$: point is on the surface
- $f_\theta(\mathbf{x}) < 0$: point is inside the shape

The network takes a coordinate $\mathbf{x}$ plus a latent code $\mathbf{z}$ (representing a specific shape) and outputs the signed distance:

$$f_\theta(\mathbf{z}, \mathbf{x}) \approx \text{SDF}(\mathbf{x})$$

Surfaces are extracted via Marching Cubes on the zero level set. DeepSDF showed that a single network could represent an entire class of shapes (chairs, cars, planes) by varying the latent code.

### Occupancy Networks (Mescheder et al. 2019)

Instead of distance, occupancy networks predict a binary occupancy probability:

$$f_\theta(\mathbf{x}) \in [0, 1], \quad \text{surface at } f_\theta(\mathbf{x}) = 0.5$$

Both approaches share the key advantage of implicit representations: **infinite resolution**. Unlike voxel grids, the network can be queried at any continuous coordinate, and memory scales with network size rather than spatial resolution.

## Positional Encoding: Why MLPs Need Fourier Features

A standard MLP $f_\theta(\mathbf{x})$ with ReLU activations is biased toward learning **low-frequency** functions. This phenomenon, called **spectral bias**, means that the network learns smooth, blurry approximations and struggles to capture sharp edges and fine detail.

### The Problem: Neural Tangent Kernel Theory

Tancik et al. (2020) showed via Neural Tangent Kernel (NTK) theory that a standard MLP corresponds to a kernel with rapid frequency falloff. The NTK of a network $f_\theta$ determines the convergence rate of training:

$$K(\mathbf{x}, \mathbf{x}') = \left\langle \frac{\partial f_\theta(\mathbf{x})}{\partial \theta}, \frac{\partial f_\theta(\mathbf{x}')}{\partial \theta} \right\rangle$$

For a standard MLP applied to raw coordinates, the NTK's eigenspectrum decays rapidly — high-frequency components have tiny eigenvalues, so gradient descent converges extremely slowly for fine details.

### The Solution: Fourier Feature Mapping

The fix is remarkably simple. Before passing coordinates to the MLP, apply a Fourier feature mapping $\gamma$:

$$\gamma(\mathbf{x}) = \left[ \sin(2\pi \mathbf{B} \mathbf{x}), \cos(2\pi \mathbf{B} \mathbf{x}) \right]$$

where $\mathbf{B} \in \mathbb{R}^{m \times d}$ is a matrix of frequency coefficients. For neural rendering, the standard encoding uses logarithmically spaced frequencies:

$$\gamma(p) = \left[ \sin(2^0 \pi p), \cos(2^0 \pi p), \sin(2^1 \pi p), \cos(2^1 \pi p), \ldots, \sin(2^{L-1} \pi p), \cos(2^{L-1} \pi p) \right]$$

This maps a scalar $p$ to a $2L$-dimensional vector. For a 3D coordinate $(x, y, z)$, each component is encoded separately and concatenated, giving a $6L$-dimensional input.

### Why It Works

The Fourier mapping transforms the NTK into a **stationary kernel** with tunable bandwidth. By choosing appropriate frequencies in $\mathbf{B}$, the NTK's eigenspectrum becomes roughly uniform across the target frequency range, enabling the network to learn low and high frequencies at similar rates.

```python
import torch
import torch.nn as nn

class PositionalEncoding(nn.Module):
    """Fourier feature positional encoding (Tancik et al. 2020)."""
    def __init__(self, num_freqs=10, input_dim=3):
        super().__init__()
        # Logarithmically spaced frequencies: 2^0, 2^1, ..., 2^(L-1)
        freqs = 2.0 ** torch.arange(num_freqs)  # shape: (L,)
        self.register_buffer('freqs', freqs)
        self.output_dim = input_dim * (2 * num_freqs + 1)  # +1 for identity

    def forward(self, x):
        # x: (..., input_dim)
        # Outer product with frequencies
        x_freq = x.unsqueeze(-1) * self.freqs  # (..., input_dim, L)
        # Flatten and concatenate sin, cos, and identity
        sin_features = torch.sin(x_freq).flatten(-2)
        cos_features = torch.cos(x_freq).flatten(-2)
        return torch.cat([x, sin_features, cos_features], dim=-1)
```

With $L = 10$ frequencies and 3D input, the encoding produces $3 \times (2 \times 10 + 1) = 63$ features. NeRF uses $L = 10$ for position ($\mathbf{x}$) and $L = 4$ for viewing direction ($\mathbf{d}$).

## Neural Scene Representation Taxonomy

Neural scene representations can be organized along a spectrum from fully explicit to fully implicit:

### Explicit Representations

| Representation | Description | Pros | Cons |
|---|---|---|---|
| **Triangle Mesh** | Vertices + faces | Fast rendering, hardware support | Fixed topology, hard to optimize |
| **Point Cloud** | Unstructured 3D points | Flexible topology | Holes, no surface, unordered |
| **Voxel Grid** | Regular 3D grid of values | Simple queries | Cubic memory growth $O(N^3)$ |

### Implicit Representations

| Representation | Description | Pros | Cons |
|---|---|---|---|
| **Neural SDF** | Network outputs signed distance | Smooth surfaces, infinite resolution | Slow to query, hard to render |
| **Occupancy Field** | Network outputs inside/outside | Continuous, any topology | Binary — limited detail |
| **Radiance Field** | Network outputs color + density | Full appearance modeling | Very slow rendering |

### Hybrid Representations

| Representation | Description | Pros | Cons |
|---|---|---|---|
| **Voxel + MLP** (NSVF) | Sparse voxel grid stores features, MLP decodes | Faster than pure MLP | Still needs ray marching |
| **Multi-res Hash Grid** (Instant-NGP) | Hash table of features + tiny MLP | Very fast training/inference | Hash collisions |
| **3D Gaussians** (3DGS) | Explicit Gaussian primitives | Real-time rendering, fast training | High memory, many primitives |
| **Tri-plane** (EG3D) | Three orthogonal feature planes | Compact, fast queries | Resolution limited by planes |

The field has converged on **hybrid** representations as the sweet spot — explicit spatial data structures for fast lookup, combined with small neural networks for flexible decoding.

## The Volume Rendering Equation

Volume rendering is the mathematical engine behind NeRF and many neural rendering methods. Unlike surface rendering (which finds the first surface hit), volume rendering integrates color contributions along the entire ray through a participating medium.

### The Continuous Formulation

Consider a ray $\mathbf{r}(t) = \mathbf{o} + t\mathbf{d}$ with near bound $t_n$ and far bound $t_f$. At each point along the ray, the medium has:

- **Volume density** $\sigma(t)$: probability of interaction per unit length (higher = more opaque)
- **Color** $\mathbf{c}(t)$: the radiance emitted/scattered at that point

The **transmittance** from $t_n$ to $t$ is the probability that the ray travels from $t_n$ to $t$ without being absorbed:

$$T(t) = \exp\left( -\int_{t_n}^{t} \sigma(s) \, ds \right)$$

The expected color along the ray is:

$$C(\mathbf{r}) = \int_{t_n}^{t_f} T(t) \, \sigma(t) \, \mathbf{c}(t) \, dt$$

This integral has an elegant physical interpretation: the contribution of each point is weighted by:
1. $\sigma(t)$: how likely the point is to interact with the ray (scatter/emit light)
2. $T(t)$: how likely the ray is to have reached this point without being absorbed earlier

Points deep inside an opaque object contribute nothing because $T(t) \approx 0$ — the ray was already absorbed.

### Discrete Approximation (Quadrature)

In practice, we approximate the integral by sampling $N$ points $t_1 < t_2 < \cdots < t_N$ along the ray. Let $\delta_i = t_{i+1} - t_i$ be the distance between adjacent samples:

$$\hat{C}(\mathbf{r}) = \sum_{i=1}^{N} T_i \, \alpha_i \, \mathbf{c}_i$$

where:

$$\alpha_i = 1 - \exp(-\sigma_i \delta_i) \quad \text{(opacity of sample } i\text{)}$$

$$T_i = \prod_{j=1}^{i-1}(1 - \alpha_j) \quad \text{(accumulated transmittance up to sample } i\text{)}$$

This is exactly **front-to-back alpha compositing** — the same operation used in 2D image compositing, but applied along a 3D ray.

```python
def volume_render(sigma, color, deltas):
    """
    Volume rendering with discrete quadrature.

    Args:
        sigma: (N,) volume density at each sample
        color: (N, 3) RGB color at each sample
        deltas: (N,) distance between adjacent samples

    Returns:
        pixel_color: (3,) rendered RGB color
    """
    # Compute alpha (opacity) per sample
    alpha = 1.0 - torch.exp(-sigma * deltas)          # (N,)

    # Compute transmittance: cumulative product of (1 - alpha)
    # T_i = prod_{j=1}^{i-1} (1 - alpha_j)
    # Use exclusive cumulative product (shift by 1)
    T = torch.cumprod(1.0 - alpha + 1e-10, dim=0)     # (N,)
    T = torch.cat([torch.ones(1), T[:-1]])             # shift: T_1 = 1

    # Weighted sum
    weights = T * alpha                                 # (N,)
    pixel_color = (weights.unsqueeze(-1) * color).sum(dim=0)  # (3,)

    return pixel_color
```

### Key Properties

The rendering weights $w_i = T_i \alpha_i$ satisfy:

$$\sum_{i=1}^{N} w_i = 1 - T_{N+1} \leq 1$$

If the ray passes through opaque content, $T_{N+1} \approx 0$ and the weights sum to nearly 1. If the ray passes through empty space, all weights are near 0 and the background color dominates.

## Evolution of the Field: A Timeline

The neural rendering field has evolved rapidly. Here is the trajectory from early implicit representations to today's state of the art:

### 2019: The Implicit Revolution
- **DeepSDF** (Park et al.) — learned signed distance functions for shape classes
- **Occupancy Networks** (Mescheder et al.) — continuous occupancy prediction
- **Scene Representation Networks** (Sitzmann et al.) — differentiable rendering of implicit representations

### 2020: NeRF and the Explosion
- **NeRF** (Mildenhall et al.) — neural radiance fields with volume rendering, producing photorealistic novel views from photographs. The paper that launched a thousand follow-ups.
- **Fourier Features** (Tancik et al.) — explained *why* positional encoding works
- **nvdiffrast** (Laine et al.) — high-performance differentiable rasterization

### 2021-2022: Scaling and Speed
- **Mip-NeRF** (Barron et al. 2021) — anti-aliased NeRF using cone tracing and integrated positional encoding
- **Mip-NeRF 360** (Barron et al. 2022) — extended to unbounded real-world scenes
- **Instant-NGP** (Muller et al. 2022) — multi-resolution hash encoding, training in seconds
- **DreamFusion** (Poole et al. 2022) — text-to-3D using Score Distillation Sampling

### 2023: The Gaussian Revolution
- **3D Gaussian Splatting** (Kerbl et al. 2023) — real-time radiance field rendering via explicit Gaussian primitives, matching NeRF quality at 100+ FPS
- **Zip-NeRF** (Barron et al. 2023) — combined hash grids with anti-aliasing

### 2024-2025: Maturation and Diversification
- **2D Gaussian Splatting** (Huang et al. 2024) — flat Gaussian disks for better surface geometry
- **Mip-Splatting** (Yu et al. 2024) — alias-free Gaussian splatting, CVPR Best Student Paper
- **4D Gaussian Splatting** (Wu et al. 2024) — real-time dynamic scene rendering
- **3D Gaussian Ray Tracing** (NVIDIA 2024) — ray tracing instead of rasterization for Gaussians, enabling reflections, refractions, and secondary effects
- **GS-SLAM** methods (MonoGS, SplaTAM, 2024-2025) — Gaussian-based simultaneous localization and mapping
- **Relightable Gaussians** (R3DG, ECCV 2024; GIR, TPAMI 2025) — BRDF decomposition for relighting
- **FlashGS** (CVPR 2025) — efficient large-scale Gaussian splatting
- **Compressed 3DGS** (2024-2025) — vector quantization and hash-based compression achieving 50-150x reduction

### 2025-2026: Convergence
- Hybrid NeRF-GS methods that use NeRF's continuous spatial awareness to improve Gaussian initialization
- Feed-forward Gaussian prediction from single images (no per-scene optimization)
- Unified frameworks merging 2D generation, 3D reconstruction, and video

The field is converging on a clear pattern: **explicit or hybrid representations** with **differentiable rendering** for fast optimization and real-time inference. The implicit MLP-only approach of original NeRF has largely been superseded by spatially-structured representations with small decoders.

## Exercises

<details>
<summary>Exercise: Volume Rendering Weights</summary>

<p>A ray passes through 3 samples with densities $\sigma_1 = 0$, $\sigma_2 = 10$, $\sigma_3 = 10$ and uniform spacing $\delta = 0.1$. The colors are $\mathbf{c}_1 = (1,0,0)$, $\mathbf{c}_2 = (0,1,0)$, $\mathbf{c}_3 = (0,0,1)$. Compute the rendered color.</p>

<p><strong>Solution:</strong></p>

<p>First, compute alphas: $\alpha_i = 1 - \exp(-\sigma_i \delta)$</p>

<p>$\alpha_1 = 1 - \exp(0) = 0$</p>
<p>$\alpha_2 = 1 - \exp(-1) \approx 0.632$</p>
<p>$\alpha_3 = 1 - \exp(-1) \approx 0.632$</p>

<p>Then transmittances: $T_1 = 1$, $T_2 = (1-0) = 1$, $T_3 = (1-0)(1-0.632) = 0.368$</p>

<p>Weights: $w_1 = 1 \times 0 = 0$, $w_2 = 1 \times 0.632 = 0.632$, $w_3 = 0.368 \times 0.632 = 0.233$</p>

<p>$\hat{C} = 0 \cdot (1,0,0) + 0.632 \cdot (0,1,0) + 0.233 \cdot (0,0,1) = (0, 0.632, 0.233)$</p>

<p>The first sample is transparent ($\sigma = 0$, weight = 0). The second sample absorbs most of the light. The third sample gets less weight because transmittance dropped. Total weight = $0.632 + 0.233 = 0.865$ — some light passes through (the remaining 0.135 would show the background).</p>
</details>

<details>
<summary>Exercise: Positional Encoding Dimensions</summary>

<p>NeRF uses $L = 10$ frequency bands for position and $L = 4$ for viewing direction. Positions are 3D $(x,y,z)$ and directions are 3D $(\theta, \phi)$ encoded as unit vectors $(d_x, d_y, d_z)$. Counting the identity (raw) coordinates, what is the total input dimension to the MLP?</p>

<p><strong>Solution:</strong></p>

<p>For each scalar coordinate, $L$ frequency bands produce $2L$ values (sin and cos), plus the raw coordinate itself gives $2L + 1$ features per scalar.</p>

<p>Position: $3 \times (2 \times 10 + 1) = 3 \times 21 = 63$ features</p>
<p>Direction: $3 \times (2 \times 4 + 1) = 3 \times 9 = 27$ features</p>

<p>However, in the original NeRF paper, the identity is included, giving 63 for position. The direction encoding (27 features) is injected at a later layer, not concatenated with position at the input. So the first layer receives 63 features.</p>

<p>Note: Some implementations omit the identity term, giving $3 \times 2 \times 10 = 60$ for position and $3 \times 2 \times 4 = 24$ for direction. Always check the specific implementation.</p>
</details>

<details>
<summary>Exercise: Transmittance and Opacity</summary>

<p>Prove that the discrete transmittance $T_i = \prod_{j=1}^{i-1}(1 - \alpha_j)$ approaches the continuous form $T(t) = \exp(-\int_{t_n}^{t}\sigma(s)\,ds)$ as the number of samples $N \to \infty$.</p>

<p><strong>Solution:</strong></p>

<p>Take the log of the discrete transmittance:</p>

<p>$\ln T_i = \sum_{j=1}^{i-1} \ln(1 - \alpha_j) = \sum_{j=1}^{i-1} \ln(\exp(-\sigma_j \delta_j)) = -\sum_{j=1}^{i-1} \sigma_j \delta_j$</p>

<p>As $N \to \infty$ and $\delta_j \to 0$, this Riemann sum converges to:</p>

<p>$\ln T(t) = -\int_{t_n}^{t} \sigma(s)\,ds$</p>

<p>Therefore $T(t) = \exp(-\int_{t_n}^{t}\sigma(s)\,ds)$, which is exactly the continuous transmittance. The discrete formula is not an approximation — it is the exact evaluation of the continuous integral under the assumption that $\sigma$ is piecewise constant within each interval $\delta_j$.</p>
</details>

## Key Takeaways

- **Neural rendering** makes the graphics pipeline differentiable, enabling optimization of 3D scene parameters from 2D photographs
- **Differentiable rasterization** (nvdiffrast) provides gradients through the standard GPU pipeline; the key challenge is handling silhouette edges where coverage is discontinuous
- **Implicit neural representations** (DeepSDF, NeRF) encode geometry as neural network level sets, providing infinite resolution independent of memory
- **Positional encoding** maps low-dimensional coordinates through Fourier features to overcome the spectral bias of MLPs, enabling learning of high-frequency details
- **The volume rendering equation** $C(\mathbf{r}) = \int T(t)\,\sigma(t)\,\mathbf{c}(t)\,dt$ integrates color weighted by density and transmittance along a ray, discretizing to standard alpha compositing
- The field evolved from pure implicit representations (DeepSDF 2019) through MLP-based radiance fields (NeRF 2020) to hybrid/explicit representations (Instant-NGP 2022, 3DGS 2023) that achieve real-time performance
- **Hybrid representations** — explicit spatial structures with small neural decoders — have emerged as the dominant paradigm, balancing quality, speed, and flexibility
