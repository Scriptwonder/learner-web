# Lighting Models

Lighting models are the mathematical recipes that determine how a surface looks under illumination. From the simplest constant ambient term to physically-based rendering equations, they all answer the same question: given a light, a surface, and a camera, what color should this pixel be? This lesson builds up from ambient light through Lambert's diffuse law, Phong specular, and the improved Blinn-Phong model, ending with a conceptual introduction to the rendering equation.

## Ambient Lighting

Real scenes have light bouncing everywhere — off walls, ceilings, the ground. Simulating all of that (global illumination) is expensive. **Ambient lighting** is the cheapest approximation: a constant amount of light applied uniformly to every surface.

$$I_a = k_a \cdot L_a$$

- $k_a$ — the material's ambient reflectance (an RGB color)
- $L_a$ — the ambient light intensity

This prevents fully unlit surfaces from going completely black. It is a hack, but a useful one.

```glsl
vec3 ambient = ambientStrength * lightColor;
```

## Diffuse Lighting — Lambert's Cosine Law

A matte surface scatters incoming light equally in all directions. The amount of light energy hitting a small patch of surface depends on the angle between the incoming light direction $\vec{L}$ and the surface normal $\vec{N}$.

**Lambert's cosine law** states that the irradiance (power per area) on a surface is proportional to the cosine of the incidence angle:

$$I_d = k_d \cdot L_d \cdot \max(\vec{N} \cdot \vec{L},\ 0)$$

- $k_d$ — the material's diffuse color
- $L_d$ — the diffuse light intensity
- $\vec{N} \cdot \vec{L}$ — the cosine of the angle between normal and light direction (both must be unit vectors)
- $\max(..., 0)$ — clamps negative values (light hitting the back face contributes nothing)

### Why Cosine?

Imagine a flashlight beam hitting a surface. When the beam is perpendicular ($\theta = 0°$), all the photons land on a small area. As the surface tilts away, the same beam spreads over a larger area, so each point receives less energy. The spread factor is exactly $\cos\theta$.

```glsl
vec3 norm = normalize(Normal);
vec3 lightDir = normalize(lightPos - FragPos);
float diff = max(dot(norm, lightDir), 0.0);
vec3 diffuse = diff * lightColor;
```

## Specular Lighting — Phong Model

Shiny surfaces exhibit **specular highlights** — bright spots where the light source is reflected toward the viewer. The **Phong reflection model** calculates this using the reflection of the light vector about the surface normal.

### The Reflection Vector

Given light direction $\vec{L}$ (pointing toward the light) and surface normal $\vec{N}$, the reflection vector is:

$$\vec{R} = 2(\vec{N} \cdot \vec{L})\vec{N} - \vec{L}$$

This mirrors $\vec{L}$ across $\vec{N}$. In GLSL, the built-in `reflect()` function expects the light vector pointing *from* the light *toward* the surface, so the signs differ — always check the convention.

### Phong Specular Term

$$I_s = k_s \cdot L_s \cdot \bigl(\max(\vec{R} \cdot \vec{V},\ 0)\bigr)^{n_s}$$

- $k_s$ — the material's specular color (often white or a tinted highlight)
- $L_s$ — the specular light intensity
- $\vec{V}$ — the view direction (unit vector from fragment to camera)
- $\vec{R} \cdot \vec{V}$ — cosine of the angle between reflection and view direction
- $n_s$ — the **shininess exponent**

### Shininess Exponent

The exponent $n_s$ controls how tight the specular highlight is:

| $n_s$ value | Appearance |
|---|---|
| 1 – 8 | Broad, soft highlight (rubber, clay) |
| 16 – 64 | Moderate highlight (plastic) |
| 128 – 512 | Sharp, tight highlight (polished metal, glass) |

Raising the cosine to a higher power makes values below 1 drop off faster, concentrating the highlight into a smaller angular range.

```glsl
vec3 viewDir = normalize(viewPos - FragPos);
vec3 reflectDir = reflect(-lightDir, norm);
float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
vec3 specular = specularStrength * spec * lightColor;
```

### The Combined Phong Equation

$$I = I_a + I_d + I_s = k_a L_a + k_d L_d \max(\vec{N} \cdot \vec{L}, 0) + k_s L_s \bigl(\max(\vec{R} \cdot \vec{V}, 0)\bigr)^{n_s}$$

## Blinn-Phong — A Better Specular Model

The Phong model has a problem at **grazing angles**: when the angle between $\vec{V}$ and $\vec{R}$ exceeds 90°, the dot product goes negative, and the specular contribution abruptly cuts to zero. This can create a visible hard edge in the highlight, especially at low shininess values.

### The Half-Vector

**Blinn-Phong** replaces the reflection vector with the **half-vector** $\vec{H}$, defined as the unit vector halfway between the light direction and the view direction:

$$\vec{H} = \text{normalize}(\vec{L} + \vec{V})$$

The specular term becomes:

$$I_s = k_s \cdot L_s \cdot \bigl(\max(\vec{N} \cdot \vec{H},\ 0)\bigr)^{n_s}$$

### Why Blinn-Phong Is Better

1. **No grazing-angle cutoff.** The angle between $\vec{N}$ and $\vec{H}$ is always between 0° and 90° when the light and viewer are on the same side of the surface. No abrupt clipping.

2. **More physically plausible.** Blinn-Phong better matches measured specular reflections from real materials. The half-vector approach aligns with how microfacet theories model surface roughness.

3. **Faster.** Computing $\vec{H} = \text{normalize}(\vec{L} + \vec{V})$ is cheaper than computing $\vec{R} = 2(\vec{N} \cdot \vec{L})\vec{N} - \vec{L}$. For directional lights, $\vec{H}$ is constant across all fragments and can be precomputed.

Note: Blinn-Phong shininess values are not directly comparable to Phong. To get a visually similar highlight, Blinn-Phong typically needs a shininess 2–4 times higher than Phong.

```glsl
vec3 halfwayDir = normalize(lightDir + viewDir);
float spec = pow(max(dot(norm, halfwayDir), 0.0), shininess);
```

## Full Blinn-Phong Fragment Shader

```glsl
#version 330 core
out vec4 FragColor;

in vec3 FragPos;
in vec3 Normal;

uniform vec3 lightPos;
uniform vec3 viewPos;
uniform vec3 lightColor;
uniform vec3 objectColor;

void main() {
    // --- Ambient ---
    float ambientStrength = 0.1;
    vec3 ambient = ambientStrength * lightColor;

    // --- Diffuse (Lambert) ---
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diff * lightColor;

    // --- Specular (Blinn-Phong) ---
    float specularStrength = 0.5;
    float shininess = 64.0;
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(norm, halfwayDir), 0.0), shininess);
    vec3 specular = specularStrength * spec * lightColor;

    // --- Combine ---
    vec3 result = (ambient + diffuse + specular) * objectColor;
    FragColor = vec4(result, 1.0);
}
```

## The Rendering Equation (Conceptual Introduction)

Phong and Blinn-Phong are useful approximations, but real-world light transport follows a more general law. In 1986, James Kajiya formulated the **rendering equation**:

$$L_o(\vec{\omega_o}) = L_e(\vec{\omega_o}) + \int_{\Omega} f_r(\vec{\omega_i}, \vec{\omega_o}) \cdot L_i(\vec{\omega_i}) \cdot (\vec{N} \cdot \vec{\omega_i})\ d\omega_i$$

Here is what each term means:

- $L_o(\vec{\omega_o})$ — outgoing radiance in direction $\vec{\omega_o}$ (what the camera sees)
- $L_e(\vec{\omega_o})$ — emitted light (if the surface glows)
- $\int_{\Omega}$ — integral over the hemisphere of all incoming directions
- $f_r(\vec{\omega_i}, \vec{\omega_o})$ — the **BRDF** (Bidirectional Reflectance Distribution Function)
- $L_i(\vec{\omega_i})$ — incoming radiance from direction $\vec{\omega_i}$
- $\vec{N} \cdot \vec{\omega_i}$ — the Lambert cosine factor

### What Is a BRDF?

A **BRDF** is a function that describes how a surface reflects light. It takes an incoming light direction and an outgoing view direction and returns the proportion of light reflected. Different materials have different BRDFs:

- **Lambertian (perfectly diffuse):** $f_r = \frac{k_d}{\pi}$ — constant in all directions
- **Phong/Blinn-Phong:** the specular lobe is encoded as a BRDF term
- **Physically-based BRDFs** (Cook-Torrance, GGX): model microfacet surfaces for realistic metals and dielectrics

The rendering equation is almost never solved analytically. Real-time renderers approximate it (Blinn-Phong, PBR shading models), while offline renderers use numerical integration (path tracing, Monte Carlo sampling). Understanding this equation is the foundation for everything from simple Blinn-Phong to ray-traced global illumination.

## Exercises

<details>
<summary>Exercise: Compute Diffuse Intensity</summary>

<p>A surface has normal $\vec{N} = (0, 1, 0)$. The light direction (toward the light) is $\vec{L} = \text{normalize}(1, 1, 0) = (\frac{1}{\sqrt{2}}, \frac{1}{\sqrt{2}}, 0)$. The diffuse material color is $k_d = (0.8, 0.2, 0.2)$ and the light color is $L_d = (1, 1, 1)$.</p>

<p>Compute the diffuse contribution $I_d$.</p>

<p><strong>Solution:</strong></p>

<p>$$\vec{N} \cdot \vec{L} = 0 \cdot \frac{1}{\sqrt{2}} + 1 \cdot \frac{1}{\sqrt{2}} + 0 \cdot 0 = \frac{1}{\sqrt{2}} \approx 0.707$$</p>

<p>$$I_d = k_d \cdot L_d \cdot 0.707 = (0.8, 0.2, 0.2) \cdot (1,1,1) \cdot 0.707 = (0.566, 0.141, 0.141)$$</p>

<p>The surface receives about 70.7% of the full diffuse illumination because the light hits at a 45-degree angle.</p>
</details>

<details>
<summary>Exercise: Phong vs Blinn-Phong Comparison</summary>

<p>Given:</p>
<ul>
<li>$\vec{N} = (0, 1, 0)$</li>
<li>$\vec{L} = (0, 1, 0)$ (light directly above)</li>
<li>$\vec{V} = \text{normalize}(1, 1, 0) = (\frac{1}{\sqrt{2}}, \frac{1}{\sqrt{2}}, 0)$ (viewer at 45 degrees)</li>
<li>$n_s = 32$</li>
</ul>

<p>Compute the specular factor (before multiplying by $k_s$ and $L_s$) for both Phong and Blinn-Phong.</p>

<p><strong>Solution — Phong:</strong></p>

<p>$$\vec{R} = 2(\vec{N} \cdot \vec{L})\vec{N} - \vec{L} = 2(1)(0,1,0) - (0,1,0) = (0, 1, 0)$$</p>

<p>$$\vec{R} \cdot \vec{V} = 0 \cdot \frac{1}{\sqrt{2}} + 1 \cdot \frac{1}{\sqrt{2}} + 0 = \frac{1}{\sqrt{2}} \approx 0.707$$</p>

<p>$$\text{spec}_{Phong} = 0.707^{32} = (2^{-1/2})^{32} = 2^{-16} \approx 0.0000153$$</p>

<p><strong>Solution — Blinn-Phong:</strong></p>

<p>$$\vec{H} = \text{normalize}(\vec{L} + \vec{V}) = \text{normalize}\bigl(\frac{1}{\sqrt{2}}, 1 + \frac{1}{\sqrt{2}}, 0\bigr)$$</p>

<p>$$= \text{normalize}(0.707, 1.707, 0)$$</p>

<p>The magnitude is $\sqrt{0.707^2 + 1.707^2} = \sqrt{0.5 + 2.914} = \sqrt{3.414} \approx 1.848$.</p>

<p>$$\vec{H} \approx (0.383, 0.924, 0)$$</p>

<p>$$\vec{N} \cdot \vec{H} = 0.924$$</p>

<p>$$\text{spec}_{Blinn} = 0.924^{32} \approx 0.0743$$</p>

<p>Blinn-Phong gives a specular factor about 5200 times larger here, producing a broader, more visible highlight. This is why Blinn-Phong shininess values are typically set 2-4x higher than equivalent Phong values.</p>
</details>

<details>
<summary>Exercise: Interpret the Rendering Equation</summary>

<p>The rendering equation is:</p>

<p>$$L_o(\vec{\omega_o}) = L_e + \int_{\Omega} f_r(\vec{\omega_i}, \vec{\omega_o}) \cdot L_i(\vec{\omega_i}) \cdot (\vec{N} \cdot \vec{\omega_i})\ d\omega_i$$</p>

<p>For a non-emissive, perfectly Lambertian surface with $f_r = \frac{k_d}{\pi}$ illuminated by a single point light from direction $\vec{L}$ with radiance $L_{light}$, simplify the rendering equation to recover the Lambert diffuse formula.</p>

<p><strong>Solution:</strong></p>

<p>For a non-emissive surface, $L_e = 0$. A single point light means the integral collapses to a single evaluation at direction $\vec{\omega_i} = \vec{L}$:</p>

<p>$$L_o = \frac{k_d}{\pi} \cdot L_{light} \cdot (\vec{N} \cdot \vec{L})$$</p>

<p>The factor of $\frac{1}{\pi}$ is the energy-conserving normalization for a Lambertian BRDF — it ensures the surface does not reflect more energy than it receives. In practice, many real-time renderers fold $\frac{1}{\pi}$ into the light intensity constant, recovering the familiar $I_d = k_d \cdot L_d \cdot \max(\vec{N} \cdot \vec{L}, 0)$ form.</p>
</details>

## Key Takeaways

- **Ambient** is a constant hack to prevent total darkness: $I_a = k_a \cdot L_a$
- **Diffuse (Lambert)** uses the cosine of the angle between normal and light: $\max(\vec{N} \cdot \vec{L}, 0)$
- **Specular (Phong)** uses the reflection vector and a shininess exponent to create highlights
- **Blinn-Phong** replaces the reflection vector with the half-vector $\vec{H} = \text{normalize}(\vec{L} + \vec{V})$ — it is faster, avoids grazing-angle artifacts, and is more physically plausible
- The **rendering equation** is the general framework; Phong/Blinn-Phong are simple BRDFs that approximate it
- A **BRDF** describes how a surface reflects light from any incoming direction to any outgoing direction
