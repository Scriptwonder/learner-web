# Normals & Tangent Space

Surface normals are the backbone of every lighting calculation in computer graphics. A normal tells the renderer which direction a surface is facing, and that single piece of information determines how light bounces, scatters, and shades across a mesh. In this lesson we cover how normals work, why transforming them is subtle, and how normal maps use tangent space to add fine surface detail without extra geometry.

## What Is a Surface Normal?

A **surface normal** is a unit vector perpendicular to a surface at a given point. If you imagine a flat table, the normal points straight up. For a sphere, each point's normal points radially outward.

Mathematically, the normal of a triangle with vertices $P_0, P_1, P_2$ is:

$$\vec{N} = \text{normalize}\bigl((P_1 - P_0) \times (P_2 - P_0)\bigr)$$

That cross product gives a vector perpendicular to the triangle's plane. After normalizing, we get a unit-length direction.

## Face Normals vs Vertex Normals

A **face normal** (or flat normal) is one normal per triangle. Every fragment on that triangle gets the same normal, producing **flat shading** — you can clearly see each polygon facet.

A **vertex normal** is computed per-vertex, usually by averaging the face normals of all triangles sharing that vertex:

$$\vec{N}_v = \text{normalize}\!\left(\sum_{i} \vec{N}_{f_i}\right)$$

During rasterization the GPU interpolates vertex normals across the triangle, producing **smooth shading** (Gouraud or Phong interpolation). This gives curved surfaces a smooth appearance even with relatively few polygons.

## Transforming Normals — The Inverse Transpose

When you transform geometry by a model matrix $M$, you might assume normals transform the same way: $\vec{N}' = M \cdot \vec{N}$. This works only when $M$ contains uniform scaling and rotations. The moment you apply **non-uniform scaling**, this breaks.

### Why It Breaks

Consider a flat surface with normal $\vec{N}$ and a tangent vector $\vec{T}$ lying on that surface. By definition, $\vec{N} \cdot \vec{T} = 0$. After transforming the tangent by $M$, the new tangent is $\vec{T}' = M \cdot \vec{T}$. If we also transform the normal by $M$, we need:

$$\vec{N}' \cdot \vec{T}' = (M \vec{N})^T (M \vec{T}) = \vec{N}^T M^T M \vec{T}$$

This equals zero only if $M^T M = I$, which is true for rotations but false for non-uniform scaling. If you scale $x$ by 2 but leave $y$ alone, the normal gets skewed and is no longer perpendicular to the surface.

### The Fix

We need a matrix $G$ such that $(G \vec{N})^T (M \vec{T}) = 0$:

$$\vec{N}^T G^T M \vec{T} = 0$$

Since $\vec{N}^T \vec{T} = 0$, we need $G^T M = I$, which gives us:

$$G = (M^{-1})^T$$

The correct normal matrix is the **inverse transpose** of the model matrix:

$$\vec{N}' = \text{normalize}\!\left((M^{-1})^T \cdot \vec{N}\right)$$

Geometrically, normals are **covectors** — they transform contravariantly to regular vectors. Regular vectors (positions, tangents) transform by $M$; covectors (normals) transform by $(M^{-1})^T$.

### In GLSL

```glsl
// CPU-side: compute and upload as uniform
mat3 normalMatrix = mat3(transpose(inverse(model)));

// Vertex shader
out vec3 FragNormal;
void main() {
    FragNormal = normalize(normalMatrix * aNormal);
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

For performance, compute the normal matrix on the CPU and pass it as a uniform rather than computing `transpose(inverse(...))` per vertex.

## Normal Maps

Smooth-shaded vertex normals give a curved appearance but cannot capture fine detail like brick grooves, skin pores, or fabric weave. **Normal maps** solve this by storing per-texel perturbation vectors in a texture.

Each RGB pixel in a normal map encodes a direction:

$$\vec{N}_{map} = 2.0 \cdot \text{texel}_{rgb} - 1.0$$

The conventional color $(0.5, 0.5, 1.0)$ — the blueish purple you see in normal map textures — decodes to $(0, 0, 1)$, meaning "no perturbation, point straight up." Deviations from this encode the surface bumpiness.

But "straight up" relative to what? This is where **tangent space** comes in.

## Tangent Space

Normal maps are authored in **tangent space** — a per-vertex local coordinate system aligned to the surface:

- $\vec{T}$ (tangent) — points along the texture's U direction
- $\vec{B}$ (bitangent) — points along the texture's V direction
- $\vec{N}$ (normal) — the geometric surface normal

Together these three vectors form an orthonormal basis called the **TBN frame**. The normal map's $(0, 0, 1)$ aligns with $\vec{N}$, and perturbations in $x$ and $y$ tilt along $\vec{T}$ and $\vec{B}$.

### Computing Tangent and Bitangent

Given a triangle with positions $P_0, P_1, P_2$ and UV coordinates $(u_0, v_0), (u_1, v_1), (u_2, v_2)$, define the edge vectors and UV deltas:

$$\vec{E}_1 = P_1 - P_0, \quad \vec{E}_2 = P_2 - P_0$$

$$\Delta u_1 = u_1 - u_0, \quad \Delta v_1 = v_1 - v_0$$

$$\Delta u_2 = u_2 - u_0, \quad \Delta v_2 = v_2 - v_0$$

The tangent and bitangent satisfy:

$$\vec{E}_1 = \Delta u_1 \vec{T} + \Delta v_1 \vec{B}$$

$$\vec{E}_2 = \Delta u_2 \vec{T} + \Delta v_2 \vec{B}$$

Solving this $2 \times 2$ system:

$$\begin{pmatrix} \vec{T} \\ \vec{B} \end{pmatrix} = \frac{1}{\Delta u_1 \Delta v_2 - \Delta u_2 \Delta v_1} \begin{pmatrix} \Delta v_2 & -\Delta v_1 \\ -\Delta u_2 & \Delta u_1 \end{pmatrix} \begin{pmatrix} \vec{E}_1 \\ \vec{E}_2 \end{pmatrix}$$

After solving, orthogonalize and normalize using Gram-Schmidt:

$$\vec{T}' = \text{normalize}(\vec{T} - (\vec{N} \cdot \vec{T})\vec{N})$$

$$\vec{B}' = \vec{N} \times \vec{T}'$$

## The TBN Matrix

The **TBN matrix** transforms vectors from tangent space to world space (or model space):

$$\text{TBN} = \begin{pmatrix} T_x & B_x & N_x \\ T_y & B_y & N_y \\ T_z & B_z & N_z \end{pmatrix}$$

Each column is one of the basis vectors. Since TBN is orthonormal, its inverse is its transpose — which transforms from world space to tangent space.

### Two Implementation Approaches

**Approach 1 — Transform the normal to world space.** Sample the normal map in the fragment shader, then multiply by TBN to bring the perturbed normal into world space. Perform lighting in world space.

**Approach 2 — Transform lights to tangent space.** In the vertex shader, compute $\text{TBN}^T$ and use it to transform the light direction and view direction into tangent space. Then the fragment shader compares the sampled normal map directly — no per-fragment matrix multiply needed.

Approach 2 can be faster because matrix multiplications happen per-vertex instead of per-fragment, but approach 1 is simpler and more flexible (especially with multiple lights).

## GLSL: Normal Mapping

```glsl
// Vertex Shader
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoords;
layout(location = 3) in vec3 aTangent;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix; // (M^-1)^T

out vec2 TexCoords;
out vec3 FragPos;
out mat3 TBN;

void main() {
    vec3 T = normalize(normalMatrix * aTangent);
    vec3 N = normalize(normalMatrix * aNormal);
    // Re-orthogonalize T with respect to N (Gram-Schmidt)
    T = normalize(T - dot(T, N) * N);
    vec3 B = cross(N, T);

    TBN = mat3(T, B, N);

    FragPos  = vec3(model * vec4(aPos, 1.0));
    TexCoords = aTexCoords;
    gl_Position = projection * view * vec4(FragPos, 1.0);
}
```

```glsl
// Fragment Shader
in vec2 TexCoords;
in vec3 FragPos;
in mat3 TBN;

uniform sampler2D normalMap;
uniform vec3 lightPos;
uniform vec3 viewPos;

out vec4 FragColor;

void main() {
    // Sample normal map and convert from [0,1] to [-1,1]
    vec3 normal = texture(normalMap, TexCoords).rgb;
    normal = normal * 2.0 - 1.0;

    // Transform perturbed normal from tangent space to world space
    normal = normalize(TBN * normal);

    // Use 'normal' for lighting calculations...
    vec3 lightDir = normalize(lightPos - FragPos);
    float diff = max(dot(normal, lightDir), 0.0);

    FragColor = vec4(vec3(diff), 1.0);
}
```

## Exercises

<details>
<summary>Exercise: Compute the Normal Matrix</summary>

<p>Given a model matrix that scales x by 2 and y by 0.5 (z unchanged, no rotation):</p>

<p>$$M = \begin{pmatrix} 2 & 0 & 0 \\ 0 & 0.5 & 0 \\ 0 & 0 & 1 \end{pmatrix}$$</p>

<p>Compute the normal matrix $(M^{-1})^T$.</p>

<p><strong>Solution:</strong></p>

<p>$$M^{-1} = \begin{pmatrix} 0.5 & 0 & 0 \\ 0 & 2 & 0 \\ 0 & 0 & 1 \end{pmatrix}$$</p>

<p>$$(M^{-1})^T = \begin{pmatrix} 0.5 & 0 & 0 \\ 0 & 2 & 0 \\ 0 & 0 & 1 \end{pmatrix}$$</p>

<p>For a diagonal matrix, the inverse transpose is the same as the inverse. A normal pointing in $y$ (like $(0, 1, 0)$) gets scaled <em>up</em> by 2, compensating for the geometry being squished in $y$. After normalizing, the normal stays perpendicular to the stretched surface.</p>
</details>

<details>
<summary>Exercise: Apply a Normal Map Perturbation</summary>

<p>A normal map texel reads RGB = $(0.5, 1.0, 0.5)$. The TBN matrix at this fragment is:</p>

<p>$$\text{TBN} = \begin{pmatrix} 1 & 0 & 0 \\ 0 & 0 & 1 \\ 0 & -1 & 0 \end{pmatrix}$$</p>

<p>(This represents a surface facing +Y with tangent along +X and bitangent along -Z in world space.)</p>

<p>What is the world-space normal after applying the normal map?</p>

<p><strong>Solution:</strong></p>

<p>First, decode from [0,1] to [-1,1]:</p>

<p>$$\vec{N}_{tangent} = 2 \cdot (0.5, 1.0, 0.5) - 1 = (0, 1, 0)$$</p>

<p>Then transform to world space:</p>

<p>$$\vec{N}_{world} = \text{TBN} \cdot (0, 1, 0) = (0, 0, -1)$$</p>

<p>The perturbation tilted the normal from the surface's default direction (column 3 = $(0, 1, 0)$ in world space) to $(0, 0, -1)$, pointing along the bitangent direction. After normalizing (already unit length), the final world-space normal is $(0, 0, -1)$.</p>
</details>

<details>
<summary>Exercise: Why Not Just Use the Model Matrix for Normals?</summary>

<p>A surface has normal $\vec{N} = (0, 1, 0)$ and tangent $\vec{T} = (1, 0, 0)$. The model matrix scales x by 3, y by 1, z by 1.</p>

<p>Show that transforming the normal by $M$ makes it non-perpendicular to the transformed tangent.</p>

<p><strong>Solution:</strong></p>

<p>$$\vec{T}' = M \cdot \vec{T} = (3, 0, 0)$$</p>

<p>$$\vec{N}_{wrong} = M \cdot \vec{N} = (0, 1, 0)$$</p>

<p>Check: $\vec{N}_{wrong} \cdot \vec{T}' = 0 \cdot 3 + 1 \cdot 0 + 0 \cdot 0 = 0$. In this case it happens to work because the scaling is along a different axis.</p>

<p>Now try $\vec{N} = (1, 1, 0)/\sqrt{2}$ and $\vec{T} = (1, -1, 0)/\sqrt{2}$ (perpendicular: dot product = 0):</p>

<p>$$\vec{T}' = M \cdot \vec{T} = (3/\sqrt{2},\ -1/\sqrt{2},\ 0)$$</p>

<p>$$\vec{N}_{wrong} = M \cdot \vec{N} = (3/\sqrt{2},\ 1/\sqrt{2},\ 0)$$</p>

<p>Dot product: $\frac{9}{2} - \frac{1}{2} = 4 \neq 0$. The normal is no longer perpendicular. Using $(M^{-1})^T$ gives $(\frac{1}{3\sqrt{2}}, \frac{1}{\sqrt{2}}, 0)$, which after normalizing, is perpendicular to $\vec{T}'$.</p>
</details>

## Key Takeaways

- Surface normals are unit vectors perpendicular to a surface; they drive all lighting calculations
- Vertex normals (averaged from adjacent faces) enable smooth shading via interpolation
- Always transform normals by the **inverse transpose** $(M^{-1})^T$ — using the model matrix directly breaks under non-uniform scaling
- Normal maps store perturbed normals in tangent space; decode with `n = tex * 2.0 - 1.0`
- The TBN matrix (tangent, bitangent, normal) converts between tangent space and world space
- Compute tangent/bitangent from triangle edges and UV deltas, then orthogonalize with Gram-Schmidt
