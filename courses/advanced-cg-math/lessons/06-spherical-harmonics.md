# Spherical Harmonics

Spherical harmonics (SH) provide an orthonormal basis for representing functions defined on the surface of a sphere. In computer graphics, they are used to compactly encode low-frequency lighting environments, irradiance maps, and visibility functions. With just 9 coefficients (order-2 / L2), SH captures over 99% of the energy in diffuse irradiance, making them ideal for real-time global illumination approximations, light probes, and precomputed radiance transfer.

## Motivation: Functions on the Sphere

Many quantities in rendering are naturally defined over directions (the unit sphere $S^2$):

- **Environment maps** — incoming radiance $L_i(\omega)$ from all directions
- **Irradiance** — integral of incoming light weighted by $\cos\theta$, a function of the surface normal direction
- **Visibility** — for each direction, whether the point can "see" the sky
- **BRDFs** — reflectance as a function of incoming/outgoing directions

Storing these as cube maps or lat-long textures requires thousands of values. For low-frequency functions (smooth, slowly varying), we can represent them with far fewer coefficients using a frequency-space basis — just as Fourier series represent periodic 1D functions.

Spherical harmonics are the spherical analog of Fourier series: they decompose functions on the sphere into frequency bands (low frequency = smooth, high frequency = sharp detail).

## Mathematical Foundation

### Legendre Polynomials

The Legendre polynomials $P_l(x)$ are solutions to Legendre's differential equation on $[-1, 1]$. The first few are:

$$P_0(x) = 1, \quad P_1(x) = x, \quad P_2(x) = \frac{1}{2}(3x^2 - 1), \quad P_3(x) = \frac{1}{2}(5x^3 - 3x)$$

They satisfy orthogonality: $\int_{-1}^{1} P_l(x) P_{l'}(x) \, dx = \frac{2}{2l+1} \delta_{ll'}$.

### Associated Legendre Polynomials

The associated Legendre polynomials $P_l^m(x)$ extend Legendre polynomials to handle azimuthal variation. They are defined for $0 \leq m \leq l$:

$$P_l^m(x) = (-1)^m (1 - x^2)^{m/2} \frac{d^m}{dx^m} P_l(x)$$

The factor $(1 - x^2)^{m/2} = \sin^m\theta$ introduces dependence on the polar angle that varies with $m$.

### Real Spherical Harmonics

The **real** spherical harmonics $Y_l^m(\theta, \phi)$ (as opposed to complex) are the standard in graphics. They are defined for band $l \geq 0$ and order $-l \leq m \leq l$:

$$Y_l^m(\theta, \phi) = \begin{cases} \sqrt{2} \, K_l^m \cos(m\phi) \, P_l^m(\cos\theta) & m > 0 \\ K_l^0 \, P_l^0(\cos\theta) & m = 0 \\ \sqrt{2} \, K_l^{|m|} \sin(|m|\phi) \, P_l^{|m|}(\cos\theta) & m < 0 \end{cases}$$

where the normalization constant is:

$$K_l^m = \sqrt{\frac{(2l+1)}{4\pi} \cdot \frac{(l - |m|)!}{(l + |m|)!}}$$

These functions form an **orthonormal** basis over the sphere:

$$\int_{S^2} Y_l^m(\omega) \, Y_{l'}^{m'}(\omega) \, d\omega = \delta_{ll'} \delta_{mm'}$$

## The First Three Bands Explicitly

Band $l$ contains $2l + 1$ basis functions. The total number of coefficients through band $l$ is $(l+1)^2$.

### Band 0 (l=0): 1 function — constant

$$Y_0^0 = \frac{1}{2\sqrt{\pi}} \approx 0.2821$$

This is the "DC" term — the average value of the function.

### Band 1 (l=1): 3 functions — linear (directional)

$$Y_1^{-1} = \sqrt{\frac{3}{4\pi}} \, y \approx 0.4886 \, y$$

$$Y_1^{0} = \sqrt{\frac{3}{4\pi}} \, z \approx 0.4886 \, z$$

$$Y_1^{1} = \sqrt{\frac{3}{4\pi}} \, x \approx 0.4886 \, x$$

where $(x, y, z)$ are the Cartesian components of the unit direction vector. Band 1 captures the dominant directional gradient (like "light is coming from the upper left").

### Band 2 (l=2): 5 functions — quadratic

$$Y_2^{-2} = \frac{1}{2}\sqrt{\frac{15}{\pi}} \, xy \approx 1.0925 \, xy$$

$$Y_2^{-1} = \frac{1}{2}\sqrt{\frac{15}{\pi}} \, yz \approx 1.0925 \, yz$$

$$Y_2^{0} = \frac{1}{4}\sqrt{\frac{5}{\pi}} \, (3z^2 - 1) \approx 0.3154 \, (3z^2 - 1)$$

$$Y_2^{1} = \frac{1}{2}\sqrt{\frac{15}{\pi}} \, xz \approx 1.0925 \, xz$$

$$Y_2^{2} = \frac{1}{4}\sqrt{\frac{15}{\pi}} \, (x^2 - y^2) \approx 0.5463 \, (x^2 - y^2)$$

Band 2 captures the major "lobes" — top vs. bottom, left vs. right, front vs. back differences, plus diagonal variations.

**Total through L2: 9 coefficients** — this is the standard representation for irradiance in real-time engines.

## Projection and Reconstruction

### Projection (Analysis)

To encode a spherical function $f(\omega)$ into SH coefficients:

$$c_l^m = \int_{S^2} f(\omega) \, Y_l^m(\omega) \, d\omega$$

In practice, this is computed via Monte Carlo integration: sample $N$ directions uniformly on the sphere and accumulate:

$$c_l^m \approx \frac{4\pi}{N} \sum_{i=1}^{N} f(\omega_i) \, Y_l^m(\omega_i)$$

### Reconstruction (Synthesis)

To recover the function from its coefficients:

$$\tilde{f}(\omega) = \sum_{l=0}^{L} \sum_{m=-l}^{l} c_l^m \, Y_l^m(\omega)$$

where $L$ is the maximum band. As $L \to \infty$, $\tilde{f} \to f$ (for square-integrable functions). Truncating at band $L$ is equivalent to low-pass filtering — high-frequency detail is lost.

### Parseval's Theorem

The energy is preserved across domains:

$$\int_{S^2} |f(\omega)|^2 \, d\omega = \sum_{l,m} |c_l^m|^2$$

This lets us measure how much energy is captured by a given number of bands.

## Irradiance Environment Maps Using SH

The landmark result of Ramamoorthi and Hanrahan (2001) showed that **diffuse irradiance from an environment map requires only 9 SH coefficients**.

The irradiance at a surface point with normal $\mathbf{n}$ is:

$$E(\mathbf{n}) = \int_{\Omega(\mathbf{n})} L_i(\omega) \max(\mathbf{n} \cdot \omega, 0) \, d\omega$$

The clamped cosine lobe $\max(\cos\theta, 0)$ acts as a low-pass filter on the environment. Its SH expansion has rapidly decaying coefficients:

| Band | Fraction of energy |
|---|---|
| L0 | ~75% |
| L0 + L1 | ~97% |
| L0 + L1 + L2 | ~99.2% |

Beyond L2, the cosine lobe has negligible energy. This means irradiance is almost perfectly represented by 9 coefficients regardless of the environment complexity.

### The Convolution Property

Because the cosine kernel is **zonal** (depends only on $\theta$, not $\phi$), the irradiance computation in SH reduces to a simple product:

$$E_l^m = A_l \cdot L_l^m$$

where $L_l^m$ are the SH coefficients of the environment, and $A_l$ are the **zonal harmonic coefficients** of the cosine kernel:

$$A_0 = \pi, \quad A_1 = \frac{2\pi}{3}, \quad A_2 = \frac{\pi}{4}, \quad A_l = 0 \text{ for odd } l \geq 3$$

(More precisely, $A_l = 2\pi \frac{\hat{K}_l}{}$ where $\hat{K}_l$ is the cosine kernel's zonal coefficient, but the simplified form above is standard.)

The irradiance at normal direction $\mathbf{n}$ is then:

$$E(\mathbf{n}) = \sum_{l=0}^{2} \sum_{m=-l}^{l} A_l \, L_l^m \, Y_l^m(\mathbf{n})$$

This is just a **dot product** of 9 precomputed weighted coefficients with 9 SH basis evaluations — extremely fast.

## GLSL: Evaluating L2 SH Irradiance

```glsl
// SH coefficients for irradiance (9 vec3 values, pre-multiplied by A_l)
uniform vec3 shCoeffs[9];

// Evaluate order-2 SH irradiance for normal direction n
vec3 evaluateSHIrradiance(vec3 n) {
    // Band 0 (constant)
    vec3 irradiance = shCoeffs[0] * 0.282095;  // Y_0^0

    // Band 1 (linear)
    irradiance += shCoeffs[1] * 0.488603 * n.y;   // Y_1^-1
    irradiance += shCoeffs[2] * 0.488603 * n.z;   // Y_1^0
    irradiance += shCoeffs[3] * 0.488603 * n.x;   // Y_1^1

    // Band 2 (quadratic)
    irradiance += shCoeffs[4] * 1.092548 * n.x * n.y;         // Y_2^-2
    irradiance += shCoeffs[5] * 1.092548 * n.y * n.z;         // Y_2^-1
    irradiance += shCoeffs[6] * 0.315392 * (3.0 * n.z * n.z - 1.0); // Y_2^0
    irradiance += shCoeffs[7] * 1.092548 * n.x * n.z;         // Y_2^1
    irradiance += shCoeffs[8] * 0.546274 * (n.x * n.x - n.y * n.y); // Y_2^2

    return max(irradiance, vec3(0.0));
}
```

This shader runs in constant time regardless of the environment map resolution — the entire lighting environment is encoded in just 9 `vec3` uniforms (27 floats).

## Rotation of Spherical Harmonics

A crucial advantage of SH: rotating the represented function is a **linear operation** within each band. If a function has SH coefficients $c_l^m$, rotating it by rotation matrix $R$ gives new coefficients:

$$c_l^{m'} = \sum_{m=-l}^{l} D_l^{m'm}(R) \, c_l^m$$

where $D_l$ is the $(2l+1) \times (2l+1)$ Wigner D-matrix for band $l$. For L2 (9 coefficients), this is:
- Band 0: $1 \times 1$ matrix (scalar — rotation invariant)
- Band 1: $3 \times 3$ matrix (identical to the 3D rotation matrix $R$ itself)
- Band 2: $5 \times 5$ matrix (computed from $R$)

This property means we can rotate environment lighting by transforming 9 coefficients instead of rotating an entire cube map.

## Precomputed Radiance Transfer (PRT)

Sloan, Kautz, and Snyder (2002) introduced **PRT**, which precomputes how each vertex responds to low-frequency lighting encoded in SH.

### Diffuse PRT

For a diffuse surface at vertex $\mathbf{p}$, the transfer function captures visibility and the cosine term:

$$T_l^m(\mathbf{p}) = \int_{\Omega} V(\mathbf{p}, \omega) \max(\mathbf{n} \cdot \omega, 0) \, Y_l^m(\omega) \, d\omega$$

where $V(\mathbf{p}, \omega)$ is the binary visibility function (1 if unoccluded, 0 if shadowed).

The irradiance at the vertex is then a dot product of the transfer coefficients with the lighting coefficients:

$$E(\mathbf{p}) = \sum_{l,m} L_l^m \, T_l^m(\mathbf{p})$$

**Precomputation** (offline): ray-cast from each vertex to compute $T_l^m$ via Monte Carlo.
**Runtime** (real-time): evaluate a 9-term dot product per vertex. Lighting can change freely — only the SH lighting coefficients need updating.

### Glossy PRT

For glossy surfaces, the transfer is a function of both the view direction and the lighting. This requires storing a matrix of transfer coefficients per vertex (9x9 for L2), which is more expensive but still enables real-time evaluation of complex light transport including interreflections, soft shadows, and caustics.

## Zonal Harmonics Optimization

**Zonal harmonics** (ZH) are the subset of SH with $m = 0$. They are rotationally symmetric about a single axis. Any ZH function can be represented by just $L+1$ coefficients instead of $(L+1)^2$.

ZH are useful when the function being represented has a dominant axis of symmetry — like a cosine lobe oriented along the normal. The convolution theorem is particularly clean for ZH, making them efficient for operations like:

- Evaluating irradiance (the cosine kernel is zonal)
- Ambient occlusion (often approximately zonal)
- Simple visibility cones

Sloan (2008) in "Stupid Spherical Harmonics Tricks" provides extensive practical recipes for ZH optimizations, product operations, and fast rotation.

## SH in Modern Engines

### Unity (Light Probes)

Unity bakes diffuse lighting into **Light Probes** — tetrahedral grids of L2 SH coefficients. At runtime, each dynamic object samples the nearest probes and interpolates their SH coefficients. The shader evaluates the 9-term polynomial shown above. Unity stores SH data as three groups:

- `unity_SHAr/Ag/Ab` — band 0 + band 1 (packed into 3 `float4`)
- `unity_SHBr/Bg/Bb` — band 2 (packed into 3 `float4`)
- `unity_SHC` — band 2 remainder (1 `float4`)

### Unreal Engine (Indirect Lighting Cache)

Unreal uses L2 SH in its **volumetric lightmap** system and **indirect lighting cache**. Lightmass bakes irradiance SH into a 3D grid. Characters and dynamic objects sample this grid at runtime.

### 3D Gaussian Splatting (2023-2025)

A major modern application of SH is in **3D Gaussian Splatting** (Kerbl et al. 2023), where each Gaussian primitive stores SH coefficients to represent view-dependent color. Typically, degree-3 SH (16 coefficients per color channel) captures specular highlights and view-dependent effects. Recent work like **Dual SH** (2024) separates diffuse and specular components using distinct SH parameterizations, and **SG-Splatting** (2025) replaces high-order SH with spherical Gaussians for parameter efficiency.

### Neural Precomputed Radiance Transfer

Rainer et al. (2022) introduced **Neural PRT**, replacing the SH transfer matrix with a small neural network per vertex that maps SH lighting coefficients to outgoing radiance. This supports all-frequency effects (sharp shadows, glossy reflections) that classical SH PRT cannot capture, at the cost of neural network evaluation. TransGI (2025) extends this with vertex-attached latents and neural transfer decoders for real-time dynamic GI.

<details>
<summary>Exercise: Count SH coefficients</summary>
<p>How many SH coefficients are needed through band $L=4$? List the number per band.</p>
<p><strong>Solution:</strong></p>
<p>Band 0: $2(0)+1 = 1$ coefficient</p>
<p>Band 1: $2(1)+1 = 3$ coefficients</p>
<p>Band 2: $2(2)+1 = 5$ coefficients</p>
<p>Band 3: $2(3)+1 = 7$ coefficients</p>
<p>Band 4: $2(4)+1 = 9$ coefficients</p>
<p>Total: $(4+1)^2 = 25$ coefficients</p>
</details>

<details>
<summary>Exercise: Evaluate SH basis at a direction</summary>
<p>Compute all 9 real SH basis values ($Y_0^0$ through $Y_2^2$) for the direction $\mathbf{n} = (0, 0, 1)$ (straight up / +Z).</p>
<p><strong>Solution:</strong></p>
<p>With $x=0, y=0, z=1$:</p>
<p>$Y_0^0 = 0.2821$</p>
<p>$Y_1^{-1} = 0.4886 \cdot 0 = 0$</p>
<p>$Y_1^{0} = 0.4886 \cdot 1 = 0.4886$</p>
<p>$Y_1^{1} = 0.4886 \cdot 0 = 0$</p>
<p>$Y_2^{-2} = 1.0925 \cdot 0 \cdot 0 = 0$</p>
<p>$Y_2^{-1} = 1.0925 \cdot 0 \cdot 1 = 0$</p>
<p>$Y_2^{0} = 0.3154 \cdot (3 \cdot 1 - 1) = 0.3154 \cdot 2 = 0.6308$</p>
<p>$Y_2^{1} = 1.0925 \cdot 0 \cdot 1 = 0$</p>
<p>$Y_2^{2} = 0.5463 \cdot (0 - 0) = 0$</p>
<p>Only the $m=0$ (zonal) terms are non-zero for the pole direction, as expected from azimuthal symmetry.</p>
</details>

<details>
<summary>Exercise: SH irradiance with a directional light</summary>
<p>A single white directional light of intensity $I=3$ shines from direction $\mathbf{d} = (0, 1, 0)$ (+Y). Write its SH representation through L2, then compute the irradiance at a surface with normal $\mathbf{n} = (0, 0.707, 0.707)$ (45 degrees between Y and Z).</p>
<p><strong>Solution:</strong></p>
<p>A directional light from direction $\mathbf{d}$ is a Dirac delta $L(\omega) = I \cdot \delta(\omega - \mathbf{d})$. Its SH coefficients are $L_l^m = I \cdot Y_l^m(\mathbf{d})$.</p>
<p>Evaluating at $\mathbf{d} = (0,1,0)$:</p>
<p>$L_0^0 = 3 \times 0.2821 = 0.8463$</p>
<p>$L_1^{-1} = 3 \times 0.4886 \times 1 = 1.4658$</p>
<p>$L_1^{0} = 3 \times 0.4886 \times 0 = 0$</p>
<p>$L_1^{1} = 3 \times 0.4886 \times 0 = 0$</p>
<p>$L_2^{-2} = 3 \times 1.0925 \times 0 = 0$</p>
<p>$L_2^{-1} = 3 \times 1.0925 \times 0 = 0$</p>
<p>$L_2^{0} = 3 \times 0.3154 \times (0-1) = -0.9462$</p>
<p>$L_2^{1} = 3 \times 1.0925 \times 0 = 0$</p>
<p>$L_2^{2} = 3 \times 0.5463 \times (0-1) = -1.6389$</p>
<p>Irradiance: $E(\mathbf{n}) = \sum A_l L_l^m Y_l^m(\mathbf{n})$ with $A_0=\pi, A_1=2\pi/3, A_2=\pi/4$.</p>
<p>At $\mathbf{n}=(0, 0.707, 0.707)$:</p>
<p>$E = \pi(0.8463)(0.2821) + \frac{2\pi}{3}(1.4658)(0.4886 \times 0.707) + \frac{\pi}{4}(-0.9462)(0.3154)(3 \times 0.5 - 1) + \frac{\pi}{4}(-1.6389)(0.5463)(0 - 0.5)$</p>
<p>$\approx 0.749 + 1.064 + (-0.037) + 0.353 \approx 2.13$</p>
<p>This matches the expected value: $I \cdot \max(\mathbf{n} \cdot \mathbf{d}, 0) = 3 \times 0.707 = 2.12$.</p>
</details>

## Key Takeaways

- Spherical harmonics are an orthonormal basis for functions on the sphere, analogous to Fourier series on the circle.
- The first 3 bands (L2) provide **9 coefficients** that capture over 99% of diffuse irradiance energy (Ramamoorthi & Hanrahan 2001).
- SH evaluation is a simple polynomial in the direction components $(x, y, z)$ — no trigonometric functions needed at runtime.
- **Rotation** of SH-encoded functions is a linear transformation within each band, enabling efficient relighting.
- **Precomputed Radiance Transfer** (Sloan et al. 2002) precomputes per-vertex transfer vectors that encode visibility and BRDF response, enabling real-time soft shadows and interreflections under dynamic low-frequency lighting.
- **Zonal harmonics** optimize operations involving rotationally symmetric kernels (cosine lobe, AO cones).
- Modern engines (Unity Light Probes, Unreal Lightmaps) use L2 SH for real-time indirect lighting on dynamic objects.
- **3D Gaussian Splatting** (2023+) uses SH coefficients per Gaussian to encode view-dependent appearance, a major new application of SH in neural rendering.
- **Neural PRT** (2022+) replaces classical SH transfer with neural networks for all-frequency effects while retaining the SH lighting representation.
