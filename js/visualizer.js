// ===================================================================
// Learner 3D Visualizer — Interactive Three.js scenes per lesson
// ===================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const panel = document.getElementById('viz-panel');
const canvasWrap = document.getElementById('viz-canvas-wrap');
const controlsDiv = document.getElementById('viz-controls');
const infoDiv = document.getElementById('viz-info');

let renderer, scene, camera, controls, animId;
let currentViz = null;

// === CORE ENGINE ===

function initRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  canvasWrap.appendChild(renderer.domElement);
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!renderer) return;
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function createScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, canvasWrap.clientWidth / canvasWrap.clientHeight, 0.1, 100);
  camera.position.set(3, 2.5, 4);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.update();
}

function animate() {
  animId = requestAnimationFrame(animate);
  controls.update();
  if (currentViz && currentViz.update) currentViz.update();
  renderer.render(scene, camera);
}

function stopAnimation() {
  if (animId) cancelAnimationFrame(animId);
  animId = null;
}

function disposeScene() {
  stopAnimation();
  if (currentViz && currentViz.dispose) currentViz.dispose();
  currentViz = null;
  if (scene) {
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    scene.clear();
  }
  controlsDiv.innerHTML = '';
  infoDiv.innerHTML = '';
}

// === UTILITY: COMMON OBJECTS ===

const COLORS = {
  accent: 0xd4a04a,
  cyan: 0x4ecdc4,
  red: 0xe85d5d,
  green: 0x50c878,
  blue: 0x4488ff,
  white: 0xf0ece4,
  grid: 0x1a1d2a,
  gridCenter: 0x2a2d3a,
};

function addGrid() {
  const grid = new THREE.GridHelper(8, 8, COLORS.gridCenter, COLORS.grid);
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  scene.add(grid);
}

function addAxes(size = 3) {
  const makeAxis = (dir, color) => {
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(), size, color, 0.15, 0.08);
    scene.add(arrow);
    return arrow;
  };
  makeAxis(new THREE.Vector3(1, 0, 0), COLORS.red);
  makeAxis(new THREE.Vector3(0, 1, 0), COLORS.green);
  makeAxis(new THREE.Vector3(0, 0, 1), COLORS.blue);

  // Labels
  const labels = [
    { text: 'X', pos: [size + 0.2, 0, 0], color: '#e85d5d' },
    { text: 'Y', pos: [0, size + 0.2, 0], color: '#50c878' },
    { text: 'Z', pos: [0, 0, size + 0.2], color: '#4488ff' },
  ];
  labels.forEach(l => {
    const sprite = makeTextSprite(l.text, l.color);
    sprite.position.set(...l.pos);
    scene.add(sprite);
  });
}

function makeTextSprite(text, color = '#f0ece4', size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${size * 0.6}px 'Plus Jakarta Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.4, 0.4, 1);
  return sprite;
}

function makeArrow(dir, origin, color, len) {
  const d = dir.clone().normalize();
  const l = len !== undefined ? len : dir.length();
  const o = origin || new THREE.Vector3();
  return new THREE.ArrowHelper(d, o, l, color, 0.18, 0.1);
}

function addSlider(label, min, max, value, step, onChange) {
  const row = document.createElement('div');
  row.className = 'viz-slider-row';
  const lbl = document.createElement('label');
  lbl.className = 'viz-slider-label';
  lbl.textContent = label;
  const valSpan = document.createElement('span');
  valSpan.className = 'viz-slider-value';
  valSpan.textContent = value.toFixed(2);
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'viz-slider';
  input.min = min;
  input.max = max;
  input.step = step || 0.01;
  input.value = value;
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    valSpan.textContent = v.toFixed(2);
    onChange(v);
  });
  row.appendChild(lbl);
  row.appendChild(input);
  row.appendChild(valSpan);
  controlsDiv.appendChild(row);
  return input;
}

function addToggle(label, checked, onChange) {
  const row = document.createElement('div');
  row.className = 'viz-toggle-row';
  const lbl = document.createElement('label');
  lbl.className = 'viz-toggle-label';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.addEventListener('change', () => onChange(cb.checked));
  const span = document.createElement('span');
  span.textContent = label;
  lbl.appendChild(cb);
  lbl.appendChild(span);
  row.appendChild(lbl);
  controlsDiv.appendChild(row);
  return cb;
}

function setInfo(html) {
  infoDiv.innerHTML = html;
}

// === VISUALIZATIONS ===

// --- 01: Vectors ---
function vizVectors() {
  addGrid();
  addAxes(2);

  let vx = 2, vy = 1.5, vz = 1;
  const arrow = makeArrow(new THREE.Vector3(vx, vy, vz), new THREE.Vector3(), COLORS.accent);
  scene.add(arrow);

  let normArrow = null;
  let showNorm = false;

  const rebuild = () => {
    const v = new THREE.Vector3(vx, vy, vz);
    const len = v.length();
    arrow.setDirection(v.clone().normalize());
    arrow.setLength(len, 0.18, 0.1);
    if (normArrow) { scene.remove(normArrow); normArrow.dispose(); normArrow = null; }
    if (showNorm) {
      normArrow = makeArrow(v.clone().normalize(), new THREE.Vector3(), COLORS.cyan, 1);
      scene.add(normArrow);
    }
    setInfo(`<div class="viz-readout"><b>v</b> = (${vx.toFixed(1)}, ${vy.toFixed(1)}, ${vz.toFixed(1)})<br>|v| = ${len.toFixed(3)}<br>n = (${(vx/len).toFixed(3)}, ${(vy/len).toFixed(3)}, ${(vz/len).toFixed(3)})</div>`);
  };

  addSlider('X', -3, 3, vx, 0.1, v => { vx = v; rebuild(); });
  addSlider('Y', -3, 3, vy, 0.1, v => { vy = v; rebuild(); });
  addSlider('Z', -3, 3, vz, 0.1, v => { vz = v; rebuild(); });
  addToggle('Show normalized', false, v => { showNorm = v; rebuild(); });

  rebuild();
  camera.position.set(4, 3, 4);
}

// --- 02: Dot Product ---
function vizDotProduct() {
  addGrid();
  addAxes(1.5);

  let ax = 2, ay = 1, az = 0;
  let bx = 0.5, by = 2, bz = 0;

  const arrowA = makeArrow(new THREE.Vector3(ax, ay, az), new THREE.Vector3(), COLORS.accent);
  const arrowB = makeArrow(new THREE.Vector3(bx, by, bz), new THREE.Vector3(), COLORS.cyan);
  scene.add(arrowA, arrowB);

  let projLine = null;

  const rebuild = () => {
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    arrowA.setDirection(a.clone().normalize());
    arrowA.setLength(a.length(), 0.15, 0.08);
    arrowB.setDirection(b.clone().normalize());
    arrowB.setLength(b.length(), 0.15, 0.08);

    const dot = a.dot(b);
    const angle = a.angleTo(b) * (180 / Math.PI);

    // Projection of A onto B
    const projScalar = dot / b.lengthSq();
    const projVec = b.clone().multiplyScalar(projScalar);

    if (projLine) { scene.remove(projLine); projLine.geometry.dispose(); projLine.material.dispose(); }
    const pts = [new THREE.Vector3(), projVec, a];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
    projLine = new THREE.Line(geo, mat);
    scene.add(projLine);

    setInfo(`<div class="viz-readout"><b style="color:#d4a04a">A</b> = (${ax.toFixed(1)}, ${ay.toFixed(1)}, ${az.toFixed(1)})<br><b style="color:#4ecdc4">B</b> = (${bx.toFixed(1)}, ${by.toFixed(1)}, ${bz.toFixed(1)})<br>A&middot;B = <b>${dot.toFixed(2)}</b><br>Angle = ${angle.toFixed(1)}&deg;<br>Proj scalar = ${projScalar.toFixed(3)}</div>`);
  };

  addSlider('A.x', -3, 3, ax, 0.1, v => { ax = v; rebuild(); });
  addSlider('A.y', -3, 3, ay, 0.1, v => { ay = v; rebuild(); });
  addSlider('B.x', -3, 3, bx, 0.1, v => { bx = v; rebuild(); });
  addSlider('B.y', -3, 3, by, 0.1, v => { by = v; rebuild(); });

  rebuild();
  camera.position.set(0, 4, 5);
}

// --- 03: Cross Product ---
function vizCrossProduct() {
  addGrid();
  addAxes(1.5);

  let ax = 2, ay = 0, az = 0;
  let bx = 0, by = 2, bz = 0;

  const arrowA = makeArrow(new THREE.Vector3(ax, ay, az), new THREE.Vector3(), COLORS.accent);
  const arrowB = makeArrow(new THREE.Vector3(bx, by, bz), new THREE.Vector3(), COLORS.cyan);
  let arrowC = null;
  let parallelogram = null;

  scene.add(arrowA, arrowB);

  const rebuild = () => {
    const a = new THREE.Vector3(ax, ay, az);
    const b = new THREE.Vector3(bx, by, bz);
    const c = new THREE.Vector3().crossVectors(a, b);

    arrowA.setDirection(a.clone().normalize());
    arrowA.setLength(a.length(), 0.15, 0.08);
    arrowB.setDirection(b.clone().normalize());
    arrowB.setLength(b.length(), 0.15, 0.08);

    if (arrowC) { scene.remove(arrowC); arrowC.dispose(); }
    if (c.length() > 0.001) {
      arrowC = makeArrow(c, new THREE.Vector3(), COLORS.green, c.length());
      scene.add(arrowC);
    }

    // Parallelogram
    if (parallelogram) { scene.remove(parallelogram); parallelogram.geometry.dispose(); parallelogram.material.dispose(); }
    const pgeo = new THREE.BufferGeometry();
    const verts = new Float32Array([0,0,0, ax,ay,az, ax+bx,ay+by,az+bz, 0,0,0, ax+bx,ay+by,az+bz, bx,by,bz]);
    pgeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const pmat = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    parallelogram = new THREE.Mesh(pgeo, pmat);
    scene.add(parallelogram);

    setInfo(`<div class="viz-readout"><b style="color:#d4a04a">A</b> = (${ax.toFixed(1)}, ${ay.toFixed(1)}, ${az.toFixed(1)})<br><b style="color:#4ecdc4">B</b> = (${bx.toFixed(1)}, ${by.toFixed(1)}, ${bz.toFixed(1)})<br><b style="color:#50c878">A&times;B</b> = (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})<br>|A&times;B| = ${c.length().toFixed(3)}</div>`);
  };

  addSlider('A.x', -3, 3, ax, 0.1, v => { ax = v; rebuild(); });
  addSlider('A.y', -3, 3, ay, 0.1, v => { ay = v; rebuild(); });
  addSlider('A.z', -3, 3, az, 0.1, v => { az = v; rebuild(); });
  addSlider('B.x', -3, 3, bx, 0.1, v => { bx = v; rebuild(); });
  addSlider('B.y', -3, 3, by, 0.1, v => { by = v; rebuild(); });
  addSlider('B.z', -3, 3, bz, 0.1, v => { bz = v; rebuild(); });

  rebuild();
  camera.position.set(3, 3, 4);
}

// --- 06/07: 3D Transforms ---
function vizTransforms() {
  addGrid();
  addAxes(2);

  // Wireframe cube
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.accent, wireframe: true });
  const cube = new THREE.Mesh(geo, mat);
  scene.add(cube);

  // Solid faces
  const solidMat = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
  const solid = new THREE.Mesh(geo.clone(), solidMat);
  scene.add(solid);

  // Ghost (original)
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x444466, wireframe: true, transparent: true, opacity: 0.3 });
  const ghost = new THREE.Mesh(geo.clone(), ghostMat);
  scene.add(ghost);

  let tx = 0, ty = 0, tz = 0;
  let rx = 0, ry = 0, rz = 0;
  let sx = 1, sy = 1, sz = 1;

  const rebuild = () => {
    cube.position.set(tx, ty, tz);
    cube.rotation.set(rx, ry, rz);
    cube.scale.set(sx, sy, sz);
    solid.position.copy(cube.position);
    solid.rotation.copy(cube.rotation);
    solid.scale.copy(cube.scale);

    setInfo(`<div class="viz-readout">T = (${tx.toFixed(1)}, ${ty.toFixed(1)}, ${tz.toFixed(1)})<br>R = (${(rx*180/Math.PI).toFixed(0)}&deg;, ${(ry*180/Math.PI).toFixed(0)}&deg;, ${(rz*180/Math.PI).toFixed(0)}&deg;)<br>S = (${sx.toFixed(1)}, ${sy.toFixed(1)}, ${sz.toFixed(1)})</div>`);
  };

  addSlider('Translate X', -3, 3, 0, 0.1, v => { tx = v; rebuild(); });
  addSlider('Translate Y', -3, 3, 0, 0.1, v => { ty = v; rebuild(); });
  addSlider('Rotate X', -Math.PI, Math.PI, 0, 0.01, v => { rx = v; rebuild(); });
  addSlider('Rotate Y', -Math.PI, Math.PI, 0, 0.01, v => { ry = v; rebuild(); });
  addSlider('Scale X', 0.1, 3, 1, 0.1, v => { sx = v; rebuild(); });
  addSlider('Scale Y', 0.1, 3, 1, 0.1, v => { sy = v; rebuild(); });

  rebuild();
  camera.position.set(4, 3, 4);
}

// --- 10: Camera / View Matrix ---
function vizCamera() {
  addGrid();
  addAxes(1.5);

  // Scene objects
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshBasicMaterial({ color: COLORS.cyan, wireframe: true }));
  sphere.position.set(0, 0.3, 0);
  scene.add(sphere);

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: COLORS.green, wireframe: true }));
  box.position.set(-1, 0.25, 1);
  scene.add(box);

  // Camera representation
  const camGeo = new THREE.ConeGeometry(0.15, 0.3, 4);
  camGeo.rotateX(-Math.PI / 2);
  const camMesh = new THREE.Mesh(camGeo, new THREE.MeshBasicMaterial({ color: COLORS.accent }));
  scene.add(camMesh);

  // Frustum lines
  const frustumGeo = new THREE.BufferGeometry();
  const frustumMat = new THREE.LineBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.4 });
  const frustumLines = new THREE.LineSegments(frustumGeo, frustumMat);
  scene.add(frustumLines);

  let eyeX = 3, eyeY = 2, eyeZ = 3;
  let targetX = 0, targetY = 0, targetZ = 0;

  const rebuild = () => {
    const eye = new THREE.Vector3(eyeX, eyeY, eyeZ);
    const target = new THREE.Vector3(targetX, targetY, targetZ);

    camMesh.position.copy(eye);
    camMesh.lookAt(target);

    // Forward, right, up vectors
    const fwd = target.clone().sub(eye).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();

    // Simple frustum visualization
    const near = 0.3, far = 2, fov = 0.4;
    const nc = eye.clone().add(fwd.clone().multiplyScalar(near));
    const fc = eye.clone().add(fwd.clone().multiplyScalar(far));
    const corners = [];
    for (const [d, c] of [[near * fov, nc], [far * fov, fc]]) {
      corners.push(
        c.clone().add(right.clone().multiplyScalar(d)).add(up.clone().multiplyScalar(d)),
        c.clone().add(right.clone().multiplyScalar(-d)).add(up.clone().multiplyScalar(d)),
        c.clone().add(right.clone().multiplyScalar(-d)).add(up.clone().multiplyScalar(-d)),
        c.clone().add(right.clone().multiplyScalar(d)).add(up.clone().multiplyScalar(-d))
      );
    }
    const pts = [];
    // Near plane
    for (let i = 0; i < 4; i++) { pts.push(corners[i], corners[(i + 1) % 4]); }
    // Far plane
    for (let i = 4; i < 8; i++) { pts.push(corners[i], corners[4 + (i - 3) % 4]); }
    // Edges connecting near to far
    for (let i = 0; i < 4; i++) { pts.push(corners[i], corners[i + 4]); }

    frustumGeo.setFromPoints(pts);
    frustumGeo.computeBoundingSphere();

    setInfo(`<div class="viz-readout">Eye = (${eyeX.toFixed(1)}, ${eyeY.toFixed(1)}, ${eyeZ.toFixed(1)})<br>Target = (${targetX.toFixed(1)}, ${targetY.toFixed(1)}, ${targetZ.toFixed(1)})<br>Forward = (${fwd.x.toFixed(2)}, ${fwd.y.toFixed(2)}, ${fwd.z.toFixed(2)})</div>`);
  };

  addSlider('Eye X', -5, 5, eyeX, 0.1, v => { eyeX = v; rebuild(); });
  addSlider('Eye Y', 0.5, 5, eyeY, 0.1, v => { eyeY = v; rebuild(); });
  addSlider('Eye Z', -5, 5, eyeZ, 0.1, v => { eyeZ = v; rebuild(); });
  addSlider('Target X', -3, 3, targetX, 0.1, v => { targetX = v; rebuild(); });
  addSlider('Target Y', -1, 3, targetY, 0.1, v => { targetY = v; rebuild(); });

  rebuild();
  camera.position.set(5, 4, 6);
}

// --- 14: Lighting Models ---
function vizLighting() {
  // Lit sphere
  const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
  const sphereMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 32 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.set(0, 1, 0);
  scene.add(sphere);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshPhongMaterial({ color: 0x222233 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Lights
  const ambient = new THREE.AmbientLight(0x111122);
  scene.add(ambient);

  const pointLight = new THREE.PointLight(COLORS.accent, 40, 15);
  pointLight.position.set(2, 3, 2);
  scene.add(pointLight);

  // Light indicator sphere
  const lightSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: COLORS.accent })
  );
  lightSphere.position.copy(pointLight.position);
  scene.add(lightSphere);

  // Vectors from surface point toward light
  const surfPoint = new THREE.Vector3(0, 1, 1); // front of sphere
  let arrowN = makeArrow(new THREE.Vector3(0, 0, 1), surfPoint, COLORS.green, 1);
  let arrowL = null;

  scene.add(arrowN);

  let lx = 2, ly = 3, lz = 2;
  let shininess = 32;

  const rebuild = () => {
    pointLight.position.set(lx, ly, lz);
    lightSphere.position.set(lx, ly, lz);

    // Update light direction arrow
    const L = new THREE.Vector3(lx, ly, lz).sub(surfPoint).normalize();
    if (arrowL) { scene.remove(arrowL); arrowL.dispose(); }
    arrowL = makeArrow(L, surfPoint, COLORS.accent, 1);
    scene.add(arrowL);

    sphereMat.shininess = shininess;

    const NdotL = new THREE.Vector3(0, 0, 1).dot(L);
    setInfo(`<div class="viz-readout">Light = (${lx.toFixed(1)}, ${ly.toFixed(1)}, ${lz.toFixed(1)})<br><b style="color:#50c878">N</b>&middot;<b style="color:#d4a04a">L</b> = ${NdotL.toFixed(3)}<br>Shininess = ${shininess}</div>`);
  };

  addSlider('Light X', -4, 4, lx, 0.1, v => { lx = v; rebuild(); });
  addSlider('Light Y', 0.5, 5, ly, 0.1, v => { ly = v; rebuild(); });
  addSlider('Light Z', -4, 4, lz, 0.1, v => { lz = v; rebuild(); });
  addSlider('Shininess', 1, 128, shininess, 1, v => { shininess = v; rebuild(); });

  rebuild();
  camera.position.set(0, 2, 5);
}

// --- 17: Bezier Curves ---
function vizBezier() {
  addGrid();

  const controlPts = [
    new THREE.Vector3(-2, 0, 0),
    new THREE.Vector3(-1, 2, 0),
    new THREE.Vector3(1, 2, 0),
    new THREE.Vector3(2, 0, 0),
  ];

  // Control point spheres
  const cpSpheres = controlPts.map((p, i) => {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: i === 0 || i === 3 ? COLORS.accent : COLORS.cyan })
    );
    s.position.copy(p);
    scene.add(s);
    return s;
  });

  // Control polygon
  const cpLineGeo = new THREE.BufferGeometry().setFromPoints(controlPts);
  const cpLine = new THREE.Line(cpLineGeo, new THREE.LineBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.3 }));
  scene.add(cpLine);

  // Curve
  const curveGeo = new THREE.BufferGeometry();
  const curveMat = new THREE.LineBasicMaterial({ color: COLORS.accent, linewidth: 2 });
  const curveLine = new THREE.Line(curveGeo, curveMat);
  scene.add(curveLine);

  // Point on curve
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.green })
  );
  scene.add(marker);

  // De Casteljau lines
  let castLines = [];

  let t = 0.5;

  const deCasteljau = (pts, t) => {
    if (pts.length === 1) return pts[0];
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      next.push(pts[i].clone().lerp(pts[i + 1], t));
    }
    return next;
  };

  const rebuild = () => {
    // Curve points
    const curvePts = [];
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      let pts = controlPts.map(p => p.clone());
      while (pts.length > 1) pts = deCasteljau(pts, u);
      curvePts.push(pts[0]);
    }
    curveGeo.setFromPoints(curvePts);

    // De Casteljau at current t
    castLines.forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
    castLines = [];

    let level = controlPts.map(p => p.clone());
    const colors = [0x555577, 0x777799, 0x9999bb];
    let lvl = 0;
    while (level.length > 1) {
      const next = deCasteljau(level, t);
      const geo = new THREE.BufferGeometry().setFromPoints(level);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colors[lvl % 3] || 0xaaaacc, transparent: true, opacity: 0.5 }));
      scene.add(line);
      castLines.push(line);

      // Intermediate points
      next.forEach(p => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: colors[lvl % 3] || 0xaaaacc }));
        s.position.copy(p);
        scene.add(s);
        castLines.push(s); // reuse array for cleanup
      });

      level = next;
      lvl++;
    }

    marker.position.copy(level[0]);

    setInfo(`<div class="viz-readout">t = ${t.toFixed(3)}<br>P(t) = (${level[0].x.toFixed(2)}, ${level[0].y.toFixed(2)})<br><span style="color:#4ecdc4">Drag t to see de Casteljau</span></div>`);
  };

  addSlider('t', 0, 1, t, 0.005, v => { t = v; rebuild(); });
  addSlider('P1.y', -2, 3, controlPts[1].y, 0.1, v => { controlPts[1].y = v; cpSpheres[1].position.y = v; cpLineGeo.setFromPoints(controlPts); rebuild(); });
  addSlider('P2.y', -2, 3, controlPts[2].y, 0.1, v => { controlPts[2].y = v; cpSpheres[2].position.y = v; cpLineGeo.setFromPoints(controlPts); rebuild(); });

  rebuild();
  camera.position.set(0, 2, 5);
}

// --- 18: Ray Intersection ---
function vizRayIntersection() {
  addGrid();

  // Sphere target
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan, wireframe: true, transparent: true, opacity: 0.4 })
  );
  sphere.position.set(0, 1, 0);
  scene.add(sphere);

  // Solid sphere interior
  const sphereSolid = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.08 })
  );
  sphereSolid.position.set(0, 1, 0);
  scene.add(sphereSolid);

  // Ray
  const rayGeo = new THREE.BufferGeometry();
  const rayLine = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: COLORS.accent }));
  scene.add(rayLine);

  // Hit marker
  const hitMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.green })
  );
  hitMarker.visible = false;
  scene.add(hitMarker);

  let ox = -3, oy = 1.5, oz = 2;
  let dx = 1, dy = -0.1, dz = -0.5;

  const rebuild = () => {
    const origin = new THREE.Vector3(ox, oy, oz);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();

    // Ray line
    const end = origin.clone().add(dir.clone().multiplyScalar(10));
    rayGeo.setFromPoints([origin, end]);

    // Ray-sphere intersection
    const oc = origin.clone().sub(new THREE.Vector3(0, 1, 0));
    const a = dir.dot(dir);
    const b = 2 * oc.dot(dir);
    const c = oc.dot(oc) - 1; // radius = 1
    const disc = b * b - 4 * a * c;

    let hitInfo = 'Miss';
    hitMarker.visible = false;

    if (disc >= 0) {
      const t1 = (-b - Math.sqrt(disc)) / (2 * a);
      const t2 = (-b + Math.sqrt(disc)) / (2 * a);
      const t = t1 > 0 ? t1 : t2;
      if (t > 0) {
        const hit = origin.clone().add(dir.clone().multiplyScalar(t));
        hitMarker.position.copy(hit);
        hitMarker.visible = true;
        hitInfo = `Hit at t=${t.toFixed(3)}<br>P = (${hit.x.toFixed(2)}, ${hit.y.toFixed(2)}, ${hit.z.toFixed(2)})`;
      }
    }

    setInfo(`<div class="viz-readout">Origin = (${ox.toFixed(1)}, ${oy.toFixed(1)}, ${oz.toFixed(1)})<br>Dir = (${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)})<br>Disc = ${disc.toFixed(3)}<br><b style="color:${disc >= 0 ? '#50c878' : '#e85d5d'}">${hitInfo}</b></div>`);
  };

  addSlider('Origin Y', -1, 4, oy, 0.1, v => { oy = v; rebuild(); });
  addSlider('Origin Z', -3, 3, oz, 0.1, v => { oz = v; rebuild(); });
  addSlider('Dir Y', -1, 1, dy, 0.01, v => { dy = v; rebuild(); });
  addSlider('Dir Z', -1, 1, dz, 0.01, v => { dz = v; rebuild(); });

  rebuild();
  camera.position.set(2, 3, 6);
}

// --- 16: Quaternions (gimbal lock demo) ---
function vizQuaternions() {
  addGrid();
  addAxes(1.5);

  // Two cubes side by side - Euler vs Quaternion
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);

  // Euler cube (left)
  const eulerMat = new THREE.MeshBasicMaterial({ color: COLORS.red, wireframe: true });
  const eulerCube = new THREE.Mesh(geo.clone(), eulerMat);
  eulerCube.position.set(-1.2, 0.5, 0);
  scene.add(eulerCube);

  const eulerLabel = makeTextSprite('Euler', '#e85d5d', 128);
  eulerLabel.position.set(-1.2, 1.4, 0);
  eulerLabel.scale.set(0.8, 0.8, 1);
  scene.add(eulerLabel);

  // Quaternion cube (right)
  const quatMat = new THREE.MeshBasicMaterial({ color: COLORS.green, wireframe: true });
  const quatCube = new THREE.Mesh(geo.clone(), quatMat);
  quatCube.position.set(1.2, 0.5, 0);
  scene.add(quatCube);

  const quatLabel = makeTextSprite('Quat', '#50c878', 128);
  quatLabel.position.set(1.2, 1.4, 0);
  quatLabel.scale.set(0.8, 0.8, 1);
  scene.add(quatLabel);

  let pitch = 0, yaw = 0, roll = 0;

  const rebuild = () => {
    // Euler: apply as XYZ order (shows gimbal lock at pitch = +/-90)
    eulerCube.rotation.set(pitch, yaw, roll, 'XYZ');

    // Quaternion: compose from individual rotations
    const qp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
    const q = new THREE.Quaternion().multiplyQuaternions(qy, qp).multiply(qr);
    quatCube.quaternion.copy(q);

    const isGimbal = Math.abs(Math.abs(pitch) - Math.PI / 2) < 0.1;
    setInfo(`<div class="viz-readout">Pitch = ${(pitch * 180 / Math.PI).toFixed(0)}&deg;<br>Yaw = ${(yaw * 180 / Math.PI).toFixed(0)}&deg;<br>Roll = ${(roll * 180 / Math.PI).toFixed(0)}&deg;${isGimbal ? '<br><b style="color:#e85d5d">GIMBAL LOCK!</b>' : ''}</div>`);
  };

  addSlider('Pitch', -Math.PI, Math.PI, 0, 0.01, v => { pitch = v; rebuild(); });
  addSlider('Yaw', -Math.PI, Math.PI, 0, 0.01, v => { yaw = v; rebuild(); });
  addSlider('Roll', -Math.PI, Math.PI, 0, 0.01, v => { roll = v; rebuild(); });

  rebuild();
  camera.position.set(0, 2.5, 5);
}

// === VISUALIZATION REGISTRY ===

const vizRegistry = {
  '01-vectors': vizVectors,
  '02-dot-product': vizDotProduct,
  '03-cross-product': vizCrossProduct,
  '04-coordinate-systems': vizTransforms,
  '05-matrix-fundamentals': vizTransforms,
  '06-2d-transforms': vizTransforms,
  '07-3d-transforms': vizTransforms,
  '08-homogeneous-coordinates': vizTransforms,
  '09-transform-pipeline': vizCamera,
  '10-camera-view-matrix': vizCamera,
  '11-projection-matrices': vizCamera,
  '14-lighting-models': vizLighting,
  '16-quaternions': vizQuaternions,
  '17-curves-surfaces': vizBezier,
  '18-ray-intersections': vizRayIntersection,
};

// === PUBLIC API ===

window.Visualizer = {
  load(lessonId) {
    initRenderer();
    disposeScene();
    createScene();

    const vizFn = vizRegistry[lessonId];
    if (vizFn) {
      panel.classList.add('active');
      vizFn();
      currentViz = { dispose: () => {} };
      animate();
    } else {
      panel.classList.remove('active');
      stopAnimation();
    }
    resize();
  },

  hide() {
    panel.classList.remove('active');
    disposeScene();
  }
};
