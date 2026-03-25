/**
 * shader-renderer.js
 * WebGL2 rendering engine: compiles GLSL shaders, renders to canvas,
 * and computes perceptual pixel-match scores via CIELAB deltaE.
 *
 * Loaded via <script> tag (IIFE, not an ES module).
 * Exposes: window.ShaderRenderer = ShaderRendererInstance
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Geometry data
  // ---------------------------------------------------------------------------

  /** Fullscreen quad — 4 vertices for TRIANGLE_STRIP */
  const QUAD_VERTS = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1,
  ]);

  /**
   * Generate a UV-sphere with `rings` latitude bands and `sectors` longitude
   * slices.  Returns { vertices: Float32Array, indices: Uint16Array }.
   * Each vertex is [x, y, z, u, v] (5 floats).
   */
  function generateSphere(rings, sectors) {
    rings   = rings   || 32;
    sectors = sectors || 32;

    const verts   = [];
    const indices = [];

    const PI  = Math.PI;
    const TAU = 2 * PI;

    for (let r = 0; r <= rings; r++) {
      const phi   = (PI * r) / rings;          // 0 … π
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let s = 0; s <= sectors; s++) {
        const theta    = (TAU * s) / sectors;  // 0 … 2π
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const x = cosTheta * sinPhi;
        const y = cosPhi;
        const z = sinTheta * sinPhi;
        const u = s / sectors;
        const v = r / rings;

        verts.push(x, y, z, u, v);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < sectors; s++) {
        const cur  = r * (sectors + 1) + s;
        const next = cur + (sectors + 1);
        // Two triangles per quad
        indices.push(cur,     next,     cur + 1);
        indices.push(cur + 1, next,     next + 1);
      }
    }

    return {
      vertices: new Float32Array(verts),
      indices:  new Uint16Array(indices),
    };
  }

  /** Lazy-cached sphere geometry (32×32) */
  const SPHERE = (function () {
    let cache = null;
    return {
      get: function () {
        if (!cache) cache = generateSphere(32, 32);
        return cache;
      },
    };
  })();

  // ---------------------------------------------------------------------------
  // Default vertex shaders
  // ---------------------------------------------------------------------------

  const VS_QUAD = `#version 300 es
in  vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv        = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

  const VS_SPHERE = `#version 300 es
in  vec3 a_position;
in  vec2 a_uv;
out vec3 v_normal;
out vec3 v_position;
out vec2 v_uv;
out vec3 v_worldPos;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform mat4 u_normalMatrix;

void main() {
  vec4 worldPos   = u_model * vec4(a_position, 1.0);
  v_worldPos      = worldPos.xyz;
  v_position      = worldPos.xyz;
  v_normal        = normalize((u_normalMatrix * vec4(a_position, 0.0)).xyz);
  v_uv            = a_uv;
  gl_Position     = u_projection * u_view * worldPos;
}`;

  // ---------------------------------------------------------------------------
  // sRGB → CIELAB conversion (for perceptual deltaE comparison)
  // ---------------------------------------------------------------------------

  function srgbToLab(r, g, b) {
    // sRGB [0,1] → linear
    function toLinear(c) {
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    const rl = toLinear(r);
    const gl = toLinear(g);
    const bl = toLinear(b);

    // Linear RGB → XYZ (D65)
    const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
    const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
    const Z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

    // Normalise by D65 white point
    const xn = X / 0.95047;
    const yn = Y / 1.00000;
    const zn = Z / 1.08883;

    function f(t) {
      return t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;
    }
    const fx = f(xn);
    const fy = f(yn);
    const fz = f(zn);

    const L  = 116 * fy - 16;
    const a_ = 500 * (fx - fy);
    const b_ = 200 * (fy - fz);

    return [L, a_, b_];
  }

  // ---------------------------------------------------------------------------
  // Checkerboard texture (64×64, two-colour procedural)
  // ---------------------------------------------------------------------------

  function createCheckerTexture(gl) {
    const SIZE = 64;
    const data = new Uint8Array(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const even = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
        const idx  = (y * SIZE + x) * 4;
        const val  = even ? 200 : 55;
        data[idx + 0] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      SIZE, SIZE, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  // ---------------------------------------------------------------------------
  // 4×4 matrix helpers (column-major Float32Array)
  // ---------------------------------------------------------------------------

  function mat4Perspective(fovY, aspect, near, far) {
    const f   = 1.0 / Math.tan(fovY / 2);
    const nf  = 1.0 / (near - far);
    const out = new Float32Array(16);
    out[0]  =  f / aspect;
    out[5]  =  f;
    out[10] =  (far + near) * nf;
    out[11] = -1;
    out[14] =  2 * far * near * nf;
    return out;
  }

  function sub3(a, b)        { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross3(a, b)      {
    return [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0],
    ];
  }
  function dot3(a, b)        { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function normalize3(a)     {
    const len = Math.sqrt(dot3(a, a));
    if (len === 0) return [0, 0, 0];
    return [a[0]/len, a[1]/len, a[2]/len];
  }

  function mat4LookAt(eye, center, up) {
    const f  = normalize3(sub3(center, eye));
    const s  = normalize3(cross3(f, up));
    const u  = cross3(s, f);
    const out = new Float32Array(16);
    out[0]  =  s[0];  out[4]  =  s[1];  out[8]  =  s[2];  out[12] = -dot3(s,  eye);
    out[1]  =  u[0];  out[5]  =  u[1];  out[9]  =  u[2];  out[13] = -dot3(u,  eye);
    out[2]  = -f[0];  out[6]  = -f[1];  out[10] = -f[2];  out[14] =  dot3(f,  eye);
    out[3]  =  0;     out[7]  =  0;     out[11] =  0;      out[15] =  1;
    return out;
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        out[col * 4 + row] = sum;
      }
    }
    return out;
  }

  function mat4Transpose(m) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] = m[j * 4 + i];
      }
    }
    return out;
  }

  /** Build a simple rotation matrix around Y axis (for the sphere model) */
  function mat4RotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = new Float32Array(16);
    out[0]  =  c;
    out[2]  =  s;
    out[5]  =  1;
    out[8]  = -s;
    out[10] =  c;
    out[15] =  1;
    return out;
  }

  function mat4Identity() {
    const out = new Float32Array(16);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  }

  /** Invert a 4×4 matrix (general case) — needed for normal matrix */
  function mat4Invert(m) {
    const out = new Float32Array(16);
    const m00=m[0],m01=m[1],m02=m[2],m03=m[3];
    const m10=m[4],m11=m[5],m12=m[6],m13=m[7];
    const m20=m[8],m21=m[9],m22=m[10],m23=m[11];
    const m30=m[12],m31=m[13],m32=m[14],m33=m[15];

    const b00=m00*m11-m01*m10, b01=m00*m12-m02*m10, b02=m00*m13-m03*m10;
    const b03=m01*m12-m02*m11, b04=m01*m13-m03*m11, b05=m02*m13-m03*m12;
    const b06=m20*m31-m21*m30, b07=m20*m32-m22*m30, b08=m20*m33-m23*m30;
    const b09=m21*m32-m22*m31, b10=m21*m33-m23*m31, b11=m22*m33-m23*m32;

    let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
    if (!det) return null;
    det = 1.0 / det;

    out[0]  = (m11*b11 - m12*b10 + m13*b09) * det;
    out[1]  = (m02*b10 - m01*b11 - m03*b09) * det;
    out[2]  = (m31*b05 - m32*b04 + m33*b03) * det;
    out[3]  = (m22*b04 - m21*b05 - m23*b03) * det;
    out[4]  = (m12*b08 - m10*b11 - m13*b07) * det;
    out[5]  = (m00*b11 - m02*b08 + m03*b07) * det;
    out[6]  = (m32*b02 - m30*b05 - m33*b01) * det;
    out[7]  = (m20*b05 - m22*b02 + m23*b01) * det;
    out[8]  = (m10*b10 - m11*b08 + m13*b06) * det;
    out[9]  = (m01*b08 - m00*b10 - m03*b06) * det;
    out[10] = (m30*b04 - m31*b02 + m33*b00) * det;
    out[11] = (m21*b02 - m20*b04 - m23*b00) * det;
    out[12] = (m11*b07 - m10*b09 - m12*b06) * det;
    out[13] = (m00*b09 - m01*b07 + m02*b06) * det;
    out[14] = (m31*b01 - m30*b03 - m32*b00) * det;
    out[15] = (m20*b03 - m21*b01 + m22*b00) * det;
    return out;
  }

  // ---------------------------------------------------------------------------
  // ShaderRendererInstance
  // ---------------------------------------------------------------------------

  /**
   * @param {HTMLCanvasElement} canvasUser   - left/user canvas
   * @param {HTMLCanvasElement} canvasTarget - right/target canvas
   */
  function ShaderRendererInstance(canvasUser, canvasTarget) {
    this._canvasUser   = canvasUser;
    this._canvasTarget = canvasTarget;

    // Create WebGL2 contexts
    this._glUser   = this._createGL(canvasUser);
    this._glTarget = this._createGL(canvasTarget);

    // Programs: null until compiled
    this._progUser   = null;
    this._progTarget = null;

    // Animation loop handle
    this._rafHandle = null;
    this._startTime = performance.now();
    this._running   = false;

    // Geometry mode: 'quad' (default) or 'sphere'
    this._geoMode = 'quad';

    // Lesson-specific uniform configuration
    // { name: string, type: 'float'|'vec2'|'vec3'|'vec4'|'int', value: any }
    this._uniformDefs = [];

    // Mouse state (normalised 0..1 for each canvas)
    this._mouseUser   = [0.5, 0.5];
    this._mouseTarget = [0.5, 0.5];

    // Set up geometry VAOs for both contexts
    this._vaoUser   = this._setupGeometry(this._glUser);
    this._vaoTarget = this._setupGeometry(this._glTarget);

    // Checkerboard textures
    this._texUser   = createCheckerTexture(this._glUser);
    this._texTarget = createCheckerTexture(this._glTarget);

    // Mouse tracking
    this._bindMouse(canvasUser,   this._mouseUser);
    this._bindMouse(canvasTarget, this._mouseTarget);
  }

  ShaderRendererInstance.prototype._createGL = function (canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias:              false,
      preserveDrawingBuffer:  true,   // needed for readPixels after draw
      premultipliedAlpha:     false,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    return gl;
  };

  ShaderRendererInstance.prototype._bindMouse = function (canvas, mouseArr) {
    canvas.addEventListener('mousemove', function (e) {
      const rect = canvas.getBoundingClientRect();
      mouseArr[0] = (e.clientX - rect.left) / rect.width;
      mouseArr[1] = 1.0 - (e.clientY - rect.top)  / rect.height; // flip Y
    });
  };

  // ── Geometry ──────────────────────────────────────────────────────────────

  /**
   * Creates VAOs for both quad and sphere on the given context.
   * Returns { quad: { vao, count }, sphere: { vao, indexBuffer, count } }
   */
  ShaderRendererInstance.prototype._setupGeometry = function (gl) {
    // --- Quad ---
    const quadVAO = gl.createVertexArray();
    gl.bindVertexArray(quadVAO);
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTS, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // --- Sphere ---
    const sph = SPHERE.get();
    const sphereVAO = gl.createVertexArray();
    gl.bindVertexArray(sphereVAO);

    const sphereVBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sph.vertices, gl.STATIC_DRAW);
    // a_position = loc 0 (xyz), a_uv = loc 1 (uv)
    const STRIDE = 5 * 4; // 5 floats × 4 bytes
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 3 * 4);

    const sphereIBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sph.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    return {
      quad:   { vao: quadVAO,   count: 4 },
      sphere: { vao: sphereVAO, indexBuffer: sphereIBuf, count: sph.indices.length },
    };
  };

  ShaderRendererInstance.prototype.setGeometry = function (type) {
    if (type !== 'quad' && type !== 'sphere') {
      console.warn('[ShaderRenderer] Unknown geometry type:', type);
      return;
    }
    this._geoMode = type;
  };

  // ── Uniform configuration ─────────────────────────────────────────────────

  /**
   * @param {string[]} names    - uniform names, e.g. ['u_speed', 'u_color']
   * @param {Object}   defaults - { u_speed: 1.0, u_color: [1,0,0] }
   */
  ShaderRendererInstance.prototype.setUniforms = function (names, defaults) {
    this._uniformDefs = (names || []).map(function (name) {
      return { name: name, value: defaults ? defaults[name] : undefined };
    });
  };

  // ── Shader compilation ────────────────────────────────────────────────────

  /**
   * Compile a vertex + fragment shader and link a program.
   * @returns {{ ok: boolean, program: WebGLProgram|null, error: string|null }}
   */
  ShaderRendererInstance.prototype.compile = function (gl, vertSrc, fragSrc) {
    function compileShader(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        return { shader: null, error: err };
      }
      return { shader: shader, error: null };
    }

    const vert = compileShader(gl.VERTEX_SHADER,   vertSrc);
    if (vert.error) return { ok: false, program: null, error: 'VERT: ' + vert.error };

    const frag = compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (frag.error) {
      gl.deleteShader(vert.shader);
      return { ok: false, program: null, error: 'FRAG: ' + frag.error };
    }

    const prog = gl.createProgram();

    // Bind attribute locations before linking so both quad and sphere work
    gl.bindAttribLocation(prog, 0, 'a_position');
    gl.bindAttribLocation(prog, 1, 'a_uv');

    gl.attachShader(prog, vert.shader);
    gl.attachShader(prog, frag.shader);
    gl.linkProgram(prog);

    gl.deleteShader(vert.shader);
    gl.deleteShader(frag.shader);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      return { ok: false, program: null, error: 'LINK: ' + err };
    }

    return { ok: true, program: prog, error: null };
  };

  /** Auto-prepend #version if missing, then compile on the user GL context */
  ShaderRendererInstance.prototype.compileUser = function (fragSrc, vertSrc) {
    const vs = vertSrc || (this._geoMode === 'sphere' ? VS_SPHERE : VS_QUAD);
    const fs = _ensureVersion(fragSrc);
    const result = this.compile(this._glUser, vs, fs);
    if (result.ok) {
      if (this._progUser) this._glUser.deleteProgram(this._progUser);
      this._progUser = result.program;
    }
    return result;
  };

  /** Auto-prepend #version if missing, then compile on the target GL context */
  ShaderRendererInstance.prototype.compileTarget = function (fragSrc, vertSrc) {
    const vs = vertSrc || (this._geoMode === 'sphere' ? VS_SPHERE : VS_QUAD);
    const fs = _ensureVersion(fragSrc);
    const result = this.compile(this._glTarget, vs, fs);
    if (result.ok) {
      if (this._progTarget) this._glTarget.deleteProgram(this._progTarget);
      this._progTarget = result.program;
    }
    return result;
  };

  function _ensureVersion(src) {
    if (!src) return src;
    if (src.trimStart().startsWith('#version')) {
      // Ensure precision is present after #version line
      if (!src.includes('precision ')) {
        return src.replace(/(#version\s+\d+\s+es\s*\n)/, '$1precision highp float;\n');
      }
      return src;
    }
    return '#version 300 es\nprecision highp float;\n' + src;
  }

  // ── Uniform injection ─────────────────────────────────────────────────────

  ShaderRendererInstance.prototype._setUniforms = function (gl, prog, time, mouse) {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;

    function setF(name, v) {
      const loc = gl.getUniformLocation(prog, name);
      if (loc == null) return;
      if      (typeof v === 'number')     gl.uniform1f(loc, v);
      else if (v.length === 2)            gl.uniform2fv(loc, v);
      else if (v.length === 3)            gl.uniform3fv(loc, v);
      else if (v.length === 4)            gl.uniform4fv(loc, v);
    }

    // Core builtins
    setF('u_time',       time);
    setF('u_resolution', [w, h]);
    setF('u_mouse',      mouse || [0.5, 0.5]);

    // Sphere matrices
    if (this._geoMode === 'sphere') {
      const aspect    = w / h;
      const proj      = mat4Perspective(Math.PI / 4, aspect, 0.1, 100.0);
      const view      = mat4LookAt([0, 0, 3], [0, 0, 0], [0, 1, 0]);
      const model     = mat4RotateY(time * 0.5);
      const mv        = mat4Multiply(view, model);
      const normalMat = mat4Transpose(mat4Invert(mv) || mat4Identity());

      const locProj   = gl.getUniformLocation(prog, 'u_projection');
      const locView   = gl.getUniformLocation(prog, 'u_view');
      const locModel  = gl.getUniformLocation(prog, 'u_model');
      const locNorm   = gl.getUniformLocation(prog, 'u_normalMatrix');
      if (locProj)  gl.uniformMatrix4fv(locProj,  false, proj);
      if (locView)  gl.uniformMatrix4fv(locView,  false, view);
      if (locModel) gl.uniformMatrix4fv(locModel, false, model);
      if (locNorm)  gl.uniformMatrix4fv(locNorm,  false, normalMat);
    }

    // Texture: bind checkerboard to TEXTURE0 for u_texture0 / u_tex*
    const tex = (gl === this._glUser) ? this._texUser : this._texTarget;
    const texNames = this._getTextureUniformNames(gl, prog);
    if (texNames.length > 0) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const locTex = gl.getUniformLocation(prog, texNames[0]);
      if (locTex != null) gl.uniform1i(locTex, 0);
    }

    // Lesson-specific defaults
    for (let i = 0; i < this._uniformDefs.length; i++) {
      const def = this._uniformDefs[i];
      if (def.value !== undefined && def.value !== null) {
        setF(def.name, def.value);
      }
    }
  };

  /** Enumerate active uniforms and return those matching texture naming patterns */
  ShaderRendererInstance.prototype._getTextureUniformNames = function (gl, prog) {
    const count  = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    const result = [];
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (!info) continue;
      if (info.name === 'u_texture0' || info.name.startsWith('u_tex')) {
        result.push(info.name);
      }
    }
    return result;
  };

  // ── Drawing ───────────────────────────────────────────────────────────────

  ShaderRendererInstance.prototype._draw = function (gl, prog, time, mouse, vaoSet) {
    const w = gl.canvas.clientWidth  || gl.canvas.width  || 512;
    const h = gl.canvas.clientHeight || gl.canvas.height || 512;

    // Sync canvas pixel dimensions to display size
    if (gl.canvas.width  !== w) gl.canvas.width  = w;
    if (gl.canvas.height !== h) gl.canvas.height = h;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!prog) return;

    gl.useProgram(prog);
    this._setUniforms(gl, prog, time, mouse);

    if (this._geoMode === 'sphere') {
      gl.enable(gl.DEPTH_TEST);
      gl.bindVertexArray(vaoSet.sphere.vao);
      gl.drawElements(gl.TRIANGLES, vaoSet.sphere.count, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.DEPTH_TEST);
    } else {
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(vaoSet.quad.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, vaoSet.quad.count);
    }

    gl.bindVertexArray(null);
  };

  // ── Render loop ───────────────────────────────────────────────────────────

  ShaderRendererInstance.prototype.renderFrame = function () {
    const t = (performance.now() - this._startTime) / 1000;
    this._draw(this._glUser,   this._progUser,   t, this._mouseUser,   this._vaoUser);
    this._draw(this._glTarget, this._progTarget, t, this._mouseTarget, this._vaoTarget);
  };

  ShaderRendererInstance.prototype.startLoop = function () {
    if (this._running) return;
    this._running = true;
    const self = this;
    function loop() {
      if (!self._running) return;
      self.renderFrame();
      self._rafHandle = requestAnimationFrame(loop);
    }
    self._rafHandle = requestAnimationFrame(loop);
  };

  ShaderRendererInstance.prototype.stopLoop = function () {
    this._running = false;
    if (this._rafHandle != null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  };

  // ── Pixel-match scoring ───────────────────────────────────────────────────

  const MATCH_SIZE = 256; // comparison resolution
  const DELTA_E_THRESHOLD = 5.0;

  /**
   * Read MATCH_SIZE×MATCH_SIZE pixels from both canvases and compute a
   * perceptual match score in CIELAB space.
   *
   * Returns a percentage [0..100] of pixels whose CIE deltaE is < threshold.
   */
  ShaderRendererInstance.prototype.computeMatch = function () {
    return this._computeMatchAt(null);
  };

  /**
   * Sample at t = 0, 1.0, 2.5 and return the average match percentage.
   */
  ShaderRendererInstance.prototype.computeMatchAnimated = function () {
    const times   = [0, 1.0, 2.5];
    let   total   = 0;
    const wasRunning = this._running;
    this.stopLoop();

    for (let i = 0; i < times.length; i++) {
      total += this._computeMatchAt(times[i]);
    }

    if (wasRunning) this.startLoop();
    return total / times.length;
  };

  ShaderRendererInstance.prototype._computeMatchAt = function (t) {
    // Render both canvases to an offscreen FBO at MATCH_SIZE resolution
    const pixU = this._renderToPixels(this._glUser,   this._progUser,   this._vaoUser,   t);
    const pixT = this._renderToPixels(this._glTarget, this._progTarget, this._vaoTarget, t);

    if (!pixU || !pixT) return 0;

    const N         = MATCH_SIZE * MATCH_SIZE;
    let   matching  = 0;

    for (let i = 0; i < N; i++) {
      const idx = i * 4;

      const ru = pixU[idx]   / 255;
      const gu = pixU[idx+1] / 255;
      const bu = pixU[idx+2] / 255;

      const rt = pixT[idx]   / 255;
      const gt = pixT[idx+1] / 255;
      const bt = pixT[idx+2] / 255;

      const labU = srgbToLab(ru, gu, bu);
      const labT = srgbToLab(rt, gt, bt);

      const dL = labU[0] - labT[0];
      const da = labU[1] - labT[1];
      const db = labU[2] - labT[2];
      const deltaE = Math.sqrt(dL*dL + da*da + db*db);

      if (deltaE < DELTA_E_THRESHOLD) matching++;
    }

    return (matching / N) * 100;
  };

  /**
   * Render a frame at a specific time into a MATCH_SIZE offscreen framebuffer
   * and return the raw pixel data.
   */
  ShaderRendererInstance.prototype._renderToPixels = function (gl, prog, vaoSet, t) {
    if (!prog) return null;

    const S = MATCH_SIZE;

    // Create FBO + texture + depth renderbuffer
    const fbo = gl.createFramebuffer();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const rbo = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, S, S);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
      gl.deleteRenderbuffer(rbo);
      return null;
    }

    // Render at the requested time
    const time   = (t != null) ? t : (performance.now() - this._startTime) / 1000;
    const mouse  = (gl === this._glUser) ? this._mouseUser : this._mouseTarget;

    gl.viewport(0, 0, S, S);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    this._setUniforms(gl, prog, time, mouse);

    if (this._geoMode === 'sphere') {
      gl.enable(gl.DEPTH_TEST);
      gl.bindVertexArray(vaoSet.sphere.vao);
      gl.drawElements(gl.TRIANGLES, vaoSet.sphere.count, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.DEPTH_TEST);
    } else {
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(vaoSet.quad.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, vaoSet.quad.count);
    }
    gl.bindVertexArray(null);

    // Read pixels
    const pixels = new Uint8Array(S * S * 4);
    gl.readPixels(0, 0, S, S, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Cleanup
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    gl.deleteRenderbuffer(rbo);

    // Restore viewport to canvas size
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    return pixels;
  };

  // ── Destruction ───────────────────────────────────────────────────────────

  ShaderRendererInstance.prototype.destroy = function () {
    this.stopLoop();

    function cleanGL(gl, prog, vaoSet, tex) {
      if (!gl) return;
      if (prog) gl.deleteProgram(prog);
      if (tex)  gl.deleteTexture(tex);
      if (vaoSet) {
        if (vaoSet.quad   && vaoSet.quad.vao)   gl.deleteVertexArray(vaoSet.quad.vao);
        if (vaoSet.sphere && vaoSet.sphere.vao) gl.deleteVertexArray(vaoSet.sphere.vao);
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }

    cleanGL(this._glUser,   this._progUser,   this._vaoUser,   this._texUser);
    cleanGL(this._glTarget, this._progTarget, this._vaoTarget, this._texTarget);

    this._glUser   = null;
    this._glTarget = null;
    this._progUser   = null;
    this._progTarget = null;
  };

  // ---------------------------------------------------------------------------
  // Expose on window
  // ---------------------------------------------------------------------------

  global.ShaderRenderer = ShaderRendererInstance;

})(window);
