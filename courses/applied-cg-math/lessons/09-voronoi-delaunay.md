# Voronoi Diagrams & Delaunay Triangulation

Voronoi diagrams and Delaunay triangulations are dual structures that partition the plane based on nearest-neighbor relationships. They are foundational to mesh generation, procedural texturing, spatial analysis, and pathfinding. Every cell-noise shader, every terrain LOD system, and most quality mesh generators rely on these constructs. This lesson covers their definitions, properties, efficient construction algorithms, and applications in computer graphics and simulation.

## Voronoi Diagrams

### Definition

Given a set $S = \{p_1, p_2, \dots, p_n\}$ of **sites** (or generators) in $\mathbb{R}^2$, the **Voronoi cell** (or region) of site $p_i$ is:

$$\text{Vor}(p_i) = \{ x \in \mathbb{R}^2 \mid \|x - p_i\| \leq \|x - p_j\| \;\forall\; j \neq i \}$$

Each cell contains all points closer to $p_i$ than to any other site. The collection of all cells forms the **Voronoi diagram** $\text{Vor}(S)$.

### Structural Properties

| Property | Detail |
|---|---|
| Cells | Convex polygons (some unbounded on the convex hull boundary) |
| Edges | Equidistant from exactly two sites — segments of perpendicular bisectors |
| Vertices | Equidistant from exactly three sites (generic case) |
| Complexity | $O(n)$ vertices, edges, and faces (by Euler's formula) |

A Voronoi vertex is the center of a circle passing through three sites with **no other site inside** the circle. This is the empty-circle property that directly links Voronoi diagrams to Delaunay triangulation.

### Applications in Computer Graphics

- **Nearest-neighbor queries**: Locating the closest feature point for Worley / cell noise (Worley, 1996)
- **Procedural texturing**: Cell noise evaluates $F_1(x)$ (distance to nearest site) and $F_2(x)$ (distance to second nearest) to create organic patterns like stone, scales, and soap bubbles
- **Procedural terrain generation**: Voronoi cells define biomes, elevation regions, and island shapes in games (e.g., Amit Patel's polygonal map generation, 2010)
- **Mesh generation**: Centroidal Voronoi tessellations (CVT) produce high-quality isotropic meshes (Du et al., 1999)
- **LOD terrain**: Voronoi-based adaptive tiling provides view-dependent terrain refinement

## Delaunay Triangulation

### Definition

The **Delaunay triangulation** $\text{DT}(S)$ of a point set $S$ is the triangulation such that no point in $S$ lies inside the circumcircle of any triangle. This is the **empty circumcircle property**.

Equivalently, $\text{DT}(S)$ is the straight-line dual of $\text{Vor}(S)$: two sites $p_i$ and $p_j$ are connected by a Delaunay edge if and only if their Voronoi cells share an edge.

### Key Properties

1. **Maximizes minimum angle**: Among all triangulations of $S$, the Delaunay triangulation maximizes the smallest angle, producing well-shaped triangles and avoiding "sliver" triangles
2. **Uniqueness**: Unique when no four points are co-circular (generic position)
3. **Contains the nearest-neighbor graph**: The nearest neighbor of each point is always a Delaunay neighbor
4. **Contains the Euclidean minimum spanning tree**: $\text{EMST}(S) \subseteq \text{DT}(S)$, enabling $O(n \log n)$ MST computation
5. **Complexity**: Exactly $O(n)$ triangles and edges for $n$ points in 2D

### Duality with Voronoi

The relationship between $\text{Vor}(S)$ and $\text{DT}(S)$ is a precise geometric duality:

| Voronoi | Delaunay |
|---|---|
| Vertex (3 cells meet) | Triangle (3 sites) |
| Edge (2 cells share) | Edge (2 sites connected) |
| Cell (1 site) | Vertex (1 site) |

Computing one gives the other for free — every Delaunay triangle corresponds to a Voronoi vertex at the circumcenter, and every Voronoi edge is the perpendicular bisector of a Delaunay edge.

## Algorithms

### Fortune's Sweep Line — $O(n \log n)$

Fortune's algorithm (Fortune, 1986) constructs the Voronoi diagram using a horizontal sweep line moving top-to-bottom. A parabolic **beach line** tracks the locus of points equidistant from the sweep line and the nearest site above it.

**Data structures**:
- A balanced BST (the beach line) storing parabolic arcs
- A priority queue of **events**, ordered by $y$-coordinate

**Event types**:
1. **Site event**: The sweep line reaches a new site. A new parabolic arc is inserted into the beach line, potentially splitting an existing arc. This creates new breakpoints that trace Voronoi edges.
2. **Circle event**: Three consecutive arcs on the beach line converge — the middle arc shrinks to zero width. The convergence point is a Voronoi vertex, and the middle arc is removed. The two Voronoi edges meeting at this vertex are finalized, and a new edge begins.

**Complexity**: $O(n \log n)$ time and $O(n)$ space — optimal for comparison-based algorithms.

### Incremental Insertion (Randomized) — $O(n \log n)$ expected

Start with a valid Delaunay triangulation (e.g., from a bounding super-triangle). Insert each point $p$ one at a time:
1. Locate the triangle containing $p$ (via walking or a point-location structure)
2. Split the triangle (or edge, if $p$ lies on an edge)
3. Restore the Delaunay property by flipping non-Delaunay edges

With randomized insertion order and a history DAG for point location, expected time is $O(n \log n)$.

### Bowyer-Watson Algorithm

The Bowyer-Watson algorithm (Bowyer, 1981; Watson, 1981) is the most widely implemented incremental Delaunay algorithm due to its simplicity. It works in any dimension.

```python
def bowyer_watson(points):
    """Compute 2D Delaunay triangulation via Bowyer-Watson."""
    # Create a super-triangle large enough to contain all points
    super_tri = make_super_triangle(points)
    triangulation = [super_tri]

    for point in points:
        # Step 1: Find all triangles whose circumcircle contains the point
        bad_triangles = []
        for tri in triangulation:
            if point_in_circumcircle(tri, point):
                bad_triangles.append(tri)

        # Step 2: Find the boundary polygon (edges not shared by two bad triangles)
        polygon = []
        for tri in bad_triangles:
            for edge in edges_of(tri):
                # Edge is on the boundary if it is not shared with another bad triangle
                shared = False
                for other in bad_triangles:
                    if other is not tri and shares_edge(other, edge):
                        shared = True
                        break
                if not shared:
                    polygon.append(edge)

        # Step 3: Remove bad triangles
        for tri in bad_triangles:
            triangulation.remove(tri)

        # Step 4: Re-triangulate the hole with new triangles connecting to the point
        for edge in polygon:
            new_tri = make_triangle(edge[0], edge[1], point)
            triangulation.append(new_tri)

    # Step 5: Remove triangles sharing vertices with the super-triangle
    triangulation = [
        tri for tri in triangulation
        if not shares_vertex(tri, super_tri)
    ]
    return triangulation

def point_in_circumcircle(tri, point):
    """Return True if point lies inside the circumcircle of tri.
    Uses the determinant test (positive = inside for CCW triangles)."""
    ax, ay = tri.a.x - point.x, tri.a.y - point.y
    bx, by = tri.b.x - point.x, tri.b.y - point.y
    cx, cy = tri.c.x - point.x, tri.c.y - point.y
    det = (ax * ax + ay * ay) * (bx * cy - cx * by) \
        - (bx * bx + by * by) * (ax * cy - cx * ay) \
        + (cx * cx + cy * cy) * (ax * by - bx * ay)
    return det > 0  # Assumes CCW winding
```

**Key insight**: The circumcircle test uses the **in-circle determinant** — a $4 \times 4$ determinant lifted to the paraboloid $z = x^2 + y^2$, which avoids explicit circumcenter computation.

**Complexity**: $O(n^2)$ worst-case, $O(n \log n)$ expected with randomized insertion order and efficient spatial lookup.

## Worked Example: Delaunay Triangulation of 4 Points

Triangulate $S = \{A(0,0),\; B(4,0),\; C(2,3),\; D(4,4)\}$.

**Step 1 — Start with a super-triangle** enclosing all points.

**Step 2 — Insert $A(0,0)$**: Splits the super-triangle. After cleanup, one triangle exists: the super-triangle with $A$ connected.

**Step 3 — Insert $B(4,0)$**: The circumcircle of the triangle containing $B$ includes $B$. Re-triangulate. We now have edges $AB$.

**Step 4 — Insert $C(2,3)$**: After insertion and edge flipping, we get triangles $\triangle ABC$ with additional super-triangle fragments.

**Step 5 — Insert $D(4,4)$**: $D$ falls inside the circumcircle of $\triangle ABC$ — let us check.

Circumcircle of $\triangle ABC$: vertices $A(0,0)$, $B(4,0)$, $C(2,3)$.

$$x_c = \frac{|AB|^2 \cdot C_y - |AC|^2 \cdot B_y + \ldots}{4 \cdot \text{Area}}$$

Using the standard formula, the circumcenter is at $(2, \frac{7}{6}) \approx (2, 1.167)$ with radius $r \approx 2.33$.

Distance from circumcenter to $D(4,4)$: $\sqrt{(4-2)^2 + (4-\frac{7}{6})^2} = \sqrt{4 + \frac{289}{36}} \approx 3.18 > 2.33$.

So $D$ is **outside** the circumcircle of $\triangle ABC$. Therefore $\triangle ABC$ is a valid Delaunay triangle. After insertion and flipping:

**Final triangulation**: $\{\triangle ABC, \; \triangle BCD\}$

Verify $\triangle BCD$: $B(4,0)$, $C(2,3)$, $D(4,4)$. Check that $A(0,0)$ is outside its circumcircle. The circumcenter of $\triangle BCD$ is at $(4.167, 2)$ with $r \approx 2.24$. Distance to $A = \sqrt{4.167^2 + 4} \approx 4.63 > 2.24$. Valid.

The diagonal $BC$ is chosen over $AD$ because it maximizes the minimum angle — this is the Delaunay criterion at work.

## Constrained Delaunay Triangulation (CDT)

In many applications (meshing a polygon, terrain with breaklines), certain edges **must** appear in the triangulation even if they violate the empty circumcircle property.

A **Constrained Delaunay Triangulation** (CDT) is a triangulation where:
1. All **constraint edges** are present
2. For every triangle, its circumcircle contains no visible point (a point $p$ is "visible" from triangle $t$ if the segment from $p$ to the interior of $t$ does not cross a constraint edge)

CDT algorithms typically:
1. Compute the unconstrained Delaunay triangulation
2. Insert constraint edges by flipping or splitting existing edges
3. Restore the constrained Delaunay property

Libraries like **Triangle** (Shewchuk, 1996) and **CGAL** provide robust CDT with quality refinement (Ruppert's algorithm, Chew's second algorithm).

### Application: Navigation Meshes

Game engines use CDTs to build navigation meshes (navmeshes) from level geometry. The constraint edges represent walls and obstacles, and the triangulated walkable area enables pathfinding via funnel algorithms.

## Weighted Voronoi / Power Diagrams

In a standard Voronoi diagram, all sites have equal "influence." **Weighted Voronoi diagrams** assign a weight $w_i$ to each site, modifying the distance metric.

### Power Diagram (Additively Weighted)

The **power distance** from point $x$ to weighted site $(p_i, w_i)$ is:

$$\text{pow}(x, p_i) = \|x - p_i\|^2 - w_i$$

The **power cell** of site $i$ is:

$$\text{Pow}(p_i) = \{ x \mid \text{pow}(x, p_i) \leq \text{pow}(x, p_j) \;\forall\; j \neq i \}$$

The bisector between two sites is a **hyperplane** (not a parabola), so power cells are still convex polygons. The dual of a power diagram is the **regular triangulation** (weighted Delaunay triangulation).

### Applications

- **Optimal transport**: Computing Wasserstein distances via semi-discrete optimal transport (Levy, 2015)
- **Blue-noise sampling**: Capacity-constrained Voronoi tessellations for anti-aliased sampling
- **Foam and bubble simulation**: Bubbles of different sizes naturally form power diagrams
- **Molecular surfaces**: Atoms with different van der Waals radii

## Applications in Computer Graphics

### Procedural Shattering / Destruction

Voronoi fracture is the standard technique for real-time destruction in games:

1. Scatter seed points inside the object (biased toward the impact point)
2. Compute the 3D Voronoi diagram clipped to the object's volume
3. Each Voronoi cell becomes a rigid-body shard

This produces physically plausible fracture patterns because Voronoi cells are convex — matching real-world brittle fracture. Houdini, Blender, and Unreal Engine all provide Voronoi-based destruction tools.

### LOD Terrain

Voronoi diagrams enable **view-dependent terrain refinement**:
- Place sites at varying density (dense near the camera, sparse at the horizon)
- The Voronoi cells define terrain patches at appropriate detail levels
- Centroidal Voronoi tessellation (Lloyd relaxation) ensures even spacing

### Cell Noise (Worley Noise)

Cell noise, introduced by Steven Worley (1996), evaluates the distance to the $k$-th nearest feature point:

```glsl
// Simplified 2D cell noise in GLSL
float cellNoise(vec2 p) {
    vec2 cell = floor(p);
    float minDist = 1e10;

    // Check 3x3 neighborhood of cells
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = cell + vec2(x, y);
            // Hash-based random point within cell
            vec2 point = neighbor + hash2(neighbor);
            float d = distance(p, point);
            minDist = min(minDist, d);
        }
    }
    return minDist;  // F1 distance
}
```

The $F_1$ value gives the distance to the nearest Voronoi edge, producing the classic cell pattern. $F_2 - F_1$ creates outlined cell walls, useful for cracked earth, scales, and cobblestone textures.

### Recent Developments

Research on Delaunay triangulations with predictions (ITCS 2026) explores algorithms that can compute the correct Delaunay triangulation faster when given a predicted triangulation "close" to the true result. This learning-augmented approach reduces practical running time when predictions are accurate while maintaining worst-case guarantees when they are not.

GPU-parallel Voronoi computation has matured, with jump flooding algorithms (JFA) computing approximate Voronoi diagrams on the GPU in $O(\log n)$ passes over a texture grid (Rong & Tan, 2006), now widely used for distance field generation in games.

## Exercises

<details>
<summary>Exercise 1: Voronoi Cell Count</summary>

<p>Given $n$ sites in general position, how many Voronoi edges and vertices does the diagram have? Express in terms of $n$ using Euler's formula for planar graphs.</p>

<p><strong>Solution:</strong></p>

<p>The Voronoi diagram is a planar graph. Adding a vertex at infinity and connecting all unbounded edges to it, we get $F = n$ (one face per site), and by Euler's formula $V - E + F = 2$.</p>

<p>For the Delaunay triangulation (the dual), let $h$ be the number of convex hull vertices. The number of Delaunay triangles is $2n - h - 2$ and the number of edges is $3n - h - 3$.</p>

<p>For the Voronoi diagram: $V_{\text{vor}} = 2n - h - 2$, $E_{\text{vor}} = 3n - h - 3$. In the worst case ($h = 3$): $V_{\text{vor}} = 2n - 5$, $E_{\text{vor}} = 3n - 6$. All are $O(n)$.</p>
</details>

<details>
<summary>Exercise 2: Circumcircle Test</summary>

<p>Given triangle $\triangle PQR$ with $P = (0, 0)$, $Q = (6, 0)$, $R = (3, 5)$ and a test point $T = (5, 4)$, determine whether $T$ lies inside the circumcircle of $\triangle PQR$ using the in-circle determinant.</p>

<p><strong>Solution:</strong></p>

<p>Translate so $T$ is the origin: $P' = (-5, -4)$, $Q' = (1, -4)$, $R' = (-2, 1)$.</p>

<p>Compute the determinant:</p>

$$D = \begin{vmatrix} -5 & -4 & 41 \\ 1 & -4 & 17 \\ -2 & 1 & 5 \end{vmatrix}$$

<p>$D = -5(-20 - 17) - (-4)(5 - (-34)) + 41(1 - 8)$</p>
<p>$= -5(-37) + 4(39) + 41(-7)$</p>
<p>$= 185 + 156 - 287 = 54$</p>

<p>Since $D > 0$ (for CCW-oriented triangle), $T$ is <strong>inside</strong> the circumcircle. Therefore, if $T$ were inserted, the edge opposite to $T$ in any triangle containing it would need to be flipped.</p>
</details>

<details>
<summary>Exercise 3: Lloyd Relaxation</summary>

<p>Starting with three sites $A = (0, 0)$, $B = (4, 0)$, $C = (2, 4)$ in a $[0, 5] \times [0, 5]$ square, describe one iteration of Lloyd relaxation. What property does the resulting point distribution approach?</p>

<p><strong>Solution:</strong></p>

<p>1. Compute the Voronoi diagram of $\{A, B, C\}$ clipped to $[0, 5]^2$.</p>
<p>2. For each Voronoi cell, compute its centroid.</p>
<p>3. Move each site to the centroid of its cell.</p>

<p>After many iterations, the sites converge to a <strong>centroidal Voronoi tessellation</strong> (CVT) where each site coincides with the centroid of its cell. This produces an approximately hexagonal, evenly-spaced distribution — ideal for mesh generation and blue-noise sampling.</p>
</details>

## Key Takeaways

- A Voronoi diagram partitions the plane into convex cells where each cell contains all points nearest to a particular site; it has $O(n)$ complexity
- The Delaunay triangulation is the straight-line dual of the Voronoi diagram; it maximizes the minimum angle among all triangulations and satisfies the empty circumcircle property
- Fortune's sweep-line algorithm computes the Voronoi diagram in optimal $O(n \log n)$ time using a beach line and event queue
- The Bowyer-Watson algorithm is the simplest incremental Delaunay algorithm: find bad triangles (circumcircle violation), extract the boundary polygon, and re-triangulate
- The in-circle determinant test avoids explicit circumcenter computation and is the core primitive of Delaunay algorithms
- Constrained Delaunay Triangulations (CDT) enforce required edges while preserving Delaunay quality where possible — essential for mesh generation and navigation meshes
- Power diagrams generalize Voronoi with per-site weights, enabling applications in optimal transport, foam simulation, and molecular surfaces
- In CG, Voronoi diagrams drive procedural shattering, cell noise / Worley noise, LOD terrain, and centroidal Voronoi mesh generation
- GPU-parallel approaches like jump flooding enable real-time approximate Voronoi computation for distance fields
