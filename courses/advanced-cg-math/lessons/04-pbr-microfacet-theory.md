# Physically Based Rendering and Microfacet Theory

Physically based rendering (PBR) has become the standard shading approach in real-time and offline graphics. It replaces ad-hoc lighting models like Phong and Blinn-Phong with models grounded in the physics of light transport: energy conservation, Fresnel reflectance, and statistical descriptions of microscopic surface detail. This lesson builds from the rendering equation through BRDF properties to the full Cook-Torrance microfacet specular model used in every modern engine.

## Why Phong/Blinn-Phong Falls Short

The Phong and Blinn-Phong models served real-time graphics for decades, but they have fundamental physical shortcomings:

1. **No energy conservation** — the diffuse and specular terms are added independently with artist-tuned coefficients. Nothing prevents them from reflecting more light than arrives. A white sphere can appear to glow.
2. **No Fresnel effect** — real materials become more reflective at grazing angles. Blinn-Phong uses the same specular strength regardless of view angle.
3. **Incorrect highlight shape** — the cosine-power lobe does not match measured BRDFs of real materials, especially metals and rough dielectrics.
4. **No roughness-based behavior** — shininess is a single exponent disconnected from any physical surface property.

PBR addresses all of these by deriving shading from measurable material properties and enforcing physical constraints.

## The Rendering Equation Recap

All physically based shading derives from Kajiya's rendering equation (1986):

$$L_o(\mathbf{p}, \omega_o) = L_e(\mathbf{p}, \omega_o) + \int_{\Omega} f_r(\mathbf{p}, \omega_i, \omega_o) \, L_i(\mathbf{p}, \omega_i) \, (\omega_i \cdot \mathbf{n}) \, d\omega_i$$

- $L_o$ — outgoing radiance at point $\mathbf{p}$ in direction $\omega_o$
- $L_e$ — emitted radiance (zero for non-emissive surfaces)
- $f_r$ — the **Bidirectional Reflectance Distribution Function** (BRDF)
- $L_i$ — incoming radiance from direction $\omega_i$
- $\omega_i \cdot \mathbf{n}$ — Lambert's cosine term
- $\Omega$ — the hemisphere of incoming directions above the surface

The BRDF $f_r$ is the central object. Everything in PBR is about choosing a physically plausible BRDF and evaluating the integral efficiently.

## BRDF Properties

A physically valid BRDF must satisfy three properties:

### Positivity

$$f_r(\omega_i, \omega_o) \geq 0 \quad \forall \, \omega_i, \omega_o$$

A BRDF never returns negative values — you cannot subtract light.

### Helmholtz Reciprocity

$$f_r(\omega_i, \omega_o) = f_r(\omega_o, \omega_i)$$

Swapping the light and view directions produces the same BRDF value. This is a fundamental symmetry of light transport (required for bidirectional methods to work correctly).

### Energy Conservation

$$\int_{\Omega} f_r(\omega_i, \omega_o) \, (\omega_o \cdot \mathbf{n}) \, d\omega_o \leq 1 \quad \forall \, \omega_i$$

A surface cannot reflect more energy than it receives. The reflected energy across the full hemisphere must not exceed the incoming energy.

## The Cook-Torrance Specular Model

The standard PBR BRDF splits reflectance into diffuse and specular components:

$$f_r = k_d \, f_{\text{Lambert}} + f_{\text{Cook-Torrance}}$$

where $k_d = 1 - F$ ensures energy conservation (energy not reflected specularly is available for diffuse).

### Lambertian Diffuse

$$f_{\text{Lambert}} = \frac{c}{\pi}$$

where $c$ is the surface albedo (base color). The $\frac{1}{\pi}$ normalization factor ensures the integral over the hemisphere equals $c$, not $\pi c$.

### Cook-Torrance Specular

The specular term from Cook and Torrance (1982) is:

$$f_{\text{Cook-Torrance}} = \frac{D(\mathbf{h}) \, F(\omega_i, \mathbf{h}) \, G(\omega_i, \omega_o, \mathbf{h})}{4 \, (\omega_i \cdot \mathbf{n}) \, (\omega_o \cdot \mathbf{n})}$$

where $\mathbf{h}$ is the half-vector: $\mathbf{h} = \text{normalize}(\omega_i + \omega_o)$.

The three functions D, F, and G model different aspects of microfacet reflection:

- **D** — Normal Distribution Function: fraction of microfacets aligned with $\mathbf{h}$
- **F** — Fresnel term: fraction of light reflected vs. refracted at each microfacet
- **G** — Geometry / Masking-Shadowing: fraction of microfacets visible to both light and camera

## Microfacet Theory

Microfacet theory models a surface as a collection of tiny, perfectly flat mirrors (microfacets), each with its own normal. At the macroscopic scale, we see the statistical aggregate of these mirrors.

A **rough** surface has microfacets pointing in many directions (broad distribution), while a **smooth** surface has microfacets mostly aligned with the macroscopic normal (narrow distribution).

Only microfacets whose normal equals the half-vector $\mathbf{h}$ can reflect light from $\omega_i$ to $\omega_o$. The three D/F/G terms quantify how many such facets exist (D), how much light they reflect (F), and how many are unoccluded (G).

## The D Term: Normal Distribution Function

The NDF gives the density of microfacets with normals aligned to a given direction. The industry standard is **GGX** (Trowbridge-Reitz), introduced by Walter et al. (2007):

$$D_{\text{GGX}}(\mathbf{h}) = \frac{\alpha^2}{\pi \bigl((\mathbf{n} \cdot \mathbf{h})^2 (\alpha^2 - 1) + 1\bigr)^2}$$

where $\alpha = \text{roughness}^2$ (perceptually linear roughness is squared for the distribution).

**Why GGX?** Compared to the older Beckmann distribution, GGX has wider tails — the highlight falls off more gradually, matching real-world materials much better. This "long tail" produces the characteristic soft halo seen on rough metals and plastics.

### Properties of the NDF

- $D(\mathbf{h}) \geq 0$
- The projected area of microfacets must equal the macroscopic projected area: $\int_{\Omega} D(\mathbf{h}) \, (\mathbf{n} \cdot \mathbf{h}) \, d\omega_h = 1$
- As $\alpha \to 0$, the distribution approaches a Dirac delta (perfect mirror).

## The F Term: Fresnel Reflectance

The Fresnel equations describe how much light is reflected at a boundary between two media. At normal incidence, the reflectance is $F_0$; at grazing angles, it approaches 1 for all materials.

### Full Fresnel Equations (unpolarized light)

$$F = \frac{1}{2}\left(\frac{n_1 \cos\theta_i - n_2 \cos\theta_t}{n_1 \cos\theta_i + n_2 \cos\theta_t}\right)^2 + \frac{1}{2}\left(\frac{n_2 \cos\theta_i - n_1 \cos\theta_t}{n_2 \cos\theta_i + n_1 \cos\theta_t}\right)^2$$

where $\theta_t$ is the refracted angle from Snell's law: $n_1 \sin\theta_i = n_2 \sin\theta_t$.

### Schlick Approximation (1994)

The full equations are expensive. Schlick's approximation is nearly indistinguishable for real-time use:

$$F_{\text{Schlick}}(\omega_i, \mathbf{h}) = F_0 + (1 - F_0)(1 - \omega_i \cdot \mathbf{h})^5$$

$F_0$ is the reflectance at normal incidence, derived from the index of refraction:

$$F_0 = \left(\frac{n_1 - n_2}{n_1 + n_2}\right)^2$$

**Typical $F_0$ values:**

| Material | $F_0$ |
|---|---|
| Water | 0.02 |
| Plastic / Glass | 0.04 |
| Diamond | 0.17 |
| Iron | (0.56, 0.57, 0.58) |
| Gold | (1.00, 0.71, 0.29) |
| Copper | (0.95, 0.64, 0.54) |

Note that metals have colored $F_0$ (they absorb certain wavelengths even at normal incidence), while dielectrics have achromatic (gray) $F_0$.

## The G Term: Geometry / Masking-Shadowing

Microfacets can occlude each other in two ways:

- **Masking** — a microfacet is hidden from the viewer by a neighboring facet
- **Shadowing** — a microfacet is hidden from the light source

The geometry function $G(\omega_i, \omega_o, \mathbf{h})$ returns the fraction of microfacets that are both visible and illuminated. The standard choice is the **Smith GGX** function, which separates masking and shadowing:

$$G(\omega_i, \omega_o) = G_1(\omega_i) \cdot G_1(\omega_o)$$

where:

$$G_1(\omega) = \frac{2 \, (\mathbf{n} \cdot \omega)}{(\mathbf{n} \cdot \omega) + \sqrt{\alpha^2 + (1 - \alpha^2)(\mathbf{n} \cdot \omega)^2}}$$

This is the **Smith height-correlated masking-shadowing function** for the GGX distribution. Some engines use the Schlick-GGX approximation, substituting $k = \frac{\alpha}{2}$:

$$G_{\text{Schlick-GGX}}(\omega) = \frac{\mathbf{n} \cdot \omega}{(\mathbf{n} \cdot \omega)(1 - k) + k}$$

Note: $k$ differs for direct lighting ($k = \frac{(\text{roughness} + 1)^2}{8}$ per Karis 2013) vs. IBL ($k = \frac{\alpha^2}{2}$).

## Putting It All Together: Complete BRDF

Combining Lambert diffuse and Cook-Torrance specular with Fresnel-weighted energy distribution:

$$f_r = (1 - F) \cdot \frac{\text{albedo}}{\pi} + \frac{D \cdot F \cdot G}{4 \, (\mathbf{n} \cdot \omega_i)(\mathbf{n} \cdot \omega_o)}$$

The Fresnel term $F$ naturally controls the diffuse/specular balance — at normal incidence, most light enters a dielectric for diffuse scattering; at grazing angles, almost all light reflects specularly.

### Complete GLSL PBR Fragment Shader

```glsl
#version 330 core

const float PI = 3.14159265359;

// -- Normal Distribution Function: GGX/Trowbridge-Reitz --
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a  = roughness * roughness;
    float a2 = a * a;
    float NdotH  = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / (PI * denom * denom);
}

// -- Fresnel: Schlick approximation --
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// -- Geometry: Smith GGX (single direction) --
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;  // direct lighting remapping
    return NdotV / (NdotV * (1.0 - k) + k);
}

// -- Geometry: Smith method (combined masking + shadowing) --
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    return geometrySchlickGGX(NdotV, roughness) *
           geometrySchlickGGX(NdotL, roughness);
}

// -- Main PBR shading --
uniform vec3  albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;

uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];
uniform vec3 camPos;

in vec3 FragPos;
in vec3 Normal;

out vec4 FragColor;

void main() {
    vec3 N = normalize(Normal);
    vec3 V = normalize(camPos - FragPos);

    // Dielectrics have F0 ~0.04; metals use albedo as F0
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);

    vec3 Lo = vec3(0.0);
    for (int i = 0; i < 4; ++i) {
        // Per-light radiance
        vec3  L    = normalize(lightPositions[i] - FragPos);
        vec3  H    = normalize(V + L);
        float dist = length(lightPositions[i] - FragPos);
        float atten = 1.0 / (dist * dist);
        vec3  radiance = lightColors[i] * atten;

        // Cook-Torrance BRDF
        float D = distributionGGX(N, H, roughness);
        vec3  F = fresnelSchlick(max(dot(H, V), 0.0), F0);
        float G = geometrySmith(N, V, L, roughness);

        vec3  numerator   = D * F * G;
        float denominator = 4.0 * max(dot(N, V), 0.0)
                                * max(dot(N, L), 0.0) + 0.0001;
        vec3  specular = numerator / denominator;

        // Energy conservation: kD + kS = 1
        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;  // metals have no diffuse

        float NdotL = max(dot(N, L), 0.0);
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }

    // Ambient approximation
    vec3 ambient = vec3(0.03) * albedo * ao;
    vec3 color = ambient + Lo;

    // HDR tone mapping + gamma
    color = color / (color + vec3(1.0));  // Reinhard
    color = pow(color, vec3(1.0 / 2.2));

    FragColor = vec4(color, 1.0);
}
```

## The Metallic-Roughness Workflow

Modern PBR engines (UE4/5, Unity HDRP, glTF) use the **metallic-roughness** parameterization introduced by Disney (Burley 2012) and popularized by Karis (2013):

| Parameter | Range | Meaning |
|---|---|---|
| **Base Color** (albedo) | RGB [0,1] | Diffuse color for dielectrics, $F_0$ for metals |
| **Metallic** | [0, 1] | 0 = dielectric, 1 = metal |
| **Roughness** | [0, 1] | 0 = mirror, 1 = fully rough |

When `metallic = 1`:
- $F_0$ = base color (colored specular reflection)
- Diffuse = 0 (metals absorb refracted light immediately)

When `metallic = 0`:
- $F_0$ = 0.04 (standard dielectric reflectance)
- Diffuse = base color

This workflow reduces artist error because the parameter space is physically constrained.

## Multi-Scattering Energy Compensation

The standard single-scattering Cook-Torrance model loses energy at high roughness because it only accounts for light that bounces once off microfacets. Light that bounces multiple times between facets is ignored, causing rough surfaces to appear too dark.

Kulla and Conty (2017) proposed an energy compensation term: a diffuse-like lobe that adds back the missing energy, estimated via a precomputed lookup table of the directional albedo $E(\mu)$:

$$f_{\text{ms}} = \frac{(1 - E(\mu_i))(1 - E(\mu_o))}{\pi(1 - E_{\text{avg}})}$$

where $E_{\text{avg}} = 2\int_0^1 E(\mu) \, \mu \, d\mu$. Turquin (2019) later presented a simplified analytic approximation achieving similar results with less precomputation.

## Image-Based Lighting: Split-Sum Approximation

For environment map lighting, we must evaluate:

$$L_o = \int_{\Omega} f_r(\omega_i, \omega_o) \, L_i(\omega_i) \, (\mathbf{n} \cdot \omega_i) \, d\omega_i$$

Computing this integral per-pixel in real-time is infeasible. Karis (2013) introduced the **split-sum approximation**, factoring the integral into two precomputable parts:

$$L_o \approx \underbrace{\left(\int_{\Omega} L_i(\omega_i) \, D(\omega_i) \, d\omega_i \right)}_{\text{Pre-filtered environment map}} \cdot \underbrace{\left(\int_{\Omega} f_r(\omega_i, \omega_o) \, (\mathbf{n} \cdot \omega_i) \, d\omega_i \right)}_{\text{BRDF integration (2D LUT)}}$$

1. **Pre-filtered environment map** — For each roughness level, convolve the environment map with the GGX lobe. Store as a mip-chain where higher mips correspond to rougher surfaces.
2. **BRDF integration LUT** — A 2D texture indexed by $(\cos\theta_v, \text{roughness})$ storing a scale and bias for $F_0$: the integral evaluates to $F_0 \cdot \text{scale} + \text{bias}$.

```glsl
// IBL specular via split-sum
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) *
           pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
vec3 R = reflect(-V, N);

// Sample pre-filtered map at roughness mip level
vec3 prefilteredColor = textureLod(prefilterMap, R, roughness * MAX_MIP).rgb;

// Sample BRDF LUT
vec2 envBRDF = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;

vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
```

<details>
<summary>Exercise: Compute Fresnel at grazing angle</summary>
<p>Given a dielectric with index of refraction $n = 1.5$ (glass), compute $F_0$ and then use Schlick's approximation to find the Fresnel reflectance at $\theta = 80°$.</p>
<p><strong>Solution:</strong></p>
<p>$F_0 = \left(\frac{1.0 - 1.5}{1.0 + 1.5}\right)^2 = \left(\frac{-0.5}{2.5}\right)^2 = 0.04$</p>
<p>At $\theta = 80°$: $\cos\theta = \cos(80°) \approx 0.1736$</p>
<p>$F = 0.04 + (1 - 0.04)(1 - 0.1736)^5 = 0.04 + 0.96 \times 0.8264^5$</p>
<p>$0.8264^5 \approx 0.3878$</p>
<p>$F \approx 0.04 + 0.96 \times 0.3878 \approx 0.04 + 0.372 \approx 0.412$</p>
<p>So even glass, which reflects only 4% at normal incidence, reflects about 41% at 80 degrees.</p>
</details>

<details>
<summary>Exercise: Verify NDF normalization</summary>
<p>Show that the GGX NDF satisfies its normalization condition for the special case where $\alpha = 1$ (fully rough). Specifically, verify that $\int_0^{\pi/2} D(\theta) \cos\theta \sin\theta \, d\theta = \frac{1}{2\pi}$ when integrated in spherical coordinates over the hemisphere.</p>
<p><strong>Solution:</strong></p>
<p>With $\alpha = 1$, $a^2 = 1$, the GGX NDF becomes:</p>
<p>$D(\theta) = \frac{1}{\pi(\cos^2\theta(1-1)+1)^2} = \frac{1}{\pi}$</p>
<p>The integral becomes $\frac{1}{\pi}\int_0^{\pi/2}\cos\theta\sin\theta\,d\theta = \frac{1}{\pi}\cdot\frac{1}{2} = \frac{1}{2\pi}$.</p>
<p>Multiplying by $2\pi$ (azimuthal integration): $2\pi \cdot \frac{1}{2\pi} = 1$. The normalization holds.</p>
</details>

<details>
<summary>Exercise: Energy conservation check</summary>
<p>A material has metallic = 0 (dielectric), roughness = 0.5, and albedo = (0.8, 0.2, 0.1). At normal incidence ($\omega_i \cdot \mathbf{h} = 1$), what fraction of incoming light goes to diffuse vs. specular?</p>
<p><strong>Solution:</strong></p>
<p>For a dielectric, $F_0 = 0.04$. At normal incidence:</p>
<p>$F = 0.04 + 0.96 \times (1 - 1)^5 = 0.04$</p>
<p>So $k_S = 0.04$ (4% specular) and $k_D = 1 - 0.04 = 0.96$ (96% diffuse).</p>
<p>Diffuse contribution: $0.96 \times \frac{(0.8, 0.2, 0.1)}{\pi} \approx (0.245, 0.061, 0.031)$</p>
<p>This shows that dielectrics at normal incidence are overwhelmingly diffuse, matching intuition.</p>
</details>

## Key Takeaways

- PBR replaces ad-hoc shading with models derived from the rendering equation, enforcing energy conservation, reciprocity, and Fresnel reflectance.
- The Cook-Torrance specular BRDF is the product of three terms — NDF (D), Fresnel (F), and Geometry (G) — divided by a normalization factor.
- **GGX/Trowbridge-Reitz** (Walter et al. 2007) is the industry-standard NDF, chosen for its long highlight tails that match real materials.
- **Schlick's approximation** provides a fast, accurate Fresnel term; the key insight is that all materials approach 100% reflectance at grazing angles.
- The **Smith GGX** geometry function accounts for microfacet self-shadowing and masking.
- The **metallic-roughness workflow** (Disney/Burley 2012, Karis 2013) constrains the parameter space to physically plausible values.
- **Multi-scattering compensation** (Kulla-Conty 2017, Turquin 2019) recovers energy lost by single-scattering models at high roughness.
- The **split-sum approximation** enables real-time image-based lighting by factoring the environment integral into a pre-filtered map and a BRDF LUT.
