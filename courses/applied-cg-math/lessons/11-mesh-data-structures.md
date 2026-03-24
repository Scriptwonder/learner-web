# Mesh Data Structures

A polygon mesh is the universal representation for 3D surfaces in real-time graphics, simulation, and manufacturing. But a raw list of triangles tells you nothing about connectivity: which faces share an edge, which edges surround a vertex, which face is on the other side of this boundary. Mesh data structures encode this adjacency information so that traversal and modification operations run in constant time. This lesson covers face-vertex lists, the half-edge data structure, Euler's formula, mesh traversal, and local mesh operations.

## Face-Vertex Representation

The simplest mesh representation stores two arrays:

- **Vertex array**: positions $V = [v_0, v_1, v_2, \ldots]$ where each $v_i \in \mathbb{R}^3$
- **Face array**: index triples $F = [(i_0, i_1, i_2), (i_3, i_4, i_5), \ldots]$ referencing the vertex array

This is the format used by OBJ files, STL files, and GPU vertex/index buffers.

```python
# OBJ-style face-vertex mesh
vertices = [
    (0, 0, 0),  # v0
    (1, 0, 0),  # v1
    (1, 1, 0),  # v2
    (0, 1, 0),  # v3
]
faces = [
    (0, 1, 2),  # f0: triangle v0-v1-v2
    (0, 2, 3),  # f1: triangle v0-v2-v3
]
```

### Advantages

- Simple, minimal memory
- Directly maps to GPU index buffers (`GL_ELEMENT_ARRAY_BUFFER`)
- Easy to serialize (OBJ, glTF, PLY)

### Limitations

| Query | Complexity |
|---|---|
| Vertices of face $f$ | $O(1)$ — direct index lookup |
| Faces adjacent to face $f$ | $O(F)$ — must scan all faces |
| Faces incident to vertex $v$ | $O(F)$ — must scan all faces |
| Edges of the mesh | Not explicitly stored |

For any operation requiring adjacency information, face-vertex is inadequate. You must build auxiliary structures — or use a more expressive representation.

## Half-Edge Data Structure

The **half-edge** (or doubly-connected edge list, DCEL) is the standard connectivity structure for manifold polygon meshes. It splits each undirected edge into two directed **half-edges** pointing in opposite directions.

### Core Elements

Each half-edge $h$ stores:

| Field | Description |
|---|---|
| `h.twin` | The opposite half-edge sharing the same geometric edge |
| `h.next` | The next half-edge in the same face (CCW order) |
| `h.prev` | The previous half-edge in the same face (optional; `prev = next.next` for triangles) |
| `h.vertex` | The vertex this half-edge **originates from** (or points to, depending on convention) |
| `h.face` | The face to the left of this half-edge |

Each **vertex** $v$ stores:

| Field | Description |
|---|---|
| `v.halfedge` | One outgoing half-edge from $v$ |
| `v.position` | Geometric position $(x, y, z)$ |

Each **face** $f$ stores:

| Field | Description |
|---|---|
| `f.halfedge` | One half-edge on the boundary of $f$ |

Each **edge** $e$ (optional, for convenience):

| Field | Description |
|---|---|
| `e.halfedge` | One of its two half-edges |

### Invariants

For a valid half-edge mesh on an orientable 2-manifold:
- `h.twin.twin == h` (twin is an involution)
- `h.next.prev == h` and `h.prev.next == h` (next/prev are inverses)
- `h.twin.vertex == h.next.vertex` (the twin starts where this half-edge ends, when `h.vertex` is the origin)
- Every half-edge cycle `h, h.next, h.next.next, ...` returns to `h` and encloses exactly one face
- Boundary edges have their twin's face set to `null` (or a special boundary face)

### Constant-Time Queries

| Query | Implementation |
|---|---|
| Other vertex of edge | `h.twin.vertex` |
| Next edge around face | `h.next` |
| Adjacent face across edge | `h.twin.face` |
| All edges around a face | Follow `h.next` chain |
| Is edge on boundary? | `h.face == null` or `h.twin.face == null` |

### Vertex One-Ring Traversal

The **one-ring** of a vertex $v$ is the set of vertices connected to $v$ by an edge. Traversing it is the most common operation in geometry processing:

```python
def vertex_one_ring(v):
    """Traverse the one-ring of vertex v. Returns neighboring vertices."""
    neighbors = []
    start = v.halfedge
    h = start
    while True:
        # h goes from v to some neighbor
        neighbors.append(h.twin.vertex)
        # Move to the next outgoing half-edge from v
        h = h.twin.next
        if h == start:
            break
    return neighbors
```

This traversal is $O(k)$ where $k$ is the **valence** (degree) of $v$ — typically 5-7 for well-formed triangle meshes.

### Face Adjacency Traversal

```python
def adjacent_faces(f):
    """Return all faces sharing an edge with face f."""
    neighbors = []
    start = f.halfedge
    h = start
    while True:
        twin_face = h.twin.face
        if twin_face is not None:
            neighbors.append(twin_face)
        h = h.next
        if h == start:
            break
    return neighbors
```

## Worked Example: Half-Edge Structure for a Tetrahedron

A tetrahedron has 4 vertices, 6 edges, and 4 triangular faces. Let the vertices be:

$$v_0 = (0, 0, 0), \quad v_1 = (1, 0, 0), \quad v_2 = (0.5, \sqrt{3}/2, 0), \quad v_3 = (0.5, \sqrt{3}/6, \sqrt{6}/3)$$

Faces (CCW when viewed from outside):

$$f_0 = (v_0, v_1, v_2), \quad f_1 = (v_0, v_3, v_1), \quad f_2 = (v_1, v_3, v_2), \quad f_3 = (v_0, v_2, v_3)$$

Each face has 3 half-edges, giving $4 \times 3 = 12$ half-edges total (which equals $2 \times 6$ edges, as expected).

**Half-edge table** (using notation $h_{ij}$ for the half-edge from $v_i$ to $v_j$):

| Half-edge | Vertex (origin) | Face | Next | Twin |
|---|---|---|---|---|
| $h_{01}$ | $v_0$ | $f_0$ | $h_{12}$ | $h_{10}$ |
| $h_{12}$ | $v_1$ | $f_0$ | $h_{20}$ | $h_{21}$ |
| $h_{20}$ | $v_2$ | $f_0$ | $h_{01}$ | $h_{02}$ |
| $h_{03}$ | $v_0$ | $f_1$ | $h_{31}$ | $h_{30}$ |
| $h_{31}$ | $v_3$ | $f_1$ | $h_{10}$ | $h_{13}$ |
| $h_{10}$ | $v_1$ | $f_1$ | $h_{03}$ | $h_{01}$ |
| $h_{13}$ | $v_1$ | $f_2$ | $h_{32}$ | $h_{31}$ |
| $h_{32}$ | $v_3$ | $f_2$ | $h_{21}$ | $h_{23}$ |
| $h_{21}$ | $v_2$ | $f_2$ | $h_{13}$ | $h_{12}$ |
| $h_{02}$ | $v_0$ | $f_3$ | $h_{23}$ | $h_{20}$ |
| $h_{23}$ | $v_2$ | $f_3$ | $h_{30}$ | $h_{32}$ |
| $h_{30}$ | $v_3$ | $f_3$ | $h_{02}$ | $h_{03}$ |

**Verification**: Every half-edge has a twin on the adjacent face. Following the `next` chain around each face returns to the starting half-edge in 3 steps. Each vertex has valence 3 (connected to all other vertices).

One-ring of $v_0$: start at $h_{01}$. Neighbors: $v_1$ (via $h_{01}$), then $h_{01}.twin.next = h_{10}.next = h_{03}$, neighbor $v_3$ (via $h_{03}$), then $h_{03}.twin.next = h_{30}.next = h_{02}$, neighbor $v_2$ (via $h_{02}$), then $h_{02}.twin.next = h_{20}.next = h_{01}$ — back to start. One-ring = $\{v_1, v_3, v_2\}$.

## Winged-Edge Data Structure

The **winged-edge** structure (Baumgart, 1975) stores connectivity from the perspective of each edge rather than each half-edge. Each edge stores references to its two vertices, two faces, and four "wing" edges (the predecessor and successor edges around each of the two faces).

While historically important, the winged-edge structure has been largely superseded by the half-edge structure because:
- Traversal requires conditional checks (which side of the edge am I on?)
- The half-edge formulation eliminates this ambiguity by giving each direction its own record
- Modern libraries (OpenMesh, CGAL, geometry-central) all use half-edges

## Euler Characteristic and Topology

### Euler's Formula

For a closed, connected, orientable surface of **genus** $g$:

$$V - E + F = 2 - 2g$$

where $V$ = vertices, $E$ = edges, $F$ = faces.

| Surface | Genus | $\chi = V - E + F$ |
|---|---|---|
| Sphere (genus 0) | 0 | 2 |
| Torus (genus 1) | 1 | 0 |
| Double torus (genus 2) | 2 | $-2$ |

For a tetrahedron: $V = 4$, $E = 6$, $F = 4$, so $\chi = 4 - 6 + 4 = 2$ — confirming genus 0 (topologically a sphere).

### Useful Corollaries for Triangle Meshes

For a **closed** triangle mesh (no boundary) of genus 0:

- Every face has 3 edges, every edge is shared by 2 faces: $3F = 2E$
- Combining with $V - E + F = 2$: $F = 2V - 4$ and $E = 3V - 6$
- Average vertex valence: $\bar{k} = \frac{2E}{V} = \frac{2(3V-6)}{V} = 6 - \frac{12}{V} \approx 6$ for large $V$

This means that for large closed triangle meshes, the average valence is approximately 6 — a fundamental fact that drives algorithm design.

### Manifold Properties

A mesh is a **2-manifold** if every point on its surface has a neighborhood homeomorphic to a disk (or a half-disk on the boundary). In discrete terms:

- **Edge-manifold**: Every edge is shared by at most 2 faces
- **Vertex-manifold**: The faces around every vertex form a single fan (disk) or strip (half-disk on boundary)
- **Non-manifold edge**: Shared by 3+ faces (e.g., two cubes sharing an edge)
- **Non-manifold vertex**: The link of the vertex is disconnected (e.g., two cones meeting at a point — "bowtie")

Half-edge structures require 2-manifold topology. Modern extensions like the **radial-edge** structure (Weiler, 1985) and libraries like MeshLib (2025) handle non-manifold configurations by chaining multiple half-edges around singular edges.

## Mesh Operations

### Edge Flip

Replaces the diagonal of a quadrilateral formed by two adjacent triangles. In a half-edge mesh:

1. Let $h$ be a half-edge on the shared edge, with $h.face = f_1$ and $h.twin.face = f_2$
2. The four boundary vertices form a quad — the flip replaces the current diagonal with the other diagonal
3. Update: reassign `vertex`, `next`, `prev`, and `face` pointers for the 6 affected half-edges
4. Update vertex outgoing half-edges if they pointed to a modified half-edge

**Constraint**: The resulting triangles must not invert (check that the new diagonal does not cross the quad boundary — the quad must be convex).

Edge flipping is the core primitive of the Delaunay property restoration: flip an edge if the opposite vertex lies inside the circumcircle of the current triangle.

### Edge Split

Inserts a new vertex at the midpoint of an edge, replacing 2 triangles with 4:

1. Create new vertex $v_m$ at the edge midpoint
2. Split the edge into two edges
3. Each adjacent triangle is split into two triangles by connecting $v_m$ to the opposite vertex
4. Create 2 new edges (from $v_m$ to each opposite vertex), 2 new faces, and 6 new half-edges

Edge splitting increases mesh resolution locally — essential for adaptive refinement and subdivision.

### Edge Collapse

Contracts an edge to a single vertex, removing 2 triangles (or 1 on a boundary):

1. Select an edge $e = (v_a, v_b)$
2. Move $v_a$ to the target position (midpoint, optimal position from QEM, etc.)
3. Redirect all half-edges that pointed to $v_b$ to point to $v_a$
4. Remove the two degenerate triangles that collapse
5. Remove $v_b$, the collapsed edge, and 2 additional edges

Edge collapse is the fundamental operation in **mesh simplification**. The Quadric Error Metric (QEM) algorithm (Garland & Heckbert, 1997) greedily collapses edges in order of minimum geometric error, producing high-quality LOD meshes.

**Link condition**: An edge $(v_a, v_b)$ can be collapsed without creating non-manifold topology if and only if the intersection of the one-rings of $v_a$ and $v_b$ consists of exactly the two vertices opposite the edge (for an interior edge).

## Mesh Quality Metrics

Well-shaped triangles are critical for simulation stability (FEM), rendering quality, and subdivision smoothness.

### Aspect Ratio

$$\text{AR} = \frac{l_{\max}}{h_{\min}}$$

where $l_{\max}$ is the longest edge and $h_{\min}$ is the shortest altitude. For an equilateral triangle, $\text{AR} = \frac{2}{\sqrt{3}} \approx 1.155$. Values above 5-10 indicate poor quality ("sliver" triangles).

### Minimum Angle

The minimum interior angle across all triangles. Delaunay triangulations maximize this metric. For FEM, a minimum angle above $20°$-$30°$ is typically required for stable computation.

### Radius Ratio

$$q = \frac{2 r_{\text{in}}}{r_{\text{out}}}$$

where $r_{\text{in}}$ is the inradius and $r_{\text{out}}$ is the circumradius. A perfect equilateral triangle has $q = 1$. This metric is commonly used in mesh generation (Shewchuk, 2002).

### In Practice

Game meshes prioritize triangle count over quality — slivers are acceptable if not visible. Simulation meshes (CFD, FEM, cloth) require strictly bounded aspect ratios. Remeshing algorithms (isotropic remeshing, ACVD) use iterative edge splits, collapses, and flips to optimize mesh quality while preserving geometry.

## Modern Implementations

### GPU-Accelerated Half-Edge (RXMesh)

**RXMesh** (Mahmoud et al., 2021-2025) pioneered GPU-native half-edge representation by subdividing meshes into cache-resident patches, achieving 15-50x speedups over CPU implementations for operations like simplification on million-vertex meshes.

### CGAL 6.0+ (2024-2025)

CGAL integrated new remeshing algorithms leveraging half-edge structures, including isotropic remeshing and planar patch remeshing that detects coplanar regions and reduces triangle count by 50-90% for CAD models.

### geometry-central

A modern MIT-licensed C++ library providing high-level half-edge mesh operations with automatic handling of boundary, non-manifold repair, and intrinsic geometry computations.

## Exercises

<details>
<summary>Exercise 1: Euler Verification</summary>

<p>A closed mesh has 100 vertices and is topologically a torus (genus 1). How many edges and faces does it have, assuming it is a pure triangle mesh?</p>

<p><strong>Solution:</strong></p>

<p>For genus 1: $V - E + F = 0$, so $E - F = V = 100$.</p>
<p>For a closed triangle mesh: $3F = 2E$, so $F = \frac{2E}{3}$.</p>
<p>Substituting: $E - \frac{2E}{3} = 100 \Rightarrow \frac{E}{3} = 100 \Rightarrow E = 300$.</p>
<p>$F = \frac{2 \cdot 300}{3} = 200$.</p>
<p>Check: $100 - 300 + 200 = 0$.</p>
</details>

<details>
<summary>Exercise 2: Half-Edge Traversal</summary>

<p>Given the half-edge structure of the tetrahedron from the worked example, write the sequence of half-edges visited when traversing the one-ring of $v_1$. What are the neighboring vertices?</p>

<p><strong>Solution:</strong></p>

<p>Start at $v_1.halfedge$, say $h_{12}$.</p>
<p>1. $h_{12}$: neighbor = $h_{12}.twin.vertex = v_2$ (since $h_{12}.twin = h_{21}$, origin $v_2$).</p>
<p>2. $h_{12}.twin.next = h_{21}.next = h_{13}$: neighbor = $h_{13}.twin.vertex = v_3$.</p>
<p>3. $h_{13}.twin.next = h_{31}.next = h_{10}$: neighbor = $h_{10}.twin.vertex = v_0$.</p>
<p>4. $h_{10}.twin.next = h_{01}.next = h_{12}$ — back to start.</p>

<p>One-ring of $v_1 = \{v_2, v_3, v_0\}$. Valence = 3.</p>
</details>

<details>
<summary>Exercise 3: Edge Collapse Safety</summary>

<p>Consider a mesh where vertices $v_a$ and $v_b$ share an edge. The one-ring of $v_a$ is $\{v_b, v_c, v_d, v_e\}$ and the one-ring of $v_b$ is $\{v_a, v_c, v_e, v_f\}$. Can the edge $(v_a, v_b)$ be safely collapsed? Apply the link condition.</p>

<p><strong>Solution:</strong></p>

<p>The link condition requires that the intersection of the one-rings of $v_a$ and $v_b$ (excluding $v_a$ and $v_b$ themselves) equals exactly the vertices opposite the edge — i.e., the two vertices shared by the triangles on either side.</p>

<p>One-ring of $v_a$ (excluding $v_b$): $\{v_c, v_d, v_e\}$.</p>
<p>One-ring of $v_b$ (excluding $v_a$): $\{v_c, v_e, v_f\}$.</p>
<p>Intersection: $\{v_c, v_e\}$.</p>

<p>For an interior edge, the two triangles sharing edge $(v_a, v_b)$ should have opposite vertices. If these are $v_c$ and $v_e$, then the intersection has exactly 2 elements matching the opposite vertices. The link condition is satisfied, so the collapse is <strong>safe</strong>.</p>
</details>

## Key Takeaways

- Face-vertex (index buffer) is the simplest mesh format but provides no adjacency information; fine for rendering, inadequate for geometry processing
- The half-edge data structure splits each edge into two directed half-edges, enabling constant-time adjacency queries: twin, next, vertex, and face
- Vertex one-ring traversal follows the pattern `h = h.twin.next` around the vertex, visiting all neighbors in $O(k)$ where $k$ is the valence
- Euler's formula $V - E + F = 2 - 2g$ connects vertex, edge, and face counts to surface topology; for large closed genus-0 triangle meshes, average valence approaches 6
- A 2-manifold mesh requires every edge shared by at most 2 faces and every vertex link forming a single fan or strip
- Edge flip, split, and collapse are the three fundamental local operations; they underlie Delaunay flipping, adaptive refinement, and mesh simplification (QEM)
- Mesh quality is measured by aspect ratio, minimum angle, and radius ratio; Delaunay triangulations maximize minimum angle
- GPU-native half-edge implementations (RXMesh, 2021-2025) achieve 15-50x speedups by partitioning meshes into cache-resident patches
