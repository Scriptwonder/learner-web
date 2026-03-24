# Neural Radiance Fields

In 2020, Mildenhall et al. showed that a single MLP, when trained on a set of photographs with known camera poses, could synthesize photorealistic novel views of a scene. The method — **Neural Radiance Fields (NeRF)** — became one of the most influential papers in computer vision and graphics. This lesson covers the original NeRF formulation in full mathematical detail, then traces its evolution through the key successors that solved its limitations: Mip-NeRF for anti-aliasing, Instant-NGP for speed, and Zip-NeRF for combining both. We finish with text-to-3D generation via Score Distillation Sampling.

## The Original NeRF (Mildenhall et al. 2020)

### Core Idea

NeRF represents a static scene as a continuous **5D function** that maps a 3D position $\mathbf{x} = (x, y, z)$ and a 2D viewing direction $\mathbf{d} = (\theta, \phi)$ to a color $\mathbf{c} = (r, g, b)$ and volume density $\sigma$:

$$F_\Theta : (\mathbf{x}, \mathbf{d}) \rightarrow (\mathbf{c}, \sigma)$$

The density $\sigma(\mathbf{x})$ depends only on position (it represents geometry — how opaque the scene is at that point). The color $\mathbf{c}(\mathbf{x}, \mathbf{d})$ depends on both position and viewing direction, allowing the network to model **view-dependent effects** like specular highlights and reflections.

### The MLP Architecture

The network has 8 fully-connected layers with 256 channels each, using ReLU activations. The architecture enforces the physical constraint that density is view-independent through a two-stage design:

1. **Density branch**: The positionally-encoded position $\gamma(\mathbf{x})$ passes through 8 FC layers (with a skip connection at layer 5), producing a 256-dim feature vector and the scalar density $\sigma$
2. **Color branch**: The feature vector is concatenated with the encoded viewing direction $\gamma(\mathbf{d})$, passes through one additional 128-channel layer, and outputs RGB color $\mathbf{c}$

$$\gamma(\mathbf{x}) \xrightarrow{\text{8 layers}} (\sigma, \mathbf{h}) \xrightarrow{\text{concat } \gamma(\mathbf{d})} \xrightarrow{\text{1 layer}} \mathbf{c}$$

Density is activated with ReLU (ensuring $\sigma \geq 0$) and color with sigmoid (ensuring $\mathbf{c} \in [0,1]$).

### Positional Encoding

Raw coordinates $(x,y,z)$ are mapped through the encoding $\gamma$ before entering the network:

$$\gamma(p) = \left( p, \sin(2^0 \pi p), \cos(2^0 \pi p), \ldots, \sin(2^{L-1} \pi p), \cos(2^{L-1} \pi p) \right)$$

NeRF uses $L = 10$ for position (mapping 3D to 63D) and $L = 4$ for direction (mapping 3D to 27D). Without this encoding, the network can only represent low-frequency, blurry content (see Lesson 09 on spectral bias).

### Volume Rendering

To render a pixel, NeRF casts a ray $\mathbf{r}(t) = \mathbf{o} + t\mathbf{d}$ from the camera origin $\mathbf{o}$ through the pixel in direction $\mathbf{d}$, then evaluates the volume rendering integral:

$$\hat{C}(\mathbf{r}) = \sum_{i=1}^{N} T_i \, \alpha_i \, \mathbf{c}_i$$

where:

$$\alpha_i = 1 - \exp(-\sigma_i \delta_i)$$

$$T_i = \prod_{j=1}^{i-1} (1 - \alpha_j) = \exp\left(-\sum_{j=1}^{i-1} \sigma_j \delta_j\right)$$

Here $\delta_i = t_{i+1} - t_i$ is the distance between consecutive samples, $\sigma_i$ and $\mathbf{c}_i$ are the density and color predicted by the MLP at sample point $\mathbf{r}(t_i)$, and $T_i$ is the accumulated transmittance (the probability that the ray has not been absorbed before reaching sample $i$).

### Hierarchical Sampling

Naively sampling $N$ points uniformly along each ray is wasteful — most of the ray passes through empty space or is occluded. NeRF uses a **two-pass hierarchical** strategy:

**Coarse network**: Sample $N_c = 64$ points uniformly along the ray. Render using a "coarse" MLP. The rendering weights $w_i = T_i \alpha_i$ form a piecewise-constant PDF along the ray.

**Fine network**: Normalize the coarse weights into a probability distribution and draw $N_f = 128$ additional samples via **inverse transform sampling**, concentrating points where the coarse network predicts high density. Render using a "fine" MLP on all $N_c + N_f = 192$ samples.

```python
def hierarchical_sample(bins, weights, n_fine_samples):
    """
    Sample from the piecewise-constant PDF defined by coarse weights.

    Args:
        bins: (N_c + 1,) bin edges along the ray
        weights: (N_c,) rendering weights from coarse pass
        n_fine_samples: number of fine samples to draw

    Returns:
        t_fine: (n_fine_samples,) new sample positions
    """
    # Normalize weights to form a PDF
    pdf = weights / (weights.sum() + 1e-5)

    # Compute CDF
    cdf = torch.cumsum(pdf, dim=0)
    cdf = torch.cat([torch.zeros(1), cdf])  # prepend 0

    # Inverse CDF sampling: draw uniform samples, find bin indices
    u = torch.rand(n_fine_samples)
    indices = torch.searchsorted(cdf, u, right=True)
    indices = indices.clamp(1, len(cdf) - 1)

    # Linear interpolation within each bin
    below = indices - 1
    cdf_below = cdf[below]
    cdf_above = cdf[indices]
    t_below = bins[below]
    t_above = bins[indices]

    denom = cdf_above - cdf_below
    denom = torch.where(denom < 1e-5, torch.ones_like(denom), denom)
    t_fine = t_below + (u - cdf_below) / denom * (t_above - t_below)

    return t_fine
```

### Training

NeRF is trained on a set of images $\{I_k\}$ with known camera poses. For each training step:

1. Sample a batch of rays from random pixels across training images
2. Evaluate both coarse and fine networks along each ray
3. Render pixel colors $\hat{C}_c(\mathbf{r})$ (coarse) and $\hat{C}_f(\mathbf{r})$ (fine)
4. Minimize the total photometric loss:

$$\mathcal{L} = \sum_{\mathbf{r} \in \mathcal{R}} \left[ \| \hat{C}_c(\mathbf{r}) - C(\mathbf{r}) \|_2^2 + \| \hat{C}_f(\mathbf{r}) - C(\mathbf{r}) \|_2^2 \right]$$

where $C(\mathbf{r})$ is the ground-truth pixel color. Training both networks jointly ensures the coarse network learns a reasonable density distribution for importance sampling.

### Limitations

| Limitation | Details |
|---|---|
| **Slow training** | ~1-2 days on a single GPU per scene |
| **Slow rendering** | ~30 seconds per 800x800 image (hundreds of MLP evaluations per ray) |
| **Per-scene** | A new network must be trained from scratch for each scene |
| **Static only** | No support for dynamic/moving scenes |
| **Aliasing** | Point sampling causes artifacts at different scales |
| **Bounded scenes** | Struggles with large, unbounded environments |

## Mip-NeRF: Anti-Aliased Cone Tracing (Barron et al. 2021)

### The Aliasing Problem

NeRF samples **points** along rays. But a pixel doesn't correspond to an infinitesimal ray — it subtends a small solid angle, forming a **cone**. At different camera distances, the same pixel covers vastly different scene volumes. Point sampling ignores this scale information, causing aliasing (jagged edges when zoomed out, blurring when zoomed in).

### Integrated Positional Encoding (IPE)

Mip-NeRF replaces point-sampled positional encoding with **integrated positional encoding** (IPE). Instead of encoding a single point, it encodes the expected value of the positional encoding over a **conical frustum** — the 3D region that a pixel's cone subtends between two sample distances.

Each conical frustum is approximated by a multivariate Gaussian $\mathcal{N}(\boldsymbol{\mu}, \boldsymbol{\Sigma})$. The integrated positional encoding is the expected value of $\gamma$ under this Gaussian:

$$\text{IPE}(\boldsymbol{\mu}, \boldsymbol{\Sigma}) = \mathbb{E}_{\mathbf{x} \sim \mathcal{N}(\boldsymbol{\mu}, \boldsymbol{\Sigma})} [\gamma(\mathbf{x})]$$

Because $\gamma$ uses sinusoids, this expectation has a **closed-form** solution. For a single frequency component:

$$\mathbb{E}[\sin(\omega^T \mathbf{x})] = \sin(\omega^T \boldsymbol{\mu}) \cdot \exp\left(-\tfrac{1}{2} \omega^T \boldsymbol{\Sigma} \omega\right)$$

The exponential factor $\exp(-\frac{1}{2}\omega^T \Sigma \omega)$ acts as a **low-pass filter**: high frequencies get attenuated when the frustum is large (far from camera), and preserved when the frustum is small (close to camera). This eliminates aliasing at its source.

### Architecture Changes

Mip-NeRF uses a **single** MLP (no separate coarse/fine networks) and replaces hierarchical sampling with iterative resampling — the same network is queried multiple times, each round refining the sample distribution using the previous round's weights.

## Instant-NGP: Hash Encoding for Speed (Muller et al. 2022)

### The Bottleneck

NeRF's MLP is a global function — evaluating it at any point requires a full forward pass through all 8 layers. This makes both training and inference extremely slow. Instant-NGP's key insight: replace most of the MLP's capacity with a **spatial data structure** — a multi-resolution hash table of trainable feature vectors.

### Multi-Resolution Hash Encoding

The hash encoding consists of $L$ resolution levels (typically $L = 16$), each containing a hash table of size $T$ (typically $T = 2^{19}$) storing $F$-dimensional feature vectors (typically $F = 2$).

**For each resolution level $l$:**

1. The resolution at level $l$ is computed as:

$$N_l = \lfloor N_{\min} \cdot b^l \rfloor, \quad b = \exp\left(\frac{\ln N_{\max} - \ln N_{\min}}{L - 1}\right)$$

where $N_{\min}$ and $N_{\max}$ define the coarsest and finest resolutions. For example, with $N_{\min} = 16$ and $N_{\max} = 2048$, the resolutions grow geometrically.

2. The input point $\mathbf{x}$ is scaled to level $l$'s grid: $\mathbf{x}_l = \mathbf{x} \cdot N_l$

3. The 8 corners of the enclosing voxel are found: $\lfloor \mathbf{x}_l \rfloor$ and $\lceil \mathbf{x}_l \rceil$ combinations

4. Each corner's integer coordinates $(i, j, k)$ are hashed to a table index:

$$h(i, j, k) = \left(i \oplus (j \cdot 2654435761) \oplus (k \cdot 805459861)\right) \mod T$$

where $\oplus$ is bitwise XOR and the constants are large primes. This spatial hash function distributes grid vertices pseudo-randomly across the table.

5. The 8 looked-up feature vectors are **trilinearly interpolated** based on the fractional position within the voxel

6. The interpolated $F$-dimensional features from all $L$ levels are **concatenated**, producing an $L \cdot F$-dimensional encoding

```python
import torch
import torch.nn as nn

class HashEncoding(nn.Module):
    """Simplified multi-resolution hash encoding (Muller et al. 2022)."""
    def __init__(self, n_levels=16, n_features=2, log2_hashmap_size=19,
                 base_resolution=16, max_resolution=2048):
        super().__init__()
        self.n_levels = n_levels
        self.n_features = n_features
        T = 2 ** log2_hashmap_size

        # Growth factor
        b = (max_resolution / base_resolution) ** (1.0 / (n_levels - 1))
        self.resolutions = [int(base_resolution * b ** l) for l in range(n_levels)]

        # One hash table per level: T entries of F-dim features
        self.hash_tables = nn.ParameterList([
            nn.Parameter(torch.randn(T, n_features) * 0.01)
            for _ in range(n_levels)
        ])
        self.T = T
        self.output_dim = n_levels * n_features

    def _hash(self, coords):
        """Spatial hash function mapping integer coords to table indices."""
        # coords: (..., 3) integer tensor
        x, y, z = coords[..., 0], coords[..., 1], coords[..., 2]
        h = x ^ (y * 2654435761) ^ (z * 805459861)
        return h % self.T

    def forward(self, x):
        # x: (..., 3) in [0, 1]^3
        outputs = []
        for l, table in enumerate(self.hash_tables):
            res = self.resolutions[l]
            # Scale to grid
            x_scaled = x * res
            # Floor and ceil for trilinear interpolation
            x0 = x_scaled.long().clamp(0, res - 1)
            x1 = (x0 + 1).clamp(0, res)
            # Fractional part
            w = x_scaled - x0.float()

            # 8 corners — trilinear interpolation (simplified)
            # In practice, enumerate all 2^3 corners and interpolate
            idx_000 = self._hash(x0)
            feat_000 = table[idx_000]
            # ... (full trilinear with all 8 corners)
            outputs.append(feat_000)  # simplified

        return torch.cat(outputs, dim=-1)
```

### The Tiny MLP

With the hash encoding handling spatial detail, only a **tiny MLP** is needed — typically 2 hidden layers with 64 neurons each. The total network has ~30K parameters, compared to NeRF's ~1.2M.

### Hash Collision Resolution

Different grid vertices may hash to the same table entry (collision). The multi-resolution structure naturally resolves this: collisions at fine levels are disambiguated by coarser levels that don't collide at the same locations. During training, gradients from colliding entries average out, and the network learns to rely on collision-free levels for fine detail. Muller et al. (2022) won the **SIGGRAPH Best Paper Award** for this work.

### Performance

| Metric | NeRF | Instant-NGP |
|---|---|---|
| Training time | ~12-24 hours | **~5 seconds** |
| Rendering speed | 30+ sec/frame | **~15 ms/frame** |
| Parameters | ~1.2M | ~12M (mostly hash tables) |
| Quality (PSNR) | ~31 dB | ~33 dB |

The speedup comes from replacing expensive MLP evaluations with fast hash table lookups (cache-friendly, parallelizable) plus a tiny decoder network.

## Zip-NeRF: Anti-Aliased Hash Grids (Barron et al. 2023)

### The Incompatibility Problem

Mip-NeRF provides anti-aliasing via integrated positional encoding, and Instant-NGP provides speed via hash grids. But the two approaches are **incompatible**: IPE requires integrating a smooth encoding over Gaussian volumes, while hash grid lookups are non-smooth (they depend on discrete hash collisions) and don't have a closed-form integral.

### The Solution: Multisampled Hash Encoding

Zip-NeRF approximates the integral of hash grid features over a conical frustum by:

1. **Supersampling**: Drawing multiple sample points from the Gaussian approximation of each frustum
2. **Averaging**: Computing the mean of hash grid features across these samples
3. **Scale-aware weighting**: Downweighting fine-resolution hash levels when the frustum is large (mimicking the low-pass filtering of IPE)

For each resolution level $l$, the weight is determined by comparing the frustum's spatial extent to the grid cell size at that level. If the frustum spans many cells, the features from that level are noisy and get downweighted via an error-function (erf) kernel:

$$w_l = \text{erf}\left(\frac{N_l \cdot r_{\text{frustum}}}{\sqrt{2}}\right)$$

where $r_{\text{frustum}}$ is the frustum radius and $N_l$ is the grid resolution. This smoothly transitions from full weight (frustum smaller than a cell) to zero weight (frustum spans many cells).

### Results

Zip-NeRF achieves **8-77% lower error** than either Mip-NeRF 360 or Instant-NGP alone, while training **24x faster** than Mip-NeRF 360. It is currently among the highest-quality NeRF methods for unbounded real-world scenes.

## Text-to-3D: DreamFusion and Score Distillation Sampling

### DreamFusion (Poole et al. 2022)

DreamFusion showed that a pretrained 2D text-to-image diffusion model can serve as a **3D prior**, enabling text-to-3D generation without any 3D training data. The key technique is **Score Distillation Sampling (SDS)**.

### How SDS Works

A NeRF (parameterized by $\theta$) is rendered from a random camera viewpoint to produce an image $\mathbf{x} = g(\theta)$. Noise is added to get $\mathbf{x}_t$. A pretrained diffusion model $\epsilon_\phi$ predicts the noise. The SDS gradient is:

$$\nabla_\theta \mathcal{L}_{\text{SDS}} = \mathbb{E}_{t, \epsilon} \left[ w(t) \left( \epsilon_\phi(\mathbf{x}_t; y, t) - \epsilon \right) \frac{\partial \mathbf{x}}{\partial \theta} \right]$$

where $y$ is the text prompt, $t$ is the noise level, $w(t)$ is a weighting function, and $\epsilon$ is the added noise. Intuitively, this gradient pushes the rendered image toward what the diffusion model considers a plausible image matching the text prompt.

```python
def sds_loss_gradient(nerf, diffusion_model, text_embedding, camera):
    """
    Compute Score Distillation Sampling gradient.

    Args:
        nerf: differentiable NeRF renderer
        diffusion_model: pretrained text-to-image diffusion model
        text_embedding: encoded text prompt
        camera: random camera viewpoint
    """
    # Render image from NeRF
    rendered_image = nerf.render(camera)  # (H, W, 3), differentiable

    # Sample random noise level
    t = torch.randint(20, 980, (1,))
    noise = torch.randn_like(rendered_image)

    # Add noise
    noisy_image = add_noise(rendered_image, noise, t)

    # Predict noise with frozen diffusion model
    with torch.no_grad():
        predicted_noise = diffusion_model(noisy_image, t, text_embedding)

    # SDS gradient: difference between predicted and actual noise
    # Backpropagate through the rendering only
    w = get_weight(t)
    grad = w * (predicted_noise - noise)

    # Apply gradient to rendered image (which propagates to NeRF params)
    rendered_image.backward(gradient=grad)
```

### Successors

- **Magic3D** (Lin et al. 2023) — coarse-to-fine with mesh extraction, higher resolution
- **ProlificDreamer** (Wang et al. 2023) — Variational Score Distillation (VSD) for higher quality and diversity
- **DreamGaussian** (Tang et al. 2023, ICLR 2024 Oral) — replaced NeRF with 3D Gaussians, achieving text/image-to-3D in ~2 minutes (10x faster than DreamFusion)

## Recent Developments (2024-2026)

### NeRF-Gaussian Hybrid Methods

Research in 2024-2025 explored combining NeRF's continuous spatial representation with Gaussian Splatting's rendering speed. **NeRF-GS** (Fang et al. ICCV 2025) uses a NeRF to provide spatial priors that improve Gaussian initialization, addressing 3DGS's sensitivity to initial point clouds.

### RadSplat (Niemeyer et al. 2024)

RadSplat uses a pre-trained radiance field to initialize and prune Gaussians, combining NeRF-quality geometry with Gaussian real-time rendering. The approach achieves state-of-the-art novel view synthesis quality while maintaining real-time frame rates.

### Feed-Forward Methods

Recent work has moved beyond per-scene optimization toward **feed-forward** prediction. Models like **pixelSplat** (Charatan et al. 2024) and **MVSplat** (Chen et al. 2024) predict 3D Gaussians from just 2-3 input images in a single forward pass (~50ms), without any test-time optimization. These combine encoder architectures (e.g., transformers, cost volumes) with Gaussian decoders.

### The Current Landscape (2025-2026)

The pure NeRF approach (MLP evaluated at every sample point) has largely been superseded for real-time applications. The field has converged on:

1. **3D Gaussian Splatting** for real-time rendering and editing
2. **Hash-grid NeRFs** (Instant-NGP, Zip-NeRF style) for highest-quality offline reconstruction
3. **Feed-forward models** for instant 3D from sparse views
4. **Hybrid NeRF-GS** methods that use NeRF pretraining to improve Gaussian quality

NeRF's enduring contribution is not the specific MLP architecture but the **framework**: differentiable volume rendering + photometric supervision = 3D from 2D. This principle underlies all subsequent methods.

## Exercises

<details>
<summary>Exercise: NeRF MLP Forward Pass</summary>

<p>Walk through the NeRF MLP for a single query point at position $\mathbf{x} = (0.5, 0.2, -0.3)$ viewed from direction $\mathbf{d} = (0, 0, -1)$. With $L=10$ for position and $L=4$ for direction, compute:</p>

<p>(a) The dimensionality of the encoded position $\gamma(\mathbf{x})$<br/>
(b) The dimensionality of the encoded direction $\gamma(\mathbf{d})$<br/>
(c) The total number of MLP parameters (8 layers of 256 + 1 layer of 128, including biases)</p>

<p><strong>Solution:</strong></p>

<p>(a) Position encoding: each of 3 coordinates gets $2 \times 10 = 20$ Fourier features plus the raw value = 21 per coordinate. Total: $3 \times 21 = 63$ dimensions.</p>

<p>(b) Direction encoding: each of 3 direction components gets $2 \times 4 = 8$ Fourier features plus the raw value = 9 per component. Total: $3 \times 9 = 27$ dimensions.</p>

<p>(c) Layer 1: $63 \times 256 + 256 = 16{,}384$. Layers 2-4: $256 \times 256 + 256 = 65{,}792$ each ($\times 3$). Layer 5 (skip connection): $(256 + 63) \times 256 + 256 = 81{,}920 + 256 = 82{,}176$. Layers 6-8: $65{,}792$ each ($\times 3$). Density output: $256 \times 1 = 256$. Bottleneck + direction: $(256 + 27) \times 128 + 128 = 36{,}352$. Color output: $128 \times 3 + 3 = 387$. Total $\approx 1.19$M parameters.</p>
</details>

<details>
<summary>Exercise: Hash Table Sizing</summary>

<p>An Instant-NGP encoding uses $L = 16$ levels, $F = 2$ features per entry, and hash tables of size $T = 2^{19} = 524{,}288$. The base resolution is $N_{\min} = 16$ and max is $N_{\max} = 2048$.</p>

<p>(a) Compute the growth factor $b$.<br/>
(b) What is the resolution at level $l = 8$?<br/>
(c) How much memory (in MB) do the hash tables consume, using 16-bit (half) floats?</p>

<p><strong>Solution:</strong></p>

<p>(a) $b = \exp\left(\frac{\ln 2048 - \ln 16}{15}\right) = \exp\left(\frac{\ln 128}{15}\right) = \exp\left(\frac{4.852}{15}\right) = \exp(0.3235) \approx 1.382$</p>

<p>(b) $N_8 = \lfloor 16 \times 1.382^8 \rfloor = \lfloor 16 \times 12.126 \rfloor = \lfloor 194.0 \rfloor = 194$. So at level 8, the grid has resolution $194^3$ (about 7.3M potential vertices, far exceeding the hash table size of 524K, so many collisions occur).</p>

<p>(c) 16 levels $\times$ 524,288 entries $\times$ 2 features $\times$ 2 bytes = $16 \times 524{,}288 \times 4 = 33{,}554{,}432$ bytes $= 32$ MB. This is the dominant memory cost — the tiny 2-layer MLP adds only ~16KB.</p>
</details>

<details>
<summary>Exercise: Volume Rendering with Hierarchical Sampling</summary>

<p>A coarse network produces the following weights for 4 bins along a ray:</p>

<p>Bin edges: $t = [2.0, 3.0, 4.0, 5.0, 6.0]$<br/>
Coarse weights: $w = [0.05, 0.70, 0.20, 0.05]$</p>

<p>Compute the CDF and determine where a fine sample at $u = 0.5$ would be placed via inverse CDF sampling.</p>

<p><strong>Solution:</strong></p>

<p>Normalize: weights already sum to 1.0, so PDF = $[0.05, 0.70, 0.20, 0.05]$</p>

<p>CDF = $[0.0, 0.05, 0.75, 0.95, 1.0]$ (prepend 0)</p>

<p>For $u = 0.5$: find the bin where $\text{CDF}[i] \leq 0.5 < \text{CDF}[i+1]$. That's bin 1 ($0.05 \leq 0.5 < 0.75$).</p>

<p>Interpolate within bin 1: $t = 3.0 + \frac{0.5 - 0.05}{0.75 - 0.05} \times (4.0 - 3.0) = 3.0 + \frac{0.45}{0.70} = 3.0 + 0.643 = 3.643$</p>

<p>The fine sample at $u=0.5$ lands at $t = 3.643$, which is within the highest-weight bin (bin 1, weight 0.70). This is exactly the purpose of hierarchical sampling — concentrating samples where the coarse pass found content.</p>
</details>

## Key Takeaways

- NeRF maps 5D coordinates $(\mathbf{x}, \mathbf{d})$ to color and density via an MLP, then volume-renders pixel colors through $\hat{C} = \sum_i T_i \alpha_i \mathbf{c}_i$ where $\alpha_i = 1 - \exp(-\sigma_i \delta_i)$
- **Positional encoding** with $L$ frequency bands is essential — without it, the MLP cannot represent high-frequency scene detail due to spectral bias
- **Hierarchical sampling** (coarse-to-fine) concentrates compute on regions with content, using the coarse network's weights as an importance sampling PDF
- **Mip-NeRF** eliminates aliasing by encoding conical frustums instead of points, using integrated positional encoding with a closed-form Gaussian expectation
- **Instant-NGP** replaces the large MLP with a multi-resolution hash encoding ($L$ levels, hash tables of size $T$, trilinear interpolation) plus a tiny 2-layer decoder, achieving 1000x speedup
- **Zip-NeRF** unifies Mip-NeRF's anti-aliasing with Instant-NGP's hash grids via multi-sampled, scale-aware feature averaging
- **Score Distillation Sampling** (DreamFusion) enables text-to-3D by using a frozen diffusion model as a 3D prior, with DreamGaussian (2024) achieving this in 2 minutes via Gaussian Splatting
- The NeRF paradigm (differentiable volume rendering + photometric loss) remains foundational even as explicit representations (Gaussians, hash grids) replace the MLP
