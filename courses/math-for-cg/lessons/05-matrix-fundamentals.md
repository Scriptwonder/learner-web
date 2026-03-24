# Matrix Fundamentals

Every transform in computer graphics — rotation, scaling, translation, projection — is encoded as a **matrix**. Understanding matrices is the single most important math skill for graphics programming. When your vertex shader runs `gl_Position = MVP * position`, it multiplies through three matrices in one operation. This lesson builds that foundation.

## What Is a Matrix?

A matrix is a rectangular array of numbers arranged in **rows** and **columns**. We describe its size as $m \times n$ — $m$ rows, $n$ columns.

A $2 \times 3$ matrix (2 rows, 3 columns):

$$A = \begin{pmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{pmatrix}$$

We refer to individual elements as $A_{ij}$, where $i$ is the row and $j$ is the column (both starting at 1 in math notation, 0 in code). So $A_{12} = 2$ and $A_{23} = 6$.

In CG, the matrices you will use most often are:
- $2 \times 2$ — 2D rotation and scale
- $3 \times 3$ — 2D transforms with translation (homogeneous), 3D rotation
- $4 \times 4$ — the workhorse: full 3D transforms including translation and projection

## Matrix Addition and Scalar Multiplication

These are straightforward — element-wise operations:

$$A + B = \begin{pmatrix} a_{11}+b_{11} & a_{12}+b_{12} \\ a_{21}+b_{21} & a_{22}+b_{22} \end{pmatrix}$$

Scalar multiplication scales every element:

$$kA = \begin{pmatrix} ka_{11} & ka_{12} \\ ka_{21} & ka_{22} \end{pmatrix}$$

These are rarely the focus in CG — matrix **multiplication** is where the real power lies.

## Matrix Multiplication

Matrix multiplication is the core operation. To multiply $A$ (size $m \times n$) by $B$ (size $n \times p$), the number of **columns in A** must equal the number of **rows in B**. The result is an $m \times p$ matrix.

Each element of the result is a **dot product** of a row from $A$ and a column from $B$:

$$(AB)_{ij} = \sum_{k=1}^{n} A_{ik} \cdot B_{kj}$$

### Worked Example: 2x2

$$\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix} \begin{pmatrix} 5 & 6 \\ 7 & 8 \end{pmatrix} = \begin{pmatrix} 1 \cdot 5 + 2 \cdot 7 & 1 \cdot 6 + 2 \cdot 8 \\ 3 \cdot 5 + 4 \cdot 7 & 3 \cdot 6 + 4 \cdot 8 \end{pmatrix} = \begin{pmatrix} 19 & 22 \\ 43 & 50 \end{pmatrix}$$

Step by step for element $(1,1)$: row 1 of $A$ is $(1, 2)$, column 1 of $B$ is $(5, 7)$. Dot product: $1 \cdot 5 + 2 \cdot 7 = 19$.

### Worked Example: 3x3

$$\begin{pmatrix} 1 & 0 & 2 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{pmatrix} \begin{pmatrix} 3 \\ 4 \\ 1 \end{pmatrix} = \begin{pmatrix} 1 \cdot 3 + 0 \cdot 4 + 2 \cdot 1 \\ 0 \cdot 3 + 1 \cdot 4 + 0 \cdot 1 \\ 0 \cdot 3 + 0 \cdot 4 + 1 \cdot 1 \end{pmatrix} = \begin{pmatrix} 5 \\ 4 \\ 1 \end{pmatrix}$$

Notice: this $3 \times 3$ matrix multiplied by a $3 \times 1$ column vector gives a $3 \times 1$ result. This is exactly how transforms work — a matrix times a vector produces a transformed vector.

## Multiplication Is NOT Commutative

This is critical in CG:

$$AB \neq BA \quad \text{(in general)}$$

The order you multiply matrices changes the result. This directly maps to CG: rotating then translating is not the same as translating then rotating. We will explore this deeply in the 2D and 3D transform lessons.

Multiplication **is** associative, though:

$$(AB)C = A(BC)$$

This means you can pre-combine matrices: multiply $P \cdot V \cdot M$ once on the CPU, then send a single MVP matrix to the GPU.

## Special Matrices

### Identity Matrix $I$

The identity matrix is the "do nothing" transform. It has 1s on the diagonal and 0s everywhere else:

$$I_3 = \begin{pmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{pmatrix}$$

For any matrix $A$: $AI = IA = A$.

In CG, you start with an identity matrix and multiply transforms onto it. In GLM:

```cpp
glm::mat4 model = glm::mat4(1.0f); // identity
model = glm::rotate(model, angle, axis);
model = glm::translate(model, offset);
```

### Transpose $A^T$

The transpose flips a matrix over its diagonal — rows become columns:

$$A = \begin{pmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{pmatrix} \quad \Rightarrow \quad A^T = \begin{pmatrix} 1 & 4 \\ 2 & 5 \\ 3 & 6 \end{pmatrix}$$

Useful properties:
- $(AB)^T = B^T A^T$ (note the order reversal)
- Rotation matrices are **orthogonal**: $R^T = R^{-1}$, meaning the transpose IS the inverse. This is computationally cheap.

### Inverse $A^{-1}$

The inverse undoes a transform: $A A^{-1} = I$.

Not all matrices have inverses. A matrix with an inverse is called **invertible** or **non-singular**. The determinant tells you: if $\det(A) = 0$, there is no inverse.

In CG, you need the inverse for:
- Computing the **view matrix** (inverse of camera's model matrix)
- Transforming **normals** correctly (requires $(M^{-1})^T$, the inverse-transpose)
- Undoing transforms

```cpp
glm::mat4 view = glm::inverse(cameraModel);
glm::mat3 normalMatrix = glm::transpose(glm::inverse(glm::mat3(model)));
```

## Column-Major vs Row-Major

The same matrix math applies everywhere, but how the 16 floats of a 4x4 matrix are stored in memory differs between APIs:

**Column-major** (OpenGL, GLSL, GLM): elements are stored column by column.

$$M = \begin{pmatrix} m_0 & m_4 & m_8 & m_{12} \\ m_1 & m_5 & m_9 & m_{13} \\ m_2 & m_6 & m_{10} & m_{14} \\ m_3 & m_7 & m_{11} & m_{15} \end{pmatrix}$$

Memory layout: `[m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15]`

**Row-major** (DirectX, HLSL): elements stored row by row.

In column-major (OpenGL), a vector is a **column** and you multiply $M \cdot \vec{v}$ (matrix on the left). In row-major (DirectX), a vector is a **row** and you multiply $\vec{v} \cdot M$ (matrix on the right). The underlying math is identical — it is a storage and convention difference.

In GLSL, this means transforms compose **right to left**:

```glsl
gl_Position = projection * view * model * vec4(position, 1.0);
//            ^^^^^^^^^^   ^^^^   ^^^^^
//            applied 3rd  2nd    1st (closest to the vertex)
```

## GLSL Matrix Types

GLSL provides built-in matrix types:

```glsl
mat2 m2;  // 2x2
mat3 m3;  // 3x3 — used for normals, 2D transforms
mat4 m4;  // 4x4 — the standard transform matrix

// Construction
mat4 identity = mat4(1.0);  // identity matrix

// Access columns (column-major!)
vec4 col0 = m4[0];       // first column
float elem = m4[1][2];   // column 1, row 2

// Matrix-vector multiplication
vec4 transformed = m4 * vec4(pos, 1.0);

// Matrix-matrix multiplication
mat4 mvp = projection * view * model;
```

Key point: `mat4[i]` accesses **column** $i$, not row $i$. This trips up newcomers from row-major backgrounds.

## Why Matrices Matter in CG

Without matrices, you would need separate code paths for every kind of transform — one function for rotation, another for scaling, another for translation. Matrices unify all of these:

1. **Any linear transform** (rotation, scale, shear, reflection) can be expressed as a single matrix.
2. **Composition**: multiply matrices together to combine transforms into one.
3. **Hardware acceleration**: GPUs are designed to multiply 4x4 matrices at extreme speed.
4. **Uniformity**: the same `mat4 * vec4` operation handles model transforms, camera transforms, and projection — no special cases.

The entire rendering pipeline, from local vertex positions to screen pixels, is a chain of matrix multiplications. You will see this in Lesson 09 when we cover the full transform pipeline.

<details>
<summary>Exercise: Multiply two 2x2 matrices</summary>

<p>Compute $AB$ where:</p>

<p>$A = \begin{pmatrix} 2 & 1 \\ 0 & 3 \end{pmatrix}$, $B = \begin{pmatrix} 4 & 0 \\ 1 & 5 \end{pmatrix}$</p>

<p>$(AB)_{11} = 2 \cdot 4 + 1 \cdot 1 = 9$</p>
<p>$(AB)_{12} = 2 \cdot 0 + 1 \cdot 5 = 5$</p>
<p>$(AB)_{21} = 0 \cdot 4 + 3 \cdot 1 = 3$</p>
<p>$(AB)_{22} = 0 \cdot 0 + 3 \cdot 5 = 15$</p>

<p>$AB = \begin{pmatrix} 9 & 5 \\ 3 & 15 \end{pmatrix}$</p>

<p>Now verify that $BA \neq AB$:</p>
<p>$BA = \begin{pmatrix} 4 \cdot 2 + 0 \cdot 0 & 4 \cdot 1 + 0 \cdot 3 \\ 1 \cdot 2 + 5 \cdot 0 & 1 \cdot 1 + 5 \cdot 3 \end{pmatrix} = \begin{pmatrix} 8 & 4 \\ 2 & 16 \end{pmatrix}$</p>

<p>Confirmed: $AB \neq BA$.</p>
</details>

<details>
<summary>Exercise: Find the transpose</summary>

<p>Given $M = \begin{pmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \\ 7 & 8 & 9 \end{pmatrix}$, find $M^T$.</p>

<p>Swap rows and columns:</p>

<p>$M^T = \begin{pmatrix} 1 & 4 & 7 \\ 2 & 5 & 8 \\ 3 & 6 & 9 \end{pmatrix}$</p>

<p>Notice: the diagonal $(1, 5, 9)$ stays the same. Elements reflect across it.</p>
</details>

<details>
<summary>Exercise: Matrix-vector multiplication</summary>

<p>Multiply the matrix $M$ by vector $\vec{v}$:</p>

<p>$M = \begin{pmatrix} 1 & 0 & 2 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{pmatrix}$, $\vec{v} = \begin{pmatrix} 3 \\ 7 \\ 1 \end{pmatrix}$</p>

<p>$M\vec{v} = \begin{pmatrix} 1 \cdot 3 + 0 \cdot 7 + 2 \cdot 1 \\ 0 \cdot 3 + 1 \cdot 7 + 0 \cdot 1 \\ 0 \cdot 3 + 0 \cdot 7 + 1 \cdot 1 \end{pmatrix} = \begin{pmatrix} 5 \\ 7 \\ 1 \end{pmatrix}$</p>

<p>This matrix shifted the x-coordinate by $2 \times$ the third component — it is a 2D translation matrix in homogeneous coordinates.</p>
</details>

## Key Takeaways

- A matrix is a grid of numbers; in CG we use $4 \times 4$ matrices to encode transforms
- Matrix multiplication $(AB)_{ij} = \sum_k A_{ik} B_{kj}$ — combine row from $A$ with column from $B$
- Multiplication is **not commutative** ($AB \neq BA$) — order matters for transforms
- The identity matrix $I$ does nothing; the inverse $A^{-1}$ undoes a transform; the transpose $A^T$ flips rows and columns
- OpenGL/GLSL is column-major: transforms compose right-to-left, `mat4[i]` gives column $i$
- Matrices let you encode any linear transform as a single multiply — the GPU's favorite operation
