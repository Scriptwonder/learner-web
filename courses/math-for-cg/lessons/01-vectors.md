# Vectors

A **vector** is a quantity with both magnitude and direction. In computer graphics, vectors are everywhere — positions, directions, normals, velocities, colors.

## Definition

A vector in 3D space is an ordered triple:

$$\vec{v} = (v_x, v_y, v_z)$$

## Magnitude

The length (magnitude) of a vector:

$$|\vec{v}| = \sqrt{v_x^2 + v_y^2 + v_z^2}$$

## Normalization

A **unit vector** has magnitude 1. To normalize:

$$\hat{v} = \frac{\vec{v}}{|\vec{v}|}$$

## In GLSL

```glsl
vec3 direction = normalize(targetPos - currentPos);
float distance = length(targetPos - currentPos);
```

## Try It

<details>
<summary>Exercise: Normalize the vector (3, 4, 0)</summary>

<p>Magnitude: $\sqrt{9 + 16 + 0} = \sqrt{25} = 5$</p>

<p>Normalized: $(\frac{3}{5}, \frac{4}{5}, 0) = (0.6, 0.8, 0)$</p>
</details>

## Key Takeaways

- Vectors represent direction + magnitude
- Normalize to get a unit vector (magnitude = 1)
- `normalize()` and `length()` are your most-used GLSL functions
