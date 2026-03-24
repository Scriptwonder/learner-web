# Subdivision Surfaces

Subdivision surfaces generate smooth, continuous surfaces from coarse polygon meshes through iterative refinement. Starting from a low-polygon control cage, each subdivision step adds vertices, splits edges, and repositions points according to weighted averaging rules, converging to a smooth limit surface. This technique underpins character modeling at Pixar, DreamWorks, and Weta, and powers real-time LOD in modern game engines. This lesson covers Catmull-Clark and Loop subdivision schemes, extraordinary vertex handling, crease edges, limit surface evaluation, and modern GPU implementations.

## Motivation

Why not just model with dense meshes or use NURBS?

- **Dense meshes** are hard to animate and art-direct; artists want to manipulate a few hundred control points, not millions of triangles
- **NURBS** require a rectangular grid topology and cannot represent arbitrary topology without trimming — which introduces gaps and cracks
- **Subdivision surfaces** accept arbitrary mesh topology, naturally handle extraordinary vertices (valence $\neq 4$), support sharp features via creases, and converge to a well-defined smooth surface

The film industry adopted subdivision surfaces in the late 1990s — Pixar's *Geri's Game* (1997) was the first short film to use Catmull-Clark subdivision for character surfaces, and the technique has been the standard ever since.

## Catmull-Clark Subdivision

Catmull-Clark subdivision (Catmull & Clark, 1978) is the most widely used scheme. It operates on arbitrary polygon meshes (quads, triangles, n-gons) and produces a mesh of **all quadrilaterals** after the first subdivision step.

### One Subdivision Step

Given a mesh with vertices, edges, and faces, one step of Catmull-Clark subdivision computes three types of new points:

#### 1. Face Points

For each face $f$ with vertices $\{v_1, v_2, \ldots, v_n\}$, the **face point** is the average of all face vertices:

$$f_p = \frac{1}{n} \sum_{i=1}^{n} v_i$$

For a quad face: $f_p = \frac{v_1 + v_2 + v_3 + v_4}{4}$.

#### 2. Edge Points

For each interior edge $e$ with endpoints $v_1, v_2$ and adjacent faces with face points $f_1, f_2$, the **edge point** is:

$$e_p = \frac{v_1 + v_2 + f_1 + f_2}{4}$$

This is the average of the two endpoints and the two adjacent face points. For boundary edges, the edge point is simply the midpoint: $e_p = \frac{v_1 + v_2}{2}$.

#### 3. Updated Vertex Points

For each original interior vertex $v$ with valence $n$ (number of adjacent edges), the **new vertex position** is:

$$v' = \frac{F + 2R + (n - 3)v}{n}$$

where:
- $F = \frac{1}{n} \sum_{i=1}^{n} f_i$ is the average of the $n$ adjacent face points
- $R = \frac{1}{n} \sum_{i=1}^{n} m_i$ is the average of the $n$ adjacent edge midpoints ($m_i = \frac{v + v_i}{2}$ for each adjacent vertex $v_i$)

Equivalently, using the original vertex weight:

$$v' = \frac{1}{n} F + \frac{2}{n} R + \frac{n - 3}{n} v$$

The weights are:

| Term | Weight |
|---|---|
| Average of face points ($F$) | $\frac{1}{n}$ |
| Average of edge midpoints ($R$) | $\frac{2}{n}$ |
| Original vertex ($v$) | $\frac{n - 3}{n}$ |

Note that the weights sum to $\frac{1 + 2 + n - 3}{n} = 1$ — the new position is an affine combination.

For **boundary vertices** with two adjacent boundary edges, the vertex rule is:

$$v' = \frac{1}{8}(v_{left} + v_{right}) + \frac{6}{8}v = \frac{v_{left} + 6v + v_{right}}{8}$$

This is the cubic B-spline knot insertion rule, ensuring $C^2$ continuity along boundaries.

#### 4. Connectivity

After computing all new points, the new mesh is constructed:
- Each original face is replaced by $n$ quads (one per vertex of the original face), connecting: the face point, two adjacent edge points, and the updated vertex point
- The result is always a **pure quad mesh** (even if the input had triangles or n-gons)

### Convergence Properties

| Region | Continuity |
|---|---|
| Regular (valence 4) interior | $C^2$ — matches a bi-cubic B-spline surface |
| Extraordinary vertex (valence $\neq 4$) | $C^1$ — tangent plane continuous, curvature may be discontinuous |
| Boundary | $C^2$ along boundary curves (cubic B-spline) |

After the first subdivision, all faces are quads and all newly created vertices have valence 4. Only the original extraordinary vertices retain their valence through all levels — the number of extraordinary vertices never changes.

## Worked Example: Catmull-Clark on a Cube Face

Consider one face of a unit cube with vertices:

$$v_0 = (0,0,0), \quad v_1 = (1,0,0), \quad v_2 = (1,1,0), \quad v_3 = (0,1,0)$$

Assume this face is part of the full cube (each vertex has valence 3, each edge is shared by 2 faces).

**Step 1: Face point**

$$f_p = \frac{(0,0,0) + (1,0,0) + (1,1,0) + (0,1,0)}{4} = (0.5, 0.5, 0)$$

**Step 2: Edge points** (for the four edges of this face)

Take edge $v_0 v_1$ (shared with the bottom face). The adjacent face points are $f_p = (0.5, 0.5, 0)$ (this face) and $f_{bottom} = (0.5, 0, 0.5)$ (the bottom face of the cube).

$$e_{01} = \frac{v_0 + v_1 + f_p + f_{bottom}}{4} = \frac{(0,0,0) + (1,0,0) + (0.5, 0.5, 0) + (0.5, 0, 0.5)}{4} = (0.5, 0.125, 0.125)$$

Similarly for the other three edges (each shared with a different cube face).

**Step 3: Updated vertex positions**

For vertex $v_0 = (0,0,0)$ with valence $n = 3$ (cube corner):

The three adjacent face points: $f_1 = (0.5, 0.5, 0)$ (front), $f_2 = (0.5, 0, 0.5)$ (bottom), $f_3 = (0, 0.5, 0.5)$ (left).

$$F = \frac{f_1 + f_2 + f_3}{3} = \frac{(0.5,0.5,0) + (0.5,0,0.5) + (0,0.5,0.5)}{3} = \left(\frac{1}{3}, \frac{1}{3}, \frac{1}{3}\right)$$

The three adjacent edge midpoints (midpoints of original edges from $v_0$):

$$m_1 = (0.5, 0, 0), \quad m_2 = (0, 0.5, 0), \quad m_3 = (0, 0, 0.5)$$

$$R = \frac{m_1 + m_2 + m_3}{3} = \left(\frac{1}{6}, \frac{1}{6}, \frac{1}{6}\right)$$

$$v_0' = \frac{F + 2R + (3-3)v_0}{3} = \frac{(\frac{1}{3}, \frac{1}{3}, \frac{1}{3}) + 2(\frac{1}{6}, \frac{1}{6}, \frac{1}{6}) + 0}{3} = \frac{(\frac{2}{3}, \frac{2}{3}, \frac{2}{3})}{3} = \left(\frac{2}{9}, \frac{2}{9}, \frac{2}{9}\right)$$

The cube corner has moved inward from $(0,0,0)$ to $(\frac{2}{9}, \frac{2}{9}, \frac{2}{9}) \approx (0.222, 0.222, 0.222)$ — the sharp corner is being smoothed toward a sphere.

**Step 4: Connectivity**

The original quad face is replaced by 4 new quads, each connecting one updated vertex to two adjacent edge points and the face point. After one subdivision, the cube (8 vertices, 6 faces) becomes a mesh with 26 vertices and 24 quad faces.

## Loop Subdivision

**Loop subdivision** (Loop, 1987) is designed specifically for **triangle meshes**. Unlike Catmull-Clark, it preserves the triangle topology throughout all subdivision levels.

### Subdivision Rules

#### Edge Points (new vertices at edge midpoints)

For an interior edge connecting $v_1$ and $v_2$, with opposite vertices $v_3$ and $v_4$:

$$e_p = \frac{3}{8}(v_1 + v_2) + \frac{1}{8}(v_3 + v_4)$$

For boundary edges: $e_p = \frac{1}{2}(v_1 + v_2)$.

#### Updated Vertex Points

For an interior vertex $v$ with valence $n$ and neighbors $\{v_1, \ldots, v_n\}$:

$$v' = (1 - n\beta)\, v + \beta \sum_{i=1}^{n} v_i$$

where $\beta$ is Loop's weight:

$$\beta = \frac{1}{n}\left(\frac{5}{8} - \left(\frac{3}{8} + \frac{1}{4}\cos\frac{2\pi}{n}\right)^2\right)$$

For the common case $n = 6$: $\beta = \frac{1}{16}$, giving $v' = \frac{5}{8}v + \frac{1}{16}\sum v_i$.

A simpler alternative weight (Warren, 1995):

$$\beta = \begin{cases} \frac{3}{8n} & \text{if } n > 3 \\ \frac{3}{16} & \text{if } n = 3 \end{cases}$$

#### Connectivity

Each triangle is split into 4 sub-triangles by connecting the three edge points. The resulting mesh has $4F$ faces and approximately $4V$ vertices.

### Convergence Properties

| Region | Continuity |
|---|---|
| Regular (valence 6) interior | $C^2$ — matches a quartic box spline |
| Extraordinary vertex (valence $\neq 6$) | $C^1$ continuous |

## Extraordinary Vertices

An **extraordinary vertex** (also called an irregular vertex) is one whose valence differs from the regular valence of the scheme:
- **Catmull-Clark**: regular valence = 4; extraordinary if valence $\neq 4$
- **Loop**: regular valence = 6; extraordinary if valence $\neq 6$

### Properties

- The number of extraordinary vertices is **fixed** after the first subdivision step — all new vertices are regular
- At extraordinary vertices, the limit surface is only $C^1$ (not $C^2$)
- The curvature can be unbounded at extraordinary vertices, particularly for high valence
- Best practice: minimize extraordinary vertices in the control mesh and keep their valence between 3 and 7

### Limit Position

The **limit position** of a vertex can be computed directly without infinite subdivision. For Catmull-Clark, the limit position of a vertex $v$ with valence $n$ and neighbors $\{v_i\}$ and face points $\{f_i\}$ is:

$$v_{\infty} = \frac{n^2 v + 4 \sum_{i=1}^{n} m_i + \sum_{i=1}^{n} f_i}{n(n+5)}$$

where $m_i$ are edge midpoints. This is derived from the eigenvectors of the subdivision matrix corresponding to the dominant eigenvalue.

For Loop subdivision:

$$v_{\infty} = \frac{v + n\beta \sum v_i}{1 + n^2\beta} \cdot (1 + n^2\beta) \quad \text{...more precisely:} \quad v_{\infty} = \frac{1}{1 + \frac{3n}{8\beta'}} \left( v + \frac{1}{n}\sum v_i \cdot \frac{3n}{8\beta'} \right)$$

The exact computation uses the subdominant eigenvector of the $n \times n$ local subdivision matrix (Stam, 1998).

## Crease Edges (Sharp Features)

Not every edge should be smooth. Mechanical parts have sharp edges, character models have creases along eyelids. **Crease edges** allow subdivision surfaces to maintain sharp features.

### Sharpness Value

Each edge is assigned a **sharpness** $s \geq 0$:
- $s = 0$: Fully smooth (standard subdivision rules)
- $s \geq 1$ (integer): Sharp for $s$ subdivision levels, then smooth
- $s = \infty$: Permanently sharp (boundary-like behavior)

At each subdivision step, the sharpness is decremented by 1. When $s > 0$, the edge uses the boundary rule (simple average) instead of the interior rule.

### Semi-Sharp Creases

For fractional sharpness $0 < s < 1$, the edge point is **blended** between the smooth rule and the sharp rule:

$$e_p = (1 - s) \cdot e_{smooth} + s \cdot e_{sharp}$$

This enables smooth rolloff from sharp to smooth — essential for modeling beveled edges and soft creases.

### Vertex Rules at Creases

A vertex incident to crease edges uses modified rules:
- **0 or 1 crease edges**: Standard interior rule
- **2 crease edges**: Boundary vertex rule ($\frac{1}{8}, \frac{6}{8}, \frac{1}{8}$) using the two crease neighbors
- **3+ crease edges**: Corner vertex rule (vertex does not move)

This was formalized in DeRose et al. (1998) for Pixar's subdivision specification, and is the system implemented in OpenSubdiv.

## Limit Surface Evaluation (Stam's Method)

Jos Stam's method (1998) enables **exact evaluation** of the limit surface at arbitrary parameter values, without performing infinite subdivision.

### For Regular Patches

In regular regions (all vertices have valence 4 for Catmull-Clark), the limit surface is a **bi-cubic B-spline patch**. Evaluation uses the standard B-spline basis functions:

$$S(u, v) = \sum_{i=0}^{3} \sum_{j=0}^{3} B_i(u) B_j(v) \, P_{ij}$$

where $B_i$ are the cubic B-spline basis functions and $P_{ij}$ are the 16 control points of the $4 \times 4$ patch neighborhood.

### For Extraordinary Patches

Near an extraordinary vertex of valence $n$:

1. Compute the **subdivision matrix** $\mathbf{M}_n$ (size $(2n+8) \times (2n+8)$ for Catmull-Clark)
2. Perform the **eigendecomposition** $\mathbf{M}_n = \mathbf{V} \mathbf{\Lambda} \mathbf{V}^{-1}$
3. The parameter $(u, v)$ is mapped to a sub-patch via repeated subdivision; after $k$ steps, the point lies in a regular patch
4. Evaluate $S(u, v) = \sum_i c_i \lambda_i^k \phi_i(u', v')$ where $\lambda_i$ are eigenvalues, $\phi_i$ are eigenbasis functions, and $(u', v')$ are the local parameters

The key insight is that the eigenvalues control the rate of convergence: the subdominant eigenvalue $\lambda_1$ determines the tangent plane, and $\lambda_1 < 1$ guarantees convergence.

### Practical Use

OpenSubdiv implements Stam's method via **feature-adaptive refinement**: the mesh is subdivided only near extraordinary vertices and creases until all patches are regular, then converted to bi-cubic patches for GPU tessellation.

## Comparison with NURBS

| Property | Subdivision Surfaces | NURBS |
|---|---|---|
| Topology | Arbitrary (any genus) | Rectangular grid required |
| Extraordinary vertices | Handled naturally | Not supported (trimming needed) |
| Continuity | $C^2$ regular, $C^1$ extraordinary | $C^{p-k}$ at knots, $C^{\infty}$ interior |
| Sharp features | Crease edges with sharpness | Knot multiplicity |
| Industry standard | Film, games | CAD, aerospace, automotive |
| Exact evaluation | Stam's method | Direct (de Boor, Cox-de Boor) |
| Watertight | Inherently | Trimmed NURBS have gap problems |

Subdivision surfaces dominate entertainment (film, games) due to topological freedom. NURBS dominate engineering CAD due to exact representation and standardized exchange formats (STEP, IGES).

## Modern Usage

### Pixar's OpenSubdiv

OpenSubdiv is Pixar's fifth-generation subdivision library (open-sourced in 2012, continuously updated). Key features:
- **Feature-adaptive refinement**: Subdivides only near extraordinary vertices and creases, converting regular patches to hardware-tessellated bi-cubic patches
- **GPU evaluation**: CUDA, OpenCL, Metal, and GLSL compute backends
- **Semi-sharp creases**: Full support for fractional sharpness
- **Face-varying data**: Independent subdivision of texture coordinates (allowing UV seams without geometric seams)
- Used in Pixar's Presto animation system, Houdini, Maya, and Blender (since 2.80)

### Game LOD with Subdivision

Modern game engines use subdivision for dynamic LOD:
1. Store a coarse base mesh (a few hundred quads)
2. At runtime, subdivide to the appropriate level based on screen-space size
3. Use hardware tessellation (tessellation control/evaluation shaders) to subdivide directly on the GPU
4. Displacement mapping adds fine detail on top of the smooth subdivided surface

This reduces memory and bandwidth compared to storing multiple pre-made LOD meshes.

### Nanite (Unreal Engine 5)

While Nanite uses a different approach (virtualized geometry with cluster-based LOD), subdivision surfaces remain important for content creation — artists model with subdivision in DCC tools, then bake the result for Nanite's mesh pipeline.

## Exercises

<details>
<summary>Exercise 1: Catmull-Clark Vertex Weight</summary>

<p>A vertex $v$ in a Catmull-Clark mesh has valence $n = 5$. The average of the five adjacent face points is $F = (1, 2, 0)$, the average of the five adjacent edge midpoints is $R = (2, 1, 0)$, and the original vertex position is $v = (3, 3, 0)$. Compute the new vertex position $v'$.</p>

<p><strong>Solution:</strong></p>

<p>$$v' = \frac{F + 2R + (n-3)v}{n} = \frac{(1,2,0) + 2(2,1,0) + (5-3)(3,3,0)}{5}$$</p>

<p>$$= \frac{(1,2,0) + (4,2,0) + (6,6,0)}{5} = \frac{(11, 10, 0)}{5} = (2.2, 2.0, 0)$$</p>

<p>The vertex has moved from $(3, 3, 0)$ toward the average of its neighbors — the subdivision smoothing effect.</p>
</details>

<details>
<summary>Exercise 2: Loop Edge Point</summary>

<p>In a Loop subdivision mesh, an interior edge connects vertices $v_1 = (0, 0, 0)$ and $v_2 = (4, 0, 0)$. The opposite vertices are $v_3 = (2, 3, 0)$ and $v_4 = (2, -3, 0)$. Compute the edge point.</p>

<p><strong>Solution:</strong></p>

<p>$$e_p = \frac{3}{8}(v_1 + v_2) + \frac{1}{8}(v_3 + v_4)$$</p>

<p>$$= \frac{3}{8}((0,0,0) + (4,0,0)) + \frac{1}{8}((2,3,0) + (2,-3,0))$$</p>

<p>$$= \frac{3}{8}(4,0,0) + \frac{1}{8}(4,0,0) = (1.5, 0, 0) + (0.5, 0, 0) = (2, 0, 0)$$</p>

<p>In this symmetric case, the edge point is at the midpoint — the opposite vertices cancel out due to symmetry.</p>
</details>

<details>
<summary>Exercise 3: Crease Behavior</summary>

<p>An edge has sharpness $s = 2$. Describe its behavior over three subdivision levels.</p>

<p><strong>Solution:</strong></p>

<p>Level 0 ($s = 2$): Edge is sharp. Both the edge point and adjacent vertex points use boundary rules (simple averaging, no face point influence). The edge remains visually sharp.</p>

<p>Level 1 ($s = 1$): Sharpness decremented to 1. Still sharp — boundary rules apply.</p>

<p>Level 2 ($s = 0$): Sharpness reaches 0. The edge switches to smooth interior rules. From this level onward, the edge is fully smooth.</p>

<p>The result is an edge that remains sharp at coarse levels but smooths out at fine levels — creating a controlled bevel whose width depends on the initial sharpness value.</p>
</details>

<details>
<summary>Exercise 4: Subdivision Face Count</summary>

<p>A cube has 6 quad faces, 8 vertices, and 12 edges. After one Catmull-Clark subdivision step, how many vertices, edges, and faces does the mesh have?</p>

<p><strong>Solution:</strong></p>

<p>New vertices: 8 (original, repositioned) + 12 (edge points) + 6 (face points) = 26.</p>
<p>New faces: Each original quad generates 4 sub-quads, so $6 \times 4 = 24$ faces.</p>
<p>New edges: Each original edge generates 2 edges, each face contributes $n$ internal edges to its center. For quads: $12 \times 2 = 24$ (subdivided original edges) + $6 \times 4 = 24$ (edges from face centers to edge points) = 48 edges.</p>
<p>Check Euler: $26 - 48 + 24 = 2$. Correct for genus 0.</p>
</details>

## Key Takeaways

- Subdivision surfaces produce smooth limit surfaces from coarse control meshes by iteratively refining topology and averaging vertex positions
- Catmull-Clark subdivision works on arbitrary polygon meshes, produces quad meshes, and converges to $C^2$ bi-cubic B-spline surfaces at regular (valence 4) vertices
- The Catmull-Clark vertex rule is $v' = \frac{F + 2R + (n-3)v}{n}$ where $F$ is the average of adjacent face points, $R$ the average of adjacent edge midpoints, and $n$ is the valence
- Loop subdivision operates on triangle meshes, using the $\frac{3}{8}/\frac{3}{8}/\frac{1}{8}/\frac{1}{8}$ edge rule and a valence-dependent vertex rule, converging to $C^2$ quartic box splines at regular (valence 6) vertices
- Extraordinary vertices (valence $\neq 4$ for CC, $\neq 6$ for Loop) reduce continuity to $C^1$; their count is fixed after the first subdivision step
- Crease edges with sharpness values enable sharp features that decay over subdivision levels; semi-sharp creases use blended rules for soft bevels
- Stam's method enables exact limit surface evaluation without infinite subdivision by eigendecomposition of the subdivision matrix
- OpenSubdiv (Pixar, open-source) implements feature-adaptive refinement and GPU-accelerated evaluation, and is integrated into Blender, Maya, and Houdini
- Subdivision surfaces dominate film and game pipelines due to topological freedom, while NURBS remain standard in engineering CAD
