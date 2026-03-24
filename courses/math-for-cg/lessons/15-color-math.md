# Color Math

Color in computer graphics is not just about picking pretty RGB values. The numbers in your framebuffer pass through a pipeline of mathematical transformations before photons hit your retina, and if you ignore that pipeline, your lighting will look wrong. This lesson covers linear vs sRGB color spaces, gamma correction, HDR rendering, and tone mapping — the math that bridges physically-correct shading and what your monitor actually displays.

## Linear Color Space

When you compute lighting in a fragment shader — multiplying a diffuse color by a dot product, adding ambient and specular terms — you are doing arithmetic on color values. For that arithmetic to be physically meaningful, the values must be in **linear color space**, where doubling a number means doubling the light intensity.

In linear space:

- $(0.5, 0.5, 0.5)$ is exactly half the brightness of $(1.0, 1.0, 1.0)$
- Adding two light contributions is a simple sum
- Multiplying a surface color by a light intensity scales proportionally

This is the space where physics lives. All lighting math should happen here.

## sRGB — What Monitors Display

Monitors do not have a linear response. Historically, CRT monitors had a power-law response curve where the brightness was proportional to the input voltage raised to a power of about 2.2. Modern LCD and OLED displays emulate this behavior for compatibility. This standard is called **sRGB**, and it defines a gamma curve close to:

$$c_{display} \approx c_{sRGB}^{2.2}$$

This means that if you send the value 0.5 to the monitor, it does not display 50% brightness — it displays roughly $0.5^{2.2} \approx 0.218$, or about 22% brightness. The sRGB encoding allocates more precision to dark tones, which aligns with how human vision is more sensitive to differences in dark values than bright ones.

### Why Textures Are sRGB

Most textures (diffuse maps, albedo textures, photos) are authored and stored in sRGB space. Artists paint in applications that display through the monitor's sRGB curve, so the pixel values they save are sRGB-encoded. When you sample one of these textures in a shader, the raw values are non-linear.

### The Problem

If your lighting math uses sRGB values directly, you are multiplying and adding non-linear numbers. The results are physically wrong:

- **Shadows are too dark.** A surface at a 60-degree angle to the light should receive $\cos(60°) = 0.5$ of the illumination. But $0.5$ in sRGB looks like $0.218$ on screen — much darker than it should be.
- **Highlights are washed out.** Adding specular highlights to already-non-linear values creates overblown bright areas.
- **Color blending is incorrect.** Interpolating between sRGB colors produces different (wrong) intermediate colors compared to interpolating in linear space.

## Gamma Correction

The solution is a two-step pipeline:

1. **Linearize inputs.** Convert sRGB texture values to linear space before using them in lighting math.
2. **Re-encode outputs.** Convert the final linear result back to sRGB before writing to the framebuffer.

### Linearizing (sRGB to Linear)

To convert an sRGB value to linear:

$$c_{linear} = c_{sRGB}^{2.2}$$

The exact sRGB specification uses a piecewise function with a linear segment near zero, but $\gamma = 2.2$ is the standard approximation used in shaders.

### Displaying (Linear to sRGB)

To convert a linear value back to sRGB for display:

$$c_{sRGB} = c_{linear}^{1/2.2} = c_{linear}^{0.4545}$$

This is called **gamma correction** — you apply the inverse of the monitor's gamma curve so that the final displayed brightness is correct.

### In GLSL

```glsl
// Linearize an sRGB texture sample
vec3 texColor = texture(diffuseMap, TexCoords).rgb;
vec3 linearColor = pow(texColor, vec3(2.2));

// ... perform all lighting calculations in linear space ...

// Apply gamma correction before output
vec3 result = ambientLinear + diffuseLinear + specularLinear;
FragColor = vec4(pow(result, vec3(1.0 / 2.2)), 1.0);
```

### The OpenGL Shortcut

OpenGL provides automatic sRGB handling:

```glsl
// Tell OpenGL the texture is sRGB — it will linearize on sample
glTexImage2D(GL_TEXTURE_2D, 0, GL_SRGB8, ...);

// Tell OpenGL to gamma-correct the framebuffer output
glEnable(GL_FRAMEBUFFER_SRGB);
```

With `GL_SRGB8` internal format, `texture()` calls automatically linearize. With `GL_FRAMEBUFFER_SRGB`, the GPU applies the sRGB curve on write. This is more efficient than manual `pow()` calls and handles edge cases better.

Important: only apply sRGB conversion to color textures (diffuse, albedo, emissive). Normal maps, roughness maps, metallic maps, and other data textures store linear data and must **not** be treated as sRGB.

## HDR — High Dynamic Range

Real-world luminance spans an enormous range:

| Scene | Luminance (cd/m^2) |
|---|---|
| Starlight | 0.001 |
| Moonlight | 0.1 |
| Indoor lighting | 100 |
| Overcast sky | 1,000 |
| Direct sunlight | 100,000 |

That is a range of about $10^8$. Standard 8-bit framebuffers clamp values to $[0, 1]$, which cannot represent this range. When a bright light source illuminates a scene, the lighting math naturally produces values above 1.0, but those values get clipped to white — losing all detail in bright areas.

**HDR rendering** solves this by using a floating-point framebuffer (e.g., `GL_RGBA16F` or `GL_RGBA32F`) where color values can exceed 1.0. You perform all lighting in this HDR buffer, preserving the full dynamic range. Then you **tone map** the result down to the displayable $[0, 1]$ range.

```glsl
// Create an HDR framebuffer
glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, width, height,
             0, GL_RGBA, GL_FLOAT, NULL);
```

### Exposure

Before tone mapping, you typically multiply by an **exposure** value to control the overall brightness, simulating a camera's exposure setting:

$$c_{exposed} = c_{hdr} \cdot \text{exposure}$$

A higher exposure brightens the scene (revealing shadow detail); a lower exposure darkens it (recovering highlight detail). This is analogous to adjusting a camera's shutter speed or aperture.

```glsl
uniform float exposure;
vec3 exposed = hdrColor * exposure;
```

## Tone Mapping

Tone mapping compresses the HDR range into $[0, 1]$ while preserving perceptual contrast. Unlike simple clamping, tone mapping operators apply a smooth curve that gracefully rolls off highlights.

### Reinhard Tone Mapping

The simplest physically-motivated operator:

$$c_{out} = \frac{c_{in}}{1 + c_{in}}$$

This maps $[0, \infty)$ to $[0, 1)$. Values near 0 pass through approximately unchanged (since $\frac{x}{1+x} \approx x$ for small $x$), while large values asymptotically approach 1 without ever clipping.

Properties:
- $c_{in} = 0 \Rightarrow c_{out} = 0$
- $c_{in} = 1 \Rightarrow c_{out} = 0.5$
- $c_{in} = \infty \Rightarrow c_{out} \to 1$

The main drawback: Reinhard can look slightly washed out because it compresses mid-tones as well as highlights.

```glsl
vec3 reinhard(vec3 hdr) {
    return hdr / (hdr + vec3(1.0));
}
```

### ACES Tone Mapping

The **Academy Color Encoding System (ACES)** is the film industry standard. It applies an S-curve that slightly boosts contrast in shadows, preserves mid-tones, and gracefully rolls off highlights. The widely-used approximation by Krzysztof Narkowicz:

$$c_{out} = \frac{c_{in}(2.51 \cdot c_{in} + 0.03)}{c_{in}(2.43 \cdot c_{in} + 0.59) + 0.14}$$

This creates a more cinematic look than Reinhard — darker shadows, punchier mid-tones, and more controlled highlight rolloff.

```glsl
vec3 aces(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
```

### Comparison

| Operator | Shadows | Mid-tones | Highlights | Character |
|---|---|---|---|---|
| Clamp (no tone map) | Accurate | Accurate | Clipped to white | Harsh, blown-out |
| Reinhard | Slightly lifted | Compressed | Smooth rolloff | Soft, slightly washed |
| ACES | Darker, richer | Natural contrast | Graceful rolloff | Cinematic, contrasty |

## Complete HDR Pipeline in GLSL

```glsl
#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D hdrBuffer; // HDR color from lighting pass
uniform float exposure;
uniform int toneMapper;      // 0 = Reinhard, 1 = ACES

vec3 reinhard(vec3 hdr) {
    return hdr / (hdr + vec3(1.0));
}

vec3 aces(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    // Sample HDR color
    vec3 hdrColor = texture(hdrBuffer, TexCoords).rgb;

    // Apply exposure
    vec3 exposed = hdrColor * exposure;

    // Tone map
    vec3 mapped;
    if (toneMapper == 0)
        mapped = reinhard(exposed);
    else
        mapped = aces(exposed);

    // Gamma correction (linear -> sRGB)
    mapped = pow(mapped, vec3(1.0 / 2.2));

    FragColor = vec4(mapped, 1.0);
}
```

The order matters: **exposure** first (artistic brightness control), then **tone mapping** (compress HDR to LDR), then **gamma correction** (encode for the monitor). Swapping tone mapping and gamma produces incorrect results.

## Exercises

<details>
<summary>Exercise: Linearize an sRGB Color</summary>

<p>A texture stores the sRGB color $(0.5, 0.8, 0.2)$. Convert it to linear space using the $\gamma = 2.2$ approximation.</p>

<p><strong>Solution:</strong></p>

<p>Apply $c_{linear} = c_{sRGB}^{2.2}$ per channel:</p>

<p>$R_{linear} = 0.5^{2.2} \approx 0.217$</p>

<p>$G_{linear} = 0.8^{2.2} \approx 0.612$</p>

<p>$B_{linear} = 0.2^{2.2} \approx 0.029$</p>

<p>Linear color: $(0.217, 0.612, 0.029)$</p>

<p>Notice how much darker the linearized values are — especially the red and blue channels. This is why skipping linearization makes lighting calculations produce results that are too dark in shadows: the GPU is computing with values that are already perceptually compressed.</p>
</details>

<details>
<summary>Exercise: Apply Reinhard Tone Mapping</summary>

<p>After lighting calculations, a pixel has HDR linear color $(3.0, 1.5, 0.2)$. Apply exposure = 1.0, then Reinhard tone mapping, then gamma correction. What is the final sRGB output?</p>

<p><strong>Solution:</strong></p>

<p><strong>Step 1 — Exposure:</strong> Multiply by 1.0 (no change): $(3.0, 1.5, 0.2)$</p>

<p><strong>Step 2 — Reinhard:</strong> Apply $c_{out} = \frac{c_{in}}{1 + c_{in}}$ per channel:</p>

<p>$R = \frac{3.0}{4.0} = 0.750$</p>

<p>$G = \frac{1.5}{2.5} = 0.600$</p>

<p>$B = \frac{0.2}{1.2} = 0.167$</p>

<p>Tone-mapped: $(0.750, 0.600, 0.167)$</p>

<p><strong>Step 3 — Gamma correction:</strong> Apply $c_{sRGB} = c_{linear}^{1/2.2}$:</p>

<p>$R_{sRGB} = 0.750^{0.4545} \approx 0.880$</p>

<p>$G_{sRGB} = 0.600^{0.4545} \approx 0.794$</p>

<p>$B_{sRGB} = 0.167^{0.4545} \approx 0.441$</p>

<p>Final sRGB output: $(0.880, 0.794, 0.441)$</p>

<p>Without tone mapping, the red channel (3.0) would have been clamped to 1.0, losing the warm color balance. Reinhard preserved the relative proportions.</p>
</details>

<details>
<summary>Exercise: Why Does Skipping Gamma Make Lighting Look Wrong?</summary>

<p>A Lambertian surface is lit by a single directional light. The light hits at 60 degrees from the normal. The diffuse color is $k_d = (0.8, 0.8, 0.8)$ and the light color is $(1, 1, 1)$.</p>

<p>Compare the perceived brightness on a monitor (a) with proper gamma correction and (b) without gamma correction. Assume the monitor applies a gamma of 2.2.</p>

<p><strong>Solution:</strong></p>

<p>The diffuse factor is $\cos(60°) = 0.5$. So the linear-space result is:</p>

<p>$$c_{linear} = 0.8 \times 0.5 = 0.4$$</p>

<p><strong>(a) With gamma correction:</strong></p>

<p>We gamma-correct before sending to the monitor: $c_{sRGB} = 0.4^{1/2.2} \approx 0.665$</p>

<p>The monitor applies its gamma: $\text{display} = 0.665^{2.2} \approx 0.4$</p>

<p>The viewer sees brightness 0.4 — correct, 50% of the material's maximum (0.8).</p>

<p><strong>(b) Without gamma correction:</strong></p>

<p>We send 0.4 directly. The monitor applies gamma: $\text{display} = 0.4^{2.2} \approx 0.133$</p>

<p>The viewer sees brightness 0.133 — only 33% of what it should be. The surface looks much darker than intended, as if lit at an 80-degree angle instead of 60 degrees.</p>

<p>This is why gamma-incorrect rendering produces overly dark shadows and harsh contrast.</p>
</details>

## Key Takeaways

- **Linear color space** is where lighting math must happen — values scale proportionally to physical intensity
- **sRGB** is what monitors expect; it applies a gamma curve of approximately $x^{2.2}$, allocating more precision to dark tones
- **Gamma correction pipeline:** linearize texture inputs ($c^{2.2}$), do lighting math, then encode output ($c^{1/2.2}$)
- Skipping gamma correction makes shadows too dark and highlights too harsh
- **HDR rendering** uses floating-point framebuffers to preserve values above 1.0
- **Tone mapping** compresses HDR to LDR: Reinhard ($\frac{c}{1+c}$) is simple; ACES gives cinematic contrast
- Apply operations in order: exposure, then tone mapping, then gamma correction
- Only apply sRGB conversion to color textures — data textures (normals, roughness) are already linear
