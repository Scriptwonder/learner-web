# Spatial Acceleration Structures

In a scene with $n$ triangles, testing every ray against every triangle costs $O(n)$ per ray. For a 1080p image with 2 million pixels, a scene with 1 million triangles, and even a single ray per pixel, that is $2 \times 10^{12}$ intersection tests — far too slow for real-time or even practical offline rendering. Spatial acceleration structures solve this by organizing geometry hierarchically so that each ray only tests the small subset of triangles it could possibly hit. This lesson covers the major structures: AABBs, BVH (including SAH-based construction and GPU-oriented LBVH), octrees, and kd-trees, along with modern hardware acceleration via RT cores.

## Motivation: The Cost of Brute Force

Consider a ray tracer rendering a scene with $n = 10^6$ triangles at $1920 \times 1080$ resolution with one primary ray per pixel:

- Brute force: $2{,}073{,}600 \times 10^6 = 2.07 \times 10^{12}$ ray-triangle tests
- With a good BVH: each ray traverses $\sim O(\log n)$ nodes and tests $\sim 10\text{--}50$ triangles on average
- That is roughly $2{,}073{,}600 \times 50 \approx 10^8$ tests — a **10,000x improvement**

Add reflections, refractions, shadows, and global illumination (each spawning secondary rays), and the difference between $O(n)$ and $O(\log n)$ per ray becomes the difference between hours and milliseconds.

## Axis-Aligned Bounding Boxes (AABBs)

An **AABB** is the simplest bounding volume: a box whose faces are aligned with the coordinate axes, defined by two corners $\vec{B}_{\min}$ and $\vec{B}_{\max}$.

### Properties

- **Construction:** $O(n)$ — scan all vertices, track min/max per axis
- **Ray intersection:** Very fast using the slab method (6 subtractions, 6 multiplies, a few min/max operations)
- **Tight for axis-aligned geometry**, loose for rotated/diagonal geometry
- **Merge two AABBs:** Component-wise min/max of corners

```python
class AABB:
    def __init__(self, bmin, bmax):
        self.bmin = bmin  # (x, y, z) minimum corner
        self.bmax = bmax  # (x, y, z) maximum corner

    @staticmethod
    def from_triangles(triangles):
        bmin = [float('inf')] * 3
        bmax = [float('-inf')] * 3
        for tri in triangles:
            for v in tri.vertices:
                for i in range(3):
                    bmin[i] = min(bmin[i], v[i])
                    bmax[i] = max(bmax[i], v[i])
        return AABB(bmin, bmax)

    def merge(self, other):
        return AABB(
            [min(self.bmin[i], other.bmin[i]) for i in range(3)],
            [max(self.bmax[i], other.bmax[i]) for i in range(3)]
        )
```

### Ray-AABB Intersection (Slab Method)

The slab method computes the ray's entry and exit $t$-values for each axis pair of parallel planes. A hit occurs when $t_{\text{enter}} \leq t_{\text{exit}}$ and $t_{\text{exit}} \geq 0$:

$$t_{\text{enter}} = \max(t_{x_{\min}}, t_{y_{\min}}, t_{z_{\min}})$$
$$t_{\text{exit}} = \min(t_{x_{\max}}, t_{y_{\max}}, t_{z_{\max}})$$

where $t_{x_{\min}} = (B_{\min}.x - O_x) \cdot D_x^{-1}$ and $t_{x_{\max}} = (B_{\max}.x - O_x) \cdot D_x^{-1}$, with a swap when $D_x < 0$.

Precomputing $\vec{D}^{-1}$ once per ray avoids division inside the inner loop. IEEE floating-point infinities from dividing by zero propagate correctly through min/max.

## Bounding Volume Hierarchy (BVH)

A **BVH** is a tree of bounding volumes. Each internal node stores an AABB that encloses all geometry in its subtree. Leaf nodes store references to a small set of primitives (typically 1--8 triangles). The BVH is the dominant acceleration structure in modern ray tracing — used by OptiX, Embree, DXR, Vulkan Ray Tracing, and all hardware RT core implementations.

### Top-Down Construction

The most common BVH construction approach is **top-down recursive partitioning**:

1. Start with all primitives in a single node
2. Compute the AABB of the node
3. Choose a split: select an axis and a position along that axis to partition the primitives into two groups
4. Create two child nodes, one for each group
5. Recurse until a node contains fewer than some threshold of primitives (make it a leaf)

The quality of the BVH depends critically on **how you choose the split**. A poor split creates nodes with large, overlapping AABBs, forcing rays to traverse both children. A good split minimizes overlap and balances the tree.

### Split Strategies

| Strategy | Description | Quality | Speed |
|---|---|---|---|
| Midpoint | Split at the spatial midpoint of the node's AABB | Low | Fast |
| Median | Split so each child has half the primitives | Medium | Fast |
| SAH | Minimize the Surface Area Heuristic cost | High | Slower |

## Surface Area Heuristic (SAH)

The **Surface Area Heuristic** (Goldsmith & Salmon, 1987; MacDonald & Booth, 1990) is the gold standard for BVH split decisions. It models the expected cost of traversing a node based on the probability that a random ray hits its children.

### The Cost Model

The probability that a ray intersecting a parent node with surface area $SA(P)$ also intersects a child node with surface area $SA(C)$ is approximately:

$$P(\text{hit child} \mid \text{hit parent}) \approx \frac{SA(C)}{SA(P)}$$

This assumes rays are uniformly distributed (a reasonable approximation for most scenes). The expected cost of a split into left ($L$) and right ($R$) groups is:

$$C_{\text{split}} = C_{\text{trav}} + \frac{SA(L)}{SA(P)} \cdot N_L \cdot C_{\text{isect}} + \frac{SA(R)}{SA(P)} \cdot N_R \cdot C_{\text{isect}}$$

where:
- $C_{\text{trav}}$ is the cost of traversing one internal node (AABB test + branch)
- $C_{\text{isect}}$ is the cost of one ray-primitive intersection test
- $N_L$, $N_R$ are the number of primitives in each child
- $SA(L)$, $SA(R)$ are the surface areas of the child AABBs

The optimal split **minimizes** this cost. Compare it against the cost of making the node a leaf:

$$C_{\text{leaf}} = N \cdot C_{\text{isect}}$$

If the best split cost exceeds the leaf cost, do not split.

### Binned SAH

Evaluating SAH for every possible split (every primitive boundary, every axis) is $O(n \log n)$ per node. The **binned SAH** approximation (Wald, 2007) reduces this to $O(n)$:

1. Choose an axis (try all three, pick the best)
2. Divide the node's AABB along that axis into $K$ equal bins (typically $K = 12\text{--}32$)
3. Assign each primitive to a bin based on its centroid
4. For each of the $K - 1$ candidate split planes, compute the left and right AABBs and primitive counts by accumulating bin data from both ends
5. Evaluate the SAH cost for each candidate and pick the minimum

```python
def find_best_split_sah(primitives, node_aabb, num_bins=16):
    best_cost = float('inf')
    best_axis = -1
    best_split = -1
    node_sa = surface_area(node_aabb)

    for axis in range(3):
        # Bin primitives by centroid along this axis
        bins = [{'count': 0, 'aabb': AABB.empty()} for _ in range(num_bins)]
        axis_min = node_aabb.bmin[axis]
        axis_max = node_aabb.bmax[axis]
        axis_range = axis_max - axis_min
        if axis_range < 1e-8:
            continue

        for prim in primitives:
            centroid = prim.centroid()[axis]
            bin_idx = min(int(num_bins * (centroid - axis_min) / axis_range),
                         num_bins - 1)
            bins[bin_idx]['count'] += 1
            bins[bin_idx]['aabb'] = bins[bin_idx]['aabb'].merge(prim.aabb())

        # Sweep from left and right to evaluate SAH at each split
        left_count = [0] * (num_bins - 1)
        left_aabb = [None] * (num_bins - 1)
        right_count = [0] * (num_bins - 1)
        right_aabb = [None] * (num_bins - 1)

        # Left sweep
        running_aabb = AABB.empty()
        running_count = 0
        for i in range(num_bins - 1):
            running_count += bins[i]['count']
            running_aabb = running_aabb.merge(bins[i]['aabb'])
            left_count[i] = running_count
            left_aabb[i] = running_aabb

        # Right sweep
        running_aabb = AABB.empty()
        running_count = 0
        for i in range(num_bins - 1, 0, -1):
            running_count += bins[i]['count']
            running_aabb = running_aabb.merge(bins[i]['aabb'])
            right_count[i - 1] = running_count
            right_aabb[i - 1] = running_aabb

        # Evaluate SAH for each split
        for i in range(num_bins - 1):
            if left_count[i] == 0 or right_count[i] == 0:
                continue
            cost = (C_TRAV +
                    surface_area(left_aabb[i]) / node_sa * left_count[i] * C_ISECT +
                    surface_area(right_aabb[i]) / node_sa * right_count[i] * C_ISECT)
            if cost < best_cost:
                best_cost = cost
                best_axis = axis
                best_split = i

    return best_axis, best_split, best_cost
```

## BVH Traversal

Traversal is the performance-critical operation — it runs once per ray and determines which leaf nodes (and therefore which primitives) need to be tested.

### Recursive Traversal

```python
def traverse_bvh(node, ray, t_min, t_max):
    """Returns the closest hit (t, primitive) or None."""
    if not ray_intersects_aabb(ray, node.aabb, t_min, t_max):
        return None

    if node.is_leaf():
        closest = None
        for prim in node.primitives:
            hit = ray_intersect_primitive(ray, prim)
            if hit and hit.t < t_max:
                t_max = hit.t
                closest = hit
        return closest

    # Traverse children — nearest first for early termination
    hit_left = traverse_bvh(node.left, ray, t_min, t_max)
    if hit_left:
        t_max = hit_left.t
    hit_right = traverse_bvh(node.right, ray, t_min, t_max)

    if hit_right:
        return hit_right
    return hit_left
```

### Iterative Traversal with a Stack

Production ray tracers use an iterative traversal with an explicit stack to avoid recursion overhead:

```python
def traverse_bvh_iterative(root, ray, t_max):
    """Stack-based iterative BVH traversal."""
    stack = [root]
    closest_hit = None

    while stack:
        node = stack.pop()

        if not ray_intersects_aabb(ray, node.aabb, 0.0, t_max):
            continue

        if node.is_leaf():
            for prim in node.primitives:
                hit = ray_intersect_primitive(ray, prim)
                if hit and hit.t < t_max:
                    t_max = hit.t
                    closest_hit = hit
        else:
            # Push far child first so near child is popped first
            t_left = ray_aabb_distance(ray, node.left.aabb)
            t_right = ray_aabb_distance(ray, node.right.aabb)
            if t_left < t_right:
                stack.append(node.right)
                stack.append(node.left)
            else:
                stack.append(node.left)
                stack.append(node.right)

    return closest_hit
```

The key optimization is **front-to-back ordering**: by traversing the nearer child first, we find hits sooner, which tightens $t_{\max}$ and lets us skip more of the far child's subtree. This "short-stack" approach maps well to GPU architectures.

### Traversal Cost Analysis

For a well-built BVH with $n$ primitives:
- **Tree depth:** $O(\log n)$
- **Nodes visited per ray (average):** $O(\log n)$ for primary rays, can be higher for incoherent secondary rays
- **Primitive tests per ray (average):** Typically 10--100, depending on scene complexity
- **Total cost:** $O(\log n)$ AABB tests + $O(1)$ primitive tests per ray (amortized)

## Linear BVH (LBVH) for GPU Construction

Top-down SAH construction is inherently serial (each split depends on the previous level). For dynamic scenes that need per-frame BVH rebuilds, we need a fully parallel algorithm. **LBVH** (Lauterbach et al., 2009; Karras, 2012) achieves this by linearizing the spatial order using **Morton codes**.

### Morton Codes and Z-Order Curves

A **Morton code** (also called a Z-order code) interleaves the bits of a point's quantized $x$, $y$, $z$ coordinates into a single integer. Points that are close in 3D space tend to have similar Morton codes, creating a space-filling curve that preserves spatial locality.

For a 3D point normalized to $[0, 1]^3$ and quantized to 10 bits per axis:

$$\text{morton}(x, y, z) = \text{interleave}(x_{10\text{bits}}, y_{10\text{bits}}, z_{10\text{bits}})$$

producing a 30-bit code. The bit pattern is: $x_9 y_9 z_9 x_8 y_8 z_8 \ldots x_0 y_0 z_0$.

```glsl
// Expand a 10-bit integer into 30 bits by inserting 2 zeros between each bit
uint expandBits(uint v) {
    v = (v * 0x00010001u) & 0xFF0000FFu;
    v = (v * 0x00000101u) & 0x0F00F00Fu;
    v = (v * 0x00000011u) & 0xC30C30C3u;
    v = (v * 0x00000005u) & 0x49249249u;
    return v;
}

// Compute 30-bit Morton code for a 3D point in [0, 1]^3
uint mortonCode(vec3 p) {
    p = clamp(p, 0.0, 1.0);
    uint x = uint(p.x * 1023.0);
    uint y = uint(p.y * 1023.0);
    uint z = uint(p.z * 1023.0);
    return expandBits(x) * 4 + expandBits(y) * 2 + expandBits(z);
}
```

### Karras (2012) LBVH Construction

Karras's algorithm builds a complete binary BVH from sorted Morton codes in a fully parallel manner. The key insight is that the **hierarchy structure is implicit** in the sorted Morton codes — shared prefixes define subtree boundaries.

**Algorithm overview:**

1. **Compute Morton codes** for each primitive centroid (parallel, $O(n)$)
2. **Sort** primitives by Morton code (parallel radix sort, $O(n)$)
3. **Build internal nodes** — for $n$ leaves, there are exactly $n - 1$ internal nodes. Each internal node $i$ covers a contiguous range of sorted leaves. Karras showed that the split position and range of each internal node can be determined in $O(1)$ by examining the highest differing bit between adjacent Morton codes (parallel, $O(n)$)
4. **Compute AABBs** bottom-up using atomic counters to detect when both children of a node are ready (parallel, $O(n)$)

The entire construction is $O(n \log n)$ dominated by the sort, with all other stages being $O(n)$ and fully parallelizable on the GPU.

### LBVH vs. SAH Quality

LBVH produces lower-quality BVHs than SAH because the Morton code ordering does not consider primitive sizes or overlap. The typical trade-off:

| Method | Build Time | BVH Quality (traversal speed) |
|---|---|---|
| SAH (binned) | Slow ($O(n \log n)$, serial) | Best |
| LBVH (Karras) | Fast ($O(n \log n)$, fully parallel) | Good (~20--30% slower traversal) |
| HLBVH (Pantaleoni & Luebke, 2010) | Medium | Very Good |

**HLBVH** (Hierarchical LBVH) is a hybrid: use Morton codes for the upper levels (coarse spatial sort), then apply SAH at the leaf level for local quality. Karras and Aila (2013) further improved this with "Fast Parallel Construction of High-Quality BVHs" by applying treelet restructuring after LBVH construction.

## Octrees

An **octree** recursively subdivides 3D space into eight equal octants. Each node is a cube that can be split into 8 children by cutting along all three axis-aligned midplanes.

### Construction

```python
class OctreeNode:
    def __init__(self, center, half_size, depth=0, max_depth=8, max_prims=8):
        self.center = center
        self.half_size = half_size
        self.children = [None] * 8
        self.primitives = []
        self.is_leaf = True

    def insert(self, prim, depth=0, max_depth=8, max_prims=8):
        if self.is_leaf:
            self.primitives.append(prim)
            if len(self.primitives) > max_prims and depth < max_depth:
                self.subdivide(depth, max_depth, max_prims)
        else:
            octant = self.get_octant(prim.centroid())
            self.children[octant].insert(prim, depth + 1, max_depth, max_prims)

    def subdivide(self, depth, max_depth, max_prims):
        self.is_leaf = False
        hs = self.half_size / 2.0
        for i in range(8):
            offset = [
                hs if (i & 1) else -hs,
                hs if (i & 2) else -hs,
                hs if (i & 4) else -hs
            ]
            child_center = [self.center[j] + offset[j] for j in range(3)]
            self.children[i] = OctreeNode(child_center, hs)
        # Re-insert primitives into children
        for prim in self.primitives:
            octant = self.get_octant(prim.centroid())
            self.children[octant].insert(prim, depth + 1, max_depth, max_prims)
        self.primitives = []
```

### When to Use Octrees

- **Spatial queries:** Nearest-neighbor search, range queries, frustum culling
- **Voxel data:** Sparse voxel octrees (SVOs) for volumetric data, as used in Nvidia's GVDB and UE5's Lumen
- **Uniform density scenes:** Octrees work best when geometry is roughly uniformly distributed
- **Not ideal for ray tracing:** The fixed spatial subdivision can create many empty nodes and does not adapt to geometry density the way BVH does

## kd-Trees

A **kd-tree** (k-dimensional tree) recursively partitions space along one axis at a time. Unlike an octree (which always splits along all three axes into eight children), a kd-tree makes a single axis-aligned split per node, producing exactly two children.

### Construction

At each node:
1. Choose an axis (often cycling $x \to y \to z$, or chosen by SAH)
2. Choose a split position along that axis
3. Partition primitives into left (below split) and right (above split)
4. Recurse

### kd-Tree vs. BVH

| Property | kd-Tree | BVH |
|---|---|---|
| Subdivision | Spatial (splits space) | Object (groups primitives) |
| Primitive duplication | Yes — primitives spanning the split plane appear in both children | No — each primitive is in exactly one leaf |
| Traversal | Ordered by $t$-value (no need to sort children) | Must choose near/far child |
| Build cost | Higher (due to duplication handling) | Lower |
| Dynamic scenes | Expensive to rebuild | Refit AABBs in $O(n)$ for small motion |
| Modern preference | Declining | Dominant |

kd-trees were historically preferred for offline ray tracing (Wald, 2004) because their ordered traversal avoids redundant intersection tests. However, BVHs have won out in practice due to simpler construction, no primitive duplication, efficient GPU mapping, and hardware support (RT cores use BVH).

### When to Use kd-Trees

- **Point cloud queries:** kd-trees remain the standard for nearest-neighbor search in point clouds (e.g., photon mapping, ICP registration)
- **Low-dimensional spatial indexing:** Effective for 2D/3D spatial databases
- **Static scenes** where construction cost is amortized over many queries

## Hardware Acceleration: RT Cores

### How RT Cores Work

Starting with Nvidia's Turing architecture (2018, RTX 2000 series), dedicated **RT cores** accelerate BVH traversal and ray-triangle intersection in fixed-function hardware. The RT core is a co-processor that sits alongside the shader cores (SMs):

1. The shader issues a ray trace call (`TraceRay()` in DXR / `traceRayEXT()` in Vulkan)
2. The RT core takes over, performing BVH node traversal (AABB tests) and ray-triangle intersection
3. When traversal finds candidate hits or completes, control returns to the shader for shading

This offloads the two most expensive operations (AABB testing and triangle intersection) from the general-purpose shader cores, leaving them free for shading, denoising, and other work.

### Evolution of RT Hardware

| Generation | Architecture | Key Feature |
|---|---|---|
| 1st Gen | Turing (2018) | Basic BVH traversal + ray-tri intersection |
| 2nd Gen | Ampere (2020) | Concurrent traversal + shading; triangle position interpolation |
| 3rd Gen | Ada Lovelace (2022) | Opacity Micro-Map (OMM), Displaced Micro-Mesh Engine (DMM) |
| 4th Gen | Blackwell (2025) | Improved ray coherency handling; 70--90% path tracing gains over Ada |

AMD and Intel also ship hardware ray tracing units (RDNA 2+, Arc Alchemist+), but Nvidia's RT cores remain the most mature. AMD's approach uses a shader-based BVH traversal with hardware-accelerated intersection testing.

### BVH Construction and RT Cores

An important detail: **RT cores only accelerate traversal, not construction.** BVH construction still runs on the shader cores (or CPU). The API (OptiX, DXR, Vulkan RT) manages the BVH build:

- **Bottom-Level Acceleration Structure (BLAS):** Per-object BVH over triangles
- **Top-Level Acceleration Structure (TLAS):** BVH over BLAS instances (position, transform, material binding)

This two-level scheme allows object instancing (many copies of the same mesh with different transforms) and efficient updates for dynamic scenes (rebuild TLAS per frame, refit BLAS when meshes deform).

### Beyond Ray Tracing: Generalizing RT Cores

Recent research (Barnes et al., MICRO 2024; Ha et al., MICRO 2024) explores extending RT core hardware to accelerate general hierarchical search problems beyond ray tracing — nearest-neighbor queries, database indexing, and graph analytics. The insight is that BVH traversal is fundamentally a tree-search operation, and the fixed-function hardware can be generalized to accelerate any workload that maps to hierarchical space partitioning. Nvidia has begun exposing linear BVH construction via OptiX/CUDA for non-graphics workloads.

## Choosing the Right Structure

| Use Case | Best Structure | Reason |
|---|---|---|
| Ray tracing (GPU) | BVH (SAH or LBVH) | Hardware RT core support, efficient traversal |
| Ray tracing (CPU) | BVH (SAH) | Best quality, cache-friendly with node layout optimization |
| Dynamic scenes | BVH (LBVH rebuild or refit) | $O(n)$ refit for small motions, $O(n \log n)$ parallel rebuild |
| Point cloud NN search | kd-tree | Optimal for point queries, proven algorithms |
| Frustum/range culling | Octree or BVH | Spatial subdivision for hierarchical rejection |
| Sparse voxel data | Sparse Voxel Octree (SVO) | Natural representation of occupancy |
| Uniform grids / particles | Uniform grid or hash grid | $O(1)$ cell lookup for spatially uniform data |

## Exercises

<details>
<summary>Exercise: SAH Cost Evaluation</summary>

<p>A BVH node has surface area $SA(P) = 100$ and contains 20 primitives. You evaluate a split that puts 8 primitives in the left child ($SA(L) = 40$) and 12 in the right child ($SA(R) = 70$). Assume $C_{\text{trav}} = 1$ and $C_{\text{isect}} = 2$. What is the SAH cost of this split? Should you split or make this a leaf?</p>

<p><strong>Solution:</strong></p>

<p>$C_{\text{split}} = C_{\text{trav}} + \frac{SA(L)}{SA(P)} \cdot N_L \cdot C_{\text{isect}} + \frac{SA(R)}{SA(P)} \cdot N_R \cdot C_{\text{isect}}$</p>

<p>$= 1 + \frac{40}{100} \cdot 8 \cdot 2 + \frac{70}{100} \cdot 12 \cdot 2 = 1 + 6.4 + 16.8 = 24.2$</p>

<p>Leaf cost: $C_{\text{leaf}} = N \cdot C_{\text{isect}} = 20 \cdot 2 = 40$</p>

<p>Since $24.2 < 40$, the split is beneficial. Note that the right child has high cost ($16.8$) because its AABB is large ($SA = 70$ out of $100$) despite having only $60\%$ of the primitives. A better split might achieve a smaller right AABB.</p>
</details>

<details>
<summary>Exercise: Morton Code Computation</summary>

<p>A point has normalized coordinates $(0.5, 0.25, 0.75)$ in a unit cube. Quantize each coordinate to 3 bits (range $[0, 7]$) and compute the 9-bit Morton code by interleaving $x$, $y$, $z$ bits.</p>

<p><strong>Solution:</strong></p>

<p>Quantize: $x = \lfloor 0.5 \times 7 \rfloor = 3 = 011_2$, $y = \lfloor 0.25 \times 7 \rfloor = 1 = 001_2$, $z = \lfloor 0.75 \times 7 \rfloor = 5 = 101_2$.</p>

<p>Interleave bits as $x_2 y_2 z_2\; x_1 y_1 z_1\; x_0 y_0 z_0$:</p>

<p>$x = 0, 1, 1$; $y = 0, 0, 1$; $z = 1, 0, 1$</p>

<p>$\text{morton} = 001\; 100\; 111 = 001100111_2 = 103_{10}$</p>

<p>This code places the point in a specific cell of the Z-order curve. Points nearby in 3D will tend to have nearby Morton codes, which is why sorting by Morton code produces a spatially coherent ordering suitable for LBVH construction.</p>
</details>

<details>
<summary>Exercise: BVH Traversal Order</summary>

<p>A ray with origin $(0, 0, -10)$ and direction $(0, 0, 1)$ reaches a BVH node with two children. The left child's AABB spans $z \in [-5, -1]$ and the right child's spans $z \in [2, 8]$. Which child should be traversed first, and why?</p>

<p><strong>Solution:</strong></p>

<p>The ray enters the left child at $t_{\text{enter}} = (-5 - (-10)) / 1 = 5$ and the right child at $t_{\text{enter}} = (2 - (-10)) / 1 = 12$. The left child is closer ($t = 5 < 12$), so traverse it first.</p>

<p>By visiting the nearer child first, any hit found there (say at $t = 6$) becomes the new $t_{\max}$. When we then test the right child's AABB, its entry at $t = 12 > 6$, so we can skip the entire right subtree. This front-to-back ordering is what makes BVH traversal efficient — early hits prune large portions of the tree.</p>
</details>

## Key Takeaways

- Without acceleration structures, ray tracing is $O(n)$ per ray — impractical for scenes with more than a few thousand primitives
- AABBs are the fundamental bounding volume: cheap to construct, fast to intersect, easy to merge
- BVH is the dominant acceleration structure, used by all modern ray tracing APIs and hardware RT cores
- The Surface Area Heuristic (SAH) optimizes splits by minimizing expected traversal cost based on the ratio of child-to-parent surface areas
- Binned SAH evaluates a fixed number of candidate splits per axis, reducing per-node build cost to $O(n)$
- Front-to-back traversal order is critical: hitting closer geometry first tightens $t_{\max}$ and enables early pruning of distant subtrees
- LBVH (Karras, 2012) enables fully parallel GPU BVH construction using Morton codes and sorted primitive ordering, at the cost of ~20--30% lower traversal quality versus SAH
- Octrees subdivide space uniformly into 8 children and excel at spatial queries and sparse voxel data, but adapt poorly to non-uniform geometry
- kd-trees split space along one axis per node and remain standard for point cloud nearest-neighbor search, but have lost ground to BVH for ray tracing
- RT cores (Nvidia Turing through Blackwell, AMD RDNA 2+, Intel Arc) accelerate BVH traversal and ray-triangle intersection in fixed-function hardware, with 4th-gen cores achieving 70--90% path tracing improvements
- The two-level BVH (BLAS + TLAS) scheme enables efficient instancing and per-frame dynamic scene updates
