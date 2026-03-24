# Dot Product

The dot product is arguably the most important single operation in computer graphics. Every time light bounces off a surface, every time a camera decides what's visible, every time a shader computes a color — the dot product is at work. Understanding it deeply unlocks an enormous range of CG techniques.

## Algebraic Definition

The dot product of two vectors $\vec{a}$ and $\vec{b}$ is the sum of their component-wise products:

$$\vec{a} \cdot \vec{b} = a_x b_x + a_y b_y + a_z b_z$$

For example, given $\vec{a} = (2, 3, 1)$ and $\vec{b} = (4, -1, 2)$:

$$\vec{a} \cdot \vec{b} = (2)(4) + (3)(-1) + (1)(2) = 8 - 3 + 2 = 7$$

Notice that the result is a **scalar** (a single number), not a vector. This is why the dot product is sometimes called the **scalar product**.

## Geometric Definition

The same operation has a powerful geometric interpretation:

$$\vec{a} \cdot \vec{b} = |\vec{a}||\vec{b}|\cos\theta$$

where $\theta$ is the angle between the two vectors. This form tells us the dot product encodes the **angular relationship** between two directions.

If both vectors are **unit vectors** (normalized, with magnitude 1), this simplifies beautifully:

$$\hat{a} \cdot \hat{b} = \cos\theta$$

This means the dot product of two unit vectors directly gives you the cosine of the angle between them — no square roots, no trigonometry functions needed at runtime.

### Solving for the Angle

Rearranging the geometric definition, you can recover the angle itself:

$$\theta = \arccos\left(\frac{\vec{a} \cdot \vec{b}}{|\vec{a}||\vec{b}|}\right)$$

Or if both are unit vectors:

$$\theta = \arccos(\hat{a} \cdot \hat{b})$$

## Properties

The dot product has several algebraic properties worth memorizing:

- **Commutative:** $\vec{a} \cdot \vec{b} = \vec{b} \cdot \vec{a}$ — order doesn't matter.
- **Distributive:** $\vec{a} \cdot (\vec{b} + \vec{c}) = \vec{a} \cdot \vec{b} + \vec{a} \cdot \vec{c}$
- **Scalar multiplication:** $(k\vec{a}) \cdot \vec{b} = k(\vec{a} \cdot \vec{b})$
- **Self-dot:** $\vec{a} \cdot \vec{a} = |\vec{a}|^2$ — the squared magnitude. This is extremely useful because it avoids the expensive square root in `length()`.

## The Sign of the Dot Product

The sign of the dot product reveals the geometric relationship between two vectors, and this is one of its most practically useful features:

| Value | Angle $\theta$ | Meaning |
|---|---|---|
| $\vec{a} \cdot \vec{b} > 0$ | $0° \leq \theta < 90°$ | Vectors point in roughly the **same direction** |
| $\vec{a} \cdot \vec{b} = 0$ | $\theta = 90°$ | Vectors are **perpendicular** (orthogonal) |
| $\vec{a} \cdot \vec{b} < 0$ | $90° < \theta \leq 180°$ | Vectors point in roughly **opposite directions** |

Think of it as a "sameness" meter: +1 means identical direction, 0 means no relationship, -1 means exactly opposite.

## Geometric Interpretation: Projection

The dot product is intimately related to **projection**. The scalar projection of $\vec{b}$ onto $\vec{a}$ is:

$$\text{proj}_{\text{scalar}} = \frac{\vec{a} \cdot \vec{b}}{|\vec{a}|}$$

If $\vec{a}$ is already a unit vector $\hat{a}$, this simplifies to just $\hat{a} \cdot \vec{b}$. The result tells you "how much of $\vec{b}$ lies along the direction of $\hat{a}$."

The **vector projection** — the actual vector component of $\vec{b}$ along $\vec{a}$ — is:

$$\text{proj}_{\vec{a}} \vec{b} = \frac{\vec{a} \cdot \vec{b}}{|\vec{a}|^2} \vec{a}$$

Projection is the conceptual foundation for how lighting, camera calculations, and many physics simulations work.

## CG Applications

### Diffuse Lighting (Lambert's Cosine Law)

The most classic use of the dot product in CG. Lambert's law states that the intensity of diffuse light on a surface is proportional to the cosine of the angle between the surface normal $\vec{N}$ and the light direction $\vec{L}$:

$$I_{\text{diffuse}} = I_{\text{light}} \cdot k_d \cdot \max(\vec{N} \cdot \vec{L},\, 0)$$

The `max(..., 0)` clamp prevents negative lighting when the surface faces away from the light. This single line of math is the foundation of nearly every lighting model.

```glsl
vec3 norm = normalize(Normal);
vec3 lightDir = normalize(lightPos - FragPos);
float diff = max(dot(norm, lightDir), 0.0);
vec3 diffuse = diff * lightColor;
```

### Backface Culling

Before rasterizing a triangle, the GPU checks whether it faces toward or away from the camera. If the dot product of the surface normal and the view direction is positive, the surface faces away and can be skipped:

$$\vec{N} \cdot \vec{V} < 0 \implies \text{front face (visible)}$$

$$\vec{N} \cdot \vec{V} > 0 \implies \text{back face (culled)}$$

(The sign convention depends on whether $\vec{V}$ points toward or away from the camera.)

### Specular Reflection

In the Phong reflection model, the specular highlight depends on how closely the reflection vector $\vec{R}$ aligns with the view direction $\vec{V}$:

$$I_{\text{specular}} = I_{\text{light}} \cdot k_s \cdot \max(\vec{R} \cdot \vec{V},\, 0)^{n}$$

where $n$ is the shininess exponent. A higher $n$ produces a tighter, sharper highlight. The reflection vector itself is computed using the dot product:

$$\vec{R} = 2(\vec{N} \cdot \vec{L})\vec{N} - \vec{L}$$

```glsl
vec3 reflectDir = reflect(-lightDir, norm);
float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
vec3 specular = spec * lightColor;
```

GLSL's built-in `reflect()` function implements exactly the formula above.

### Fresnel Approximation (Schlick's)

The Fresnel effect — surfaces reflecting more light at grazing angles — uses the dot product between the view direction and the surface normal:

$$F(\theta) = F_0 + (1 - F_0)(1 - \vec{V} \cdot \vec{N})^5$$

where $F_0$ is the reflectance at normal incidence. As $\vec{V} \cdot \vec{N}$ approaches 0 (grazing angle), reflectance increases toward 1. This is why lakes look like mirrors when you look across them at a shallow angle.

```glsl
float cosTheta = max(dot(viewDir, normal), 0.0);
float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
```

## GLSL Built-in Functions

GLSL provides the dot product as a built-in, hardware-accelerated function:

```glsl
float d = dot(a, b);         // dot product of vec2, vec3, or vec4
float len2 = dot(v, v);      // squared length (avoids sqrt)
vec3 r = reflect(I, N);      // reflection: I - 2.0 * dot(N, I) * N
```

A common idiom for checking perpendicularity or facing direction:

```glsl
// Is this fragment lit?
float NdotL = dot(normal, lightDir);
if (NdotL > 0.0) {
    // surface faces the light
}
```

The pattern `max(dot(N, L), 0.0)` appears so frequently in shader code that it's worth committing to memory as the standard diffuse lighting term.

## Exercises

<details>
<summary>Exercise: Compute the Dot Product</summary>

<p>Given $\vec{a} = (1, -2, 3)$ and $\vec{b} = (4, 5, -1)$, compute $\vec{a} \cdot \vec{b}$.</p>

<p><strong>Solution:</strong></p>

<p>$\vec{a} \cdot \vec{b} = (1)(4) + (-2)(5) + (3)(-1) = 4 - 10 - 3 = -9$</p>

<p>Since the result is negative, the vectors point in roughly opposite directions (the angle between them is greater than 90 degrees).</p>
</details>

<details>
<summary>Exercise: Find the Angle Between Two Vectors</summary>

<p>Given $\vec{a} = (1, 0, 0)$ and $\vec{b} = (1, 1, 0)$, find the angle $\theta$ between them.</p>

<p><strong>Solution:</strong></p>

<p>$\vec{a} \cdot \vec{b} = (1)(1) + (0)(1) + (0)(0) = 1$</p>

<p>$|\vec{a}| = 1$, $|\vec{b}| = \sqrt{1 + 1 + 0} = \sqrt{2}$</p>

<p>$\cos\theta = \frac{1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}}$</p>

<p>$\theta = \arccos\left(\frac{1}{\sqrt{2}}\right) = 45°$</p>

<p>This makes geometric sense: $\vec{b}$ is the diagonal between the x and y axes, which sits exactly 45 degrees from the x-axis direction of $\vec{a}$.</p>
</details>

<details>
<summary>Exercise: Write a Diffuse Lighting Calculation</summary>

<p>A surface has normal $\vec{N} = (0, 1, 0)$ (pointing straight up). A light is at position $(3, 5, 0)$ and the fragment is at $(3, 0, 0)$. The light color is <code>vec3(1.0, 0.9, 0.8)</code>. Compute the diffuse contribution.</p>

<p><strong>Solution:</strong></p>

<p>1. Light direction: $\vec{L} = \text{normalize}((3,5,0) - (3,0,0)) = \text{normalize}(0, 5, 0) = (0, 1, 0)$</p>

<p>2. Dot product: $\vec{N} \cdot \vec{L} = (0)(0) + (1)(1) + (0)(0) = 1.0$</p>

<p>3. Clamped: $\max(1.0, 0.0) = 1.0$</p>

<p>4. Diffuse = $1.0 \times (1.0, 0.9, 0.8) = (1.0, 0.9, 0.8)$</p>

<p>The light is directly above the surface, so it receives full illumination. In GLSL:</p>

<p><code>vec3 lightDir = normalize(lightPos - fragPos);</code></p>
<p><code>float diff = max(dot(normal, lightDir), 0.0);</code></p>
<p><code>vec3 diffuse = diff * lightColor;</code></p>
</details>

## Key Takeaways

- The dot product produces a **scalar** from two vectors: $\vec{a} \cdot \vec{b} = a_x b_x + a_y b_y + a_z b_z$
- For unit vectors, the dot product equals $\cos\theta$ — the cosine of the angle between them
- The sign tells you direction alignment: positive (same), zero (perpendicular), negative (opposite)
- `dot(v, v)` gives squared length — use it to avoid expensive `sqrt` operations
- Lambert's diffuse lighting, Phong specular, Fresnel, and backface culling all rely on the dot product
- `max(dot(N, L), 0.0)` is the most common pattern in fragment shaders
