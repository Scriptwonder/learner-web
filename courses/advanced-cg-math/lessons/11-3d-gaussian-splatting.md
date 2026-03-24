# 3D Gaussian Splatting

In 2023, Kerbl et al. introduced **3D Gaussian Splatting (3DGS)** — a radiance field representation that achieves NeRF-quality novel view synthesis at **real-time frame rates** (30-200+ FPS). The core idea: represent the scene as millions of 3D Gaussian primitives, each with its own position, shape, opacity, and view-dependent color, then render them via fast differentiable rasterization instead of slow ray marching. This lesson covers the full mathematical formulation, the splatting pipeline, the training algorithm, and the rapidly-expanding family of successors that have made Gaussians the dominant paradigm in neural rendering.

## Motivation: Why Not NeRF?

NeRF produces stunning results but requires **hundreds of MLP evaluations per ray per pixel**. Even with Instant-NGP's hash encoding, interactive rendering of complex scenes remains challenging. The fundamental bottleneck is that volume rendering requires *sequential* evaluation along each ray — you can't skip ahead without checking what's in between.

3DGS takes a radically different approach: instead of querying a function at sampled points along rays, it **projects 3D primitives onto the image plane** via rasterization. This is embarrassingly parallel, maps naturally to GPU hardware, and avoids the ray-marching bottleneck entirely.

## The 3D Gaussian Representation

Each Gaussian primitive $G_k$ is defined by five attributes:

### 1. Position (Mean)

$$\boldsymbol{\mu}_k \in \mathbb{R}^3$$

The center of the Gaussian in world space. Initialized from a Structure-from-Motion (SfM) point cloud.

### 2. Covariance Matrix

$$\boldsymbol{\Sigma}_k \in \mathbb{R}^{3 \times 3}, \quad \boldsymbol{\Sigma}_k \succ 0 \text{ (positive definite)}$$

Defines the shape and orientation of the Gaussian ellipsoid. The 3D Gaussian density is:

$$G(\mathbf{x}) = \exp\left( -\frac{1}{2} (\mathbf{x} - \boldsymbol{\mu})^T \boldsymbol{\Sigma}^{-1} (\mathbf{x} - \boldsymbol{\mu}) \right)$$

To ensure $\boldsymbol{\Sigma}$ remains positive semi-definite during gradient-based optimization, it is **parameterized** as:

$$\boldsymbol{\Sigma} = R S S^T R^T$$

where $R \in SO(3)$ is a rotation matrix (stored as a quaternion $\mathbf{q} \in \mathbb{R}^4$) and $S = \text{diag}(s_x, s_y, s_z)$ is a scaling matrix. The learnable parameters are the quaternion $\mathbf{q}$ and the scale vector $\mathbf{s} \in \mathbb{R}^3$.

### 3. Opacity

$$\alpha_k \in (0, 1)$$

Controls the transparency of the Gaussian. Stored as a logit and activated with sigmoid during rendering. Combined with the Gaussian falloff, the effective opacity at a point is $\alpha_k \cdot G(\mathbf{x})$.

### 4. Color (Spherical Harmonics)

View-dependent color is represented using **Spherical Harmonics (SH)** coefficients. For SH of degree $\ell_{\max}$, each Gaussian stores $(\ell_{\max} + 1)^2$ coefficients per color channel.

With the default $\ell_{\max} = 3$:

$$(3 + 1)^2 = 16 \text{ coefficients per channel} \times 3 \text{ channels} = 48 \text{ SH coefficients total}$$

Given a viewing direction $\mathbf{d}$, the color is:

$$\mathbf{c}(\mathbf{d}) = \sum_{l=0}^{\ell_{\max}} \sum_{m=-l}^{l} c_{lm} \, Y_l^m(\mathbf{d})$$

where $Y_l^m$ are the real spherical harmonic basis functions and $c_{lm}$ are the learned coefficients. The DC component ($l=0$) gives the base (Lambertian) color; higher-order terms capture specular effects.

### Per-Gaussian Memory

| Attribute | Parameters | Storage |
|---|---|---|
| Position $\boldsymbol{\mu}$ | 3 | 12 bytes |
| Quaternion $\mathbf{q}$ | 4 | 16 bytes |
| Scale $\mathbf{s}$ | 3 | 12 bytes |
| Opacity $\alpha$ | 1 | 4 bytes |
| SH coefficients | 48 | 192 bytes |
| **Total** | **59** | **236 bytes** |

A typical scene uses 1-5 million Gaussians, requiring 236 MB - 1.2 GB uncompressed.

## The Splatting Pipeline

Rendering transforms 3D Gaussians into 2D screen-space splats and composites them front-to-back.

### Step 1: World to Camera Transform

Each Gaussian's mean is transformed to camera space:

$$\boldsymbol{\mu}' = W \boldsymbol{\mu} + \mathbf{t}$$

where $W$ is the $3 \times 3$ rotation part and $\mathbf{t}$ the translation of the view matrix.

### Step 2: Covariance Projection (The Key Math)

This is the most important derivation in 3DGS. A 3D Gaussian projects to a **2D Gaussian** on the image plane. We need to find the 2D covariance matrix $\boldsymbol{\Sigma}'$ from the 3D covariance $\boldsymbol{\Sigma}$.

The projection is based on **EWA (Elliptical Weighted Average) splatting** (Zwicker et al. 2002). The idea: approximate the perspective projection locally as an affine transform using its Jacobian.

**The perspective projection** maps a 3D camera-space point $(x, y, z)$ to a 2D image point:

$$\pi(x, y, z) = \left( \frac{f_x \cdot x}{z}, \frac{f_y \cdot y}{z} \right)$$

**The Jacobian** of $\pi$ evaluated at the Gaussian center $(x_c, y_c, z_c)$ is:

$$J = \begin{pmatrix} \frac{f_x}{z_c} & 0 & -\frac{f_x \cdot x_c}{z_c^2} \\ 0 & \frac{f_y}{z_c} & -\frac{f_y \cdot y_c}{z_c^2} \end{pmatrix}$$

This $2 \times 3$ matrix is the local linear approximation of perspective projection near the Gaussian center.

**The 2D covariance** is obtained by propagating the 3D covariance through the viewing transform $W$ and then the projection $J$:

$$\boldsymbol{\Sigma}' = J \, W \, \boldsymbol{\Sigma} \, W^T \, J^T$$

This is a $2 \times 2$ symmetric positive semi-definite matrix defining an ellipse on screen.

**Step-by-step derivation:**

1. Start with 3D Gaussian covariance in world space: $\boldsymbol{\Sigma} \in \mathbb{R}^{3 \times 3}$

2. Transform to camera space: $\boldsymbol{\Sigma}_{\text{cam}} = W \boldsymbol{\Sigma} W^T$ (still $3 \times 3$)

3. Project to 2D via Jacobian: $\boldsymbol{\Sigma}' = J \, \boldsymbol{\Sigma}_{\text{cam}} \, J^T = J \, W \, \boldsymbol{\Sigma} \, W^T \, J^T$ (now $2 \times 2$)

This $2 \times 2$ matrix has the form:

$$\boldsymbol{\Sigma}' = \begin{pmatrix} a & b \\ b & c \end{pmatrix}$$

The eigenvalues $\lambda_1, \lambda_2$ of $\boldsymbol{\Sigma}'$ give the squared semi-axis lengths of the screen-space ellipse, and the eigenvectors give its orientation.

```python
import torch

def compute_2d_covariance(mean_3d, cov_3d, viewmatrix, fx, fy):
    """
    Project 3D Gaussian covariance to 2D screen-space covariance.

    Args:
        mean_3d: (3,) Gaussian center in world space
        cov_3d: (3, 3) 3D covariance matrix
        viewmatrix: (4, 4) world-to-camera transform
        fx, fy: focal lengths in pixels

    Returns:
        cov_2d: (2, 2) screen-space covariance matrix
        mean_2d: (2,) projected center in pixels
    """
    # Transform mean to camera space
    R = viewmatrix[:3, :3]      # (3, 3) rotation
    t = viewmatrix[:3, 3]       # (3,) translation
    mean_cam = R @ mean_3d + t  # (3,)

    x, y, z = mean_cam[0], mean_cam[1], mean_cam[2]

    # Jacobian of perspective projection
    J = torch.tensor([
        [fx / z,    0.0,  -fx * x / z**2],
        [0.0,    fy / z,  -fy * y / z**2]
    ])  # (2, 3)

    # Transform covariance: world -> camera -> screen
    # Sigma_cam = R @ Sigma @ R^T
    # Sigma_2d = J @ Sigma_cam @ J^T
    W = R  # viewing rotation
    M = J @ W                          # (2, 3)
    cov_2d = M @ cov_3d @ M.T         # (2, 2)

    # Projected mean
    mean_2d = torch.tensor([fx * x / z, fy * y / z])

    return cov_2d, mean_2d
```

### Step 3: Tile-Based Rasterization

For efficiency, the screen is divided into $16 \times 16$ pixel tiles. Each Gaussian is assigned to every tile its screen-space ellipse overlaps (using a conservative bounding rectangle). The algorithm:

1. **Frustum culling**: Discard Gaussians outside the camera frustum
2. **Screen-space bounds**: Compute the bounding rect of each Gaussian's 2D ellipse (typically $3\sigma$ radius)
3. **Tile assignment**: Map each Gaussian to the tiles it overlaps
4. **Depth sorting**: Within each tile, sort Gaussians by depth (distance to camera)
5. **Alpha blending**: For each pixel, composite Gaussians front-to-back

### Step 4: Alpha Blending

For a pixel at position $\mathbf{p}$, the Gaussians overlapping that tile are blended front-to-back (sorted by depth $z_k$):

$$C(\mathbf{p}) = \sum_{k=1}^{K} \mathbf{c}_k \, \alpha_k' \prod_{j=1}^{k-1} (1 - \alpha_j')$$

where the per-pixel opacity is the Gaussian's base opacity modulated by the 2D Gaussian evaluated at the pixel:

$$\alpha_k' = \alpha_k \cdot \exp\left(-\frac{1}{2} (\mathbf{p} - \boldsymbol{\mu}_k')^T {\boldsymbol{\Sigma}_k'}^{-1} (\mathbf{p} - \boldsymbol{\mu}_k')\right)$$

Here $\boldsymbol{\mu}_k'$ is the projected 2D center and $\boldsymbol{\Sigma}_k'$ is the 2D covariance from Step 2.

This is the same alpha compositing as NeRF's volume rendering, but instead of evaluating samples along a ray, we evaluate Gaussian contributions per pixel. The accumulation stops early once transmittance drops below a threshold (e.g., $T < 0.003$).

## Training Pipeline

### Initialization

Gaussians are initialized from a **Structure-from-Motion (SfM)** point cloud (e.g., from COLMAP). Each SfM point becomes a Gaussian with:
- Position: the 3D point location
- Scale: set based on the mean distance to nearest neighbors
- Rotation: identity quaternion
- Opacity: 0.1 (low initial transparency)
- SH: DC term from point color, higher orders initialized to 0

### Loss Function

The training loss combines L1 photometric loss with a structural similarity term:

$$\mathcal{L} = (1 - \lambda) \, \mathcal{L}_1 + \lambda \, \mathcal{L}_{\text{D-SSIM}}$$

where $\lambda = 0.2$ by default. The **D-SSIM** (Differentiable Structural Similarity) loss captures perceptual quality beyond pixel-level accuracy:

$$\mathcal{L}_{\text{D-SSIM}} = \frac{1 - \text{SSIM}(\hat{I}, I)}{2}$$

SSIM compares local statistics (mean, variance, covariance) between the rendered image $\hat{I}$ and ground truth $I$, making it sensitive to structural patterns that L1 alone misses.

### Adaptive Density Control

The initial SfM point cloud is sparse and imperfect. During training, 3DGS dynamically adjusts the number and distribution of Gaussians through three operations:

**Cloning**: If a Gaussian has a large positional gradient (meaning it's being pulled in a direction) and is **small** (under-reconstruction), it is **duplicated** and the clone is moved in the gradient direction. This fills gaps in under-reconstructed regions.

**Splitting**: If a Gaussian has a large positional gradient and is **large** (over-reconstruction — one big Gaussian covering too much area), it is **replaced by two smaller Gaussians** with reduced scale. This refines coarse blobs into fine detail.

**Pruning**: Gaussians with very low opacity ($\alpha < \epsilon_\alpha$) are removed periodically, as they contribute negligibly to the image. Additionally, Gaussians that grow excessively large (world-space or screen-space) are culled.

These operations are applied every 100-500 training iterations. The opacity is periodically reset to near-zero, forcing Gaussians to "re-earn" their existence — those that don't contribute to image quality fade out and get pruned.

```python
def adaptive_density_control(gaussians, grads, iteration):
    """
    Pseudocode for 3DGS adaptive density control.

    Args:
        gaussians: current set of Gaussian primitives
        grads: accumulated position gradients since last densification
        iteration: current training iteration
    """
    grad_threshold = 0.0002
    min_opacity = 0.005

    for g in gaussians:
        if g.grad_norm > grad_threshold:
            if g.max_scale < scale_threshold:
                # Under-reconstruction: CLONE
                g_clone = g.copy()
                g_clone.position += g.grad_direction * step_size
                gaussians.add(g_clone)
            else:
                # Over-reconstruction: SPLIT into 2 smaller Gaussians
                g1, g2 = g.split(scale_factor=1.6)  # scale / 1.6
                gaussians.remove(g)
                gaussians.add(g1)
                gaussians.add(g2)

    # Pruning: remove near-transparent Gaussians
    gaussians.remove_where(lambda g: g.opacity < min_opacity)

    # Periodic opacity reset (every 3000 iterations)
    if iteration % 3000 == 0:
        for g in gaussians:
            g.opacity = 0.01  # force re-earning
```

### Training Schedule

A typical 3DGS training run:

| Phase | Iterations | Operations |
|---|---|---|
| Warmup | 0-500 | SH degree 0 only (Lambertian), no densification |
| Growth | 500-15,000 | Densification every 100 steps, SH degree increases gradually |
| Refinement | 15,000-30,000 | No more densification, fine-tuning all parameters |

Total training time: **~7-15 minutes** on a single GPU for a standard scene (vs. hours for NeRF).

## Comparison with NeRF

| Aspect | NeRF | 3DGS |
|---|---|---|
| **Representation** | Implicit (MLP) | Explicit (Gaussians) |
| **Rendering** | Ray marching (sequential) | Rasterization (parallel) |
| **Training time** | Hours | Minutes |
| **Rendering speed** | ~0.03 FPS | **30-200+ FPS** |
| **Quality (PSNR)** | ~31 dB | ~31 dB (comparable) |
| **Memory** | ~5 MB (network weights) | ~200 MB - 1 GB |
| **Editability** | Hard (implicit) | Easy (move/delete Gaussians) |
| **Dynamic scenes** | Requires re-training | Deformable extensions |
| **Geometry** | Implicit (density field) | Approximate (Gaussian blobs) |

## Key Successors and Extensions

### 2D Gaussian Splatting (Huang et al. 2024, SIGGRAPH)

3DGS uses 3D ellipsoids, which are inherently **volumetric** — they lack a well-defined surface. This causes multi-view geometric inconsistency and poor surface reconstruction. **2DGS** replaces 3D Gaussians with **2D oriented planar disks**: flat Gaussian ellipses embedded in 3D space.

Each 2D Gaussian is parameterized by a center, two tangent vectors (defining the disk plane), and a 2D scale. The intersection of a ray with the Gaussian disk is computed analytically via **ray-splat intersection**, providing perspective-correct rendering. Combined with depth distortion and normal consistency losses, 2DGS achieves significantly better **surface geometry** while maintaining comparable rendering quality and speed.

### Mip-Splatting (Yu et al. 2024, CVPR Best Student Paper)

Like Mip-NeRF addressed aliasing in NeRFs, **Mip-Splatting** tackles aliasing in 3DGS. The problem: 3DGS has no notion of the sampling rate — very small Gaussians can cause aliasing when zoomed out, and the standard 2D dilation filter introduces artifacts.

Mip-Splatting introduces two filters:

1. **3D smoothing filter**: Constrains the minimum size of 3D Gaussians based on the training-view sampling rate, preventing sub-pixel Gaussians from causing aliasing
2. **2D Mip filter**: Replaces the ad-hoc dilation with a principled 2D Gaussian low-pass filter that simulates the physical imaging process (pixel integration)

The effective 2D covariance becomes:

$$\boldsymbol{\Sigma}'_{\text{filtered}} = \boldsymbol{\Sigma}' + s^2 I_{2 \times 2}$$

where $s$ is the filter kernel size determined by the sampling rate. This provides alias-free rendering across all zoom levels.

### 4D Gaussian Splatting (Wu et al. 2024, CVPR)

**4D-GS** extends 3DGS to **dynamic scenes** by adding a temporal dimension. Rather than storing separate Gaussians per frame, it uses a **deformation field** that warps canonical Gaussians to each timestep.

The deformation field is built from **HexPlane** — a factorized 4D feature volume using six feature planes (XY, XZ, XZ, XT, YT, ZT). For a given spacetime point $(\mathbf{x}, t)$, features are queried from all six planes, aggregated, and decoded by a lightweight MLP to predict Gaussian deformations:

$$\Delta \boldsymbol{\mu}, \Delta \mathbf{q}, \Delta \mathbf{s} = \text{MLP}(\text{HexPlane}(\mathbf{x}, t))$$

The deformed Gaussian parameters are $\boldsymbol{\mu} + \Delta \boldsymbol{\mu}$, etc. This achieves real-time rendering (82 FPS at 800x800) of dynamic scenes, with training in 8-30 minutes.

### Compressed Gaussian Representations (2024-2025)

A major drawback of 3DGS is its high memory consumption (hundreds of MB to GBs). Several compression approaches have emerged:

- **Vector quantization** (Compressed 3DGS, Navaneet et al. 2024): Cluster Gaussian attributes using sensitivity-aware k-means, achieving **31x compression** on real scenes
- **Factorized representations** (F-3DGS): Represent attributes using low-rank matrix/tensor factorization
- **Scaffold-GS** (Lu et al. 2024): Anchor-based structure with neural feature decoding, reducing storage while improving quality
- **LocoGS** (2025): Exploits spatial coherence with neural field encoding, achieving **55-97x compression**
- **Feature plane + DCT** (Lee et al. ICCV 2025): 146x compression with DCT-based entropy coding

### Relightable Gaussians (2024-2025)

Standard 3DGS bakes illumination into the SH coefficients — the appearance is fixed to the training lighting. **Relightable** methods decompose appearance into geometry, material, and lighting:

- **R3DG** (Gao et al. ECCV 2024): Attaches BRDF parameters (albedo, roughness, metalness) to each Gaussian and uses ray tracing for global illumination
- **GIR** (3D Gaussian Inverse Rendering, TPAMI 2025): Joint optimization of Gaussians and PBR materials for scene factorization
- **SSD-GS** (2025): Decomposes into diffuse, specular, shadow, and subsurface scattering components

These enable relighting Gaussian scenes under novel illumination, critical for VFX and game asset creation.

### GS-Based SLAM (2024-2026)

Gaussian Splatting has been integrated into **Simultaneous Localization and Mapping** (SLAM) systems:

- **SplaTAM** (Keetha et al. 2024): Dense SLAM using simplified Gaussians with silhouette-guided optimization
- **MonoGS** (Matsuki et al. CVPR 2024, Best Demo Award): Monocular Gaussian SLAM with geometric regularization, achieving real-time tracking + mapping
- **GS-SLAM** (Yan et al. CVPR 2024): First to integrate 3DGS into the full SLAM pipeline, 100x faster rendering than competing methods
- **Dy3DGS-SLAM** (2025): First monocular 3DGS SLAM for dynamic environments

### 3D Generation with Gaussians

- **DreamGaussian** (Tang et al. ICLR 2024 Oral): Text/image-to-3D using Gaussian splatting instead of NeRF, reducing generation time from hours to **~2 minutes**
- **GaussianDreamer** (Yi et al. CVPR 2024): Bridges 2D and 3D diffusion models for text-to-3D Gaussians
- **GVGEN** (2024): Direct 3D Gaussian generation from text in a single forward pass

### 3D Gaussian Ray Tracing (NVIDIA 2024)

A fundamental limitation of rasterization-based splatting is that it cannot handle **secondary rays** — reflections, refractions, shadows, depth of field. NVIDIA's **3DGRT** replaces the rasterizer with a ray tracer that:

- Intersects rays with 3D Gaussian primitives directly
- Supports secondary rays for reflections, refractions, and shadows
- Handles non-pinhole camera models (fisheye, omnidirectional)
- Achieves real-time performance via a BVH over Gaussians

This was published at CVPR 2025 as **3DGUT** (3D Gaussian Unbiased Transparency), supporting distorted cameras and secondary ray effects.

### Latest Developments (2025-2026)

- **FlashGS** (CVPR 2025): Efficient large-scale Gaussian splatting with optimized GPU kernels
- **Feed-forward Gaussian prediction**: Models like pixelSplat and MVSplat predict Gaussians from 2-3 images in ~50ms, no optimization needed
- **VR-Splatting** (2025): Foveated rendering combining neural points (foveal) with Gaussians (peripheral) for VR headsets
- **Language-embedded Gaussians** (LangSplat, CVPR 2024): Attach CLIP features to Gaussians for open-vocabulary 3D understanding
- **3D Vision-Language Gaussian Splatting** (ICLR 2025): Full 3D vision-language integration

## Exercises

<details>
<summary>Exercise: Covariance Projection</summary>

<p>A 3D Gaussian has covariance $\boldsymbol{\Sigma} = \text{diag}(0.04, 0.01, 0.04)$ (an ellipsoid elongated along $x$ and $z$). The Gaussian center in camera space is $(1, 0, 5)$. The camera has $f_x = f_y = 500$ pixels. Assume the view rotation $W = I$ (identity — already in camera space). Compute the 2D covariance $\boldsymbol{\Sigma}'$.</p>

<p><strong>Solution:</strong></p>

<p>The Jacobian at $(x_c, y_c, z_c) = (1, 0, 5)$:</p>

<p>$J = \begin{pmatrix} 500/5 & 0 & -500 \cdot 1/25 \\ 0 & 500/5 & -500 \cdot 0/25 \end{pmatrix} = \begin{pmatrix} 100 & 0 & -20 \\ 0 & 100 & 0 \end{pmatrix}$</p>

<p>Since $W = I$, we have $\boldsymbol{\Sigma}' = J \boldsymbol{\Sigma} J^T$:</p>

<p>$J \boldsymbol{\Sigma} = \begin{pmatrix} 100 & 0 & -20 \\ 0 & 100 & 0 \end{pmatrix} \begin{pmatrix} 0.04 & 0 & 0 \\ 0 & 0.01 & 0 \\ 0 & 0 & 0.04 \end{pmatrix} = \begin{pmatrix} 4 & 0 & -0.8 \\ 0 & 1 & 0 \end{pmatrix}$</p>

<p>$\boldsymbol{\Sigma}' = (J\boldsymbol{\Sigma}) J^T = \begin{pmatrix} 4 & 0 & -0.8 \\ 0 & 1 & 0 \end{pmatrix} \begin{pmatrix} 100 & 0 \\ 0 & 100 \\ -20 & 0 \end{pmatrix} = \begin{pmatrix} 400 + 16 & 0 \\ 0 & 100 \end{pmatrix} = \begin{pmatrix} 416 & 0 \\ 0 & 100 \end{pmatrix}$</p>

<p>The 2D Gaussian is an axis-aligned ellipse with $\sigma_x = \sqrt{416} \approx 20.4$ pixels and $\sigma_y = \sqrt{100} = 10$ pixels. The $x$-elongation is amplified because the Gaussian is off-center (at $x_c = 1$), causing the perspective Jacobian's third column to couple the $z$-axis spread into the $x$-direction on screen.</p>
</details>

<details>
<summary>Exercise: Alpha Compositing</summary>

<p>Three Gaussians overlap a pixel at position $\mathbf{p}$, sorted front-to-back by depth. Their per-pixel opacities $\alpha_k'$ and colors $\mathbf{c}_k$ are:</p>

<p>$G_1$: $\alpha_1' = 0.8$, $\mathbf{c}_1 = (1, 0, 0)$ (red)<br/>
$G_2$: $\alpha_2' = 0.5$, $\mathbf{c}_2 = (0, 1, 0)$ (green)<br/>
$G_3$: $\alpha_3' = 0.9$, $\mathbf{c}_3 = (0, 0, 1)$ (blue)</p>

<p>Compute the final pixel color using front-to-back alpha compositing.</p>

<p><strong>Solution:</strong></p>

<p>$T_1 = 1.0$ (nothing in front)</p>
<p>$T_2 = (1 - 0.8) = 0.2$</p>
<p>$T_3 = (1 - 0.8)(1 - 0.5) = 0.1$</p>

<p>$C = T_1 \alpha_1' \mathbf{c}_1 + T_2 \alpha_2' \mathbf{c}_2 + T_3 \alpha_3' \mathbf{c}_3$</p>
<p>$= 1.0 \times 0.8 \times (1,0,0) + 0.2 \times 0.5 \times (0,1,0) + 0.1 \times 0.9 \times (0,0,1)$</p>
<p>$= (0.8, 0, 0) + (0, 0.1, 0) + (0, 0, 0.09)$</p>
<p>$= (0.8, 0.1, 0.09)$</p>

<p>The pixel is predominantly red because the front Gaussian ($\alpha = 0.8$) absorbs 80% of the transmittance. The green and blue Gaussians contribute only 10% and 9% respectively. Total weight: $0.8 + 0.1 + 0.09 = 0.99$ — almost fully opaque. The remaining $T_4 = 0.01$ of transmittance would show the background.</p>
</details>

<details>
<summary>Exercise: Adaptive Density Control</summary>

<p>During training, a Gaussian $G_k$ has accumulated a position gradient norm of $\|\nabla_\mu \mathcal{L}\| = 0.001$ (above the threshold of $0.0002$). Its maximum scale axis is $s_{\max} = 0.005$ (below the scale threshold of $0.01$). A nearby Gaussian $G_j$ also has high gradient ($0.0008$) but $s_{\max} = 0.05$ (above the threshold). What densification operation is applied to each, and why?</p>

<p><strong>Solution:</strong></p>

<p>$G_k$: High gradient + small scale = <strong>CLONE</strong>. The small Gaussian is being pulled toward an area it can't reach — it represents an under-reconstructed region. Cloning creates a copy that moves in the gradient direction to fill the gap, while the original stays put. Both keep their size.</p>

<p>$G_j$: High gradient + large scale = <strong>SPLIT</strong>. The large Gaussian is covering too much area and being pulled apart by contradictory gradients from different parts of the scene. Splitting replaces it with two smaller Gaussians (scale divided by $\phi = 1.6$), each initialized near the original center with opposite perturbations sampled from the parent's distribution. This refines coarse coverage into finer detail.</p>

<p>This heuristic is central to 3DGS's ability to grow from a sparse SfM initialization to a dense, detailed representation — cloning fills gaps while splitting refines blobs.</p>
</details>

## Key Takeaways

- 3DGS represents scenes as millions of 3D Gaussians, each with position $\boldsymbol{\mu}$, covariance $\boldsymbol{\Sigma} = RSS^TR^T$, opacity $\alpha$, and SH color coefficients — an explicit, editable representation
- The **covariance projection** $\boldsymbol{\Sigma}' = JW\boldsymbol{\Sigma}W^TJ^T$ transforms 3D Gaussians to 2D screen-space ellipses using the Jacobian of perspective projection, enabling efficient rasterization
- **Tile-based rasterization** with front-to-back alpha compositing ($C = \sum_k \mathbf{c}_k \alpha_k' \prod_{j<k}(1-\alpha_j')$) replaces NeRF's ray marching, achieving 30-200+ FPS real-time rendering
- The training loss $\mathcal{L} = (1-\lambda)\mathcal{L}_1 + \lambda \mathcal{L}_{\text{D-SSIM}}$ combines pixel accuracy with perceptual quality
- **Adaptive density control** (clone small + high-gradient, split large + high-gradient, prune transparent) dynamically grows and refines the Gaussian set during training
- **2DGS** (2024) improves surface geometry with planar Gaussian disks; **Mip-Splatting** (2024) eliminates aliasing with 3D and 2D frequency-aware filters
- **4D Gaussian Splatting** (2024) handles dynamic scenes via learned deformation fields over a HexPlane temporal structure
- The ecosystem now includes compression (55-146x), relighting (BRDF decomposition), SLAM (MonoGS, GS-SLAM), generation (DreamGaussian), ray tracing (3DGRT for reflections/refractions), and VR rendering (foveated splatting)
