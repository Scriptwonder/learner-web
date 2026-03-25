/**
 * shader-editor.js
 * Shader Academy — main orchestrator: CodeMirror editors, challenge UI,
 * renderer integration, tab switching, submit/reset/back.
 *
 * Loaded as <script type="module">. Exposes window.ShaderEditor = { load }.
 * Depends on (globals): ShaderRenderer, ShaderTranslator, ShaderChallenges,
 *                       showScreen, appState, saveProgress.
 */

import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  keymap,
} from '@codemirror/view';

import { EditorState } from '@codemirror/state';

import {
  StreamLanguage,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';

import { clike } from '@codemirror/legacy-modes/mode/clike';

import { oneDark } from '@codemirror/theme-one-dark';

import {
  defaultKeymap,
  history,
  historyKeymap,
} from '@codemirror/commands';

// ---------------------------------------------------------------------------
// GLSL language mode (C-like with shader keywords)
// ---------------------------------------------------------------------------

const GLSL_KEYWORDS = [
  'attribute', 'const', 'uniform', 'varying', 'break', 'continue', 'do',
  'for', 'while', 'if', 'else', 'in', 'out', 'inout', 'float', 'int',
  'uint', 'void', 'bool', 'true', 'false', 'lowp', 'mediump', 'highp',
  'precision', 'invariant', 'discard', 'return', 'mat2', 'mat3', 'mat4',
  'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4',
  'mat4x2', 'mat4x3', 'mat4x4', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3',
  'ivec4', 'bvec2', 'bvec3', 'bvec4', 'uvec2', 'uvec3', 'uvec4',
  'sampler2D', 'sampler3D', 'samplerCube', 'sampler2DShadow',
  'struct', 'layout', 'centroid', 'flat', 'smooth', 'case', 'default',
  'switch',
];

const GLSL_BUILTINS = [
  'radians', 'degrees', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt',
  'abs', 'sign', 'floor', 'trunc', 'round', 'roundEven', 'ceil', 'fract',
  'mod', 'modf', 'min', 'max', 'clamp', 'mix', 'step', 'smoothstep',
  'isnan', 'isinf', 'floatBitsToInt', 'floatBitsToUint',
  'intBitsToFloat', 'uintBitsToFloat',
  'packSnorm2x16', 'unpackSnorm2x16', 'packUnorm2x16', 'unpackUnorm2x16',
  'packHalf2x16', 'unpackHalf2x16',
  'length', 'distance', 'dot', 'cross', 'normalize', 'faceforward',
  'reflect', 'refract',
  'matrixCompMult', 'outerProduct', 'transpose', 'determinant', 'inverse',
  'lessThan', 'lessThanEqual', 'greaterThan', 'greaterThanEqual', 'equal',
  'notEqual', 'any', 'all', 'not',
  'textureSize', 'texture', 'textureProj', 'textureLod',
  'textureOffset', 'texelFetch', 'texelFetchOffset',
  'textureProjOffset', 'textureLodOffset', 'textureProjLod',
  'textureProjLodOffset', 'textureGrad', 'textureGradOffset',
  'textureProjGrad', 'textureProjGradOffset',
  'dFdx', 'dFdy', 'fwidth', 'emit', 'endPrimitive',
  'gl_Position', 'gl_PointSize', 'gl_FragCoord', 'gl_FrontFacing',
  'gl_FragDepth', 'gl_PointCoord', 'gl_VertexID', 'gl_InstanceID',
];

const glslLang = StreamLanguage.define(
  clike({
    keywords: Object.fromEntries(GLSL_KEYWORDS.map(k => [k, 'keyword'])),
    builtin:  Object.fromEntries(GLSL_BUILTINS.map(b => [b, 'builtin'])),
    atoms:    { true: true, false: true },
    blockCommentStart: '/*',
    blockCommentEnd:   '*/',
    lineComment:       '//',
  })
);

// ---------------------------------------------------------------------------
// CodeMirror extension bundles
// ---------------------------------------------------------------------------

function makeBaseExtensions() {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    glslLang,
    oneDark,
    EditorView.theme({
      '&': {
        fontSize: '13px',
        fontFamily: '"JetBrains Mono", monospace',
        height: '100%',
      },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-content':  { padding: '8px 0' },
    }),
  ];
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let renderer    = null;   // ShaderRendererInstance
let editorGlsl  = null;   // EditorView (editable)
let editorHlsl  = null;   // EditorView (read-only)
let editorSlang = null;   // EditorView (read-only)
let activeTab   = 'glsl'; // 'glsl' | 'hlsl' | 'slang'
let debounceTimer = null;

// DOM refs — populated in load()
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEditorContent(view) {
  return view.state.doc.toString();
}

function setEditorContent(view, text) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

// ---------------------------------------------------------------------------
// Editor creation
// ---------------------------------------------------------------------------

function createEditorWrap(lang) {
  const div = document.createElement('div');
  div.className  = 'se-cm-editor';
  div.dataset.lang = lang;
  div.style.cssText = 'display:none; width:100%; height:100%;';
  return div;
}

function buildEditors(container, withUpdateListener) {
  // Clear previous instances
  if (editorGlsl)  { editorGlsl.destroy();  editorGlsl  = null; }
  if (editorHlsl)  { editorHlsl.destroy();  editorHlsl  = null; }
  if (editorSlang) { editorSlang.destroy(); editorSlang = null; }
  container.innerHTML = '';

  const wrapGlsl  = createEditorWrap('glsl');
  const wrapHlsl  = createEditorWrap('hlsl');
  const wrapSlang = createEditorWrap('slang');
  container.append(wrapGlsl, wrapHlsl, wrapSlang);

  const glslExtensions = withUpdateListener
    ? [...makeBaseExtensions(), makeUpdateListener()]
    : makeBaseExtensions();

  editorGlsl = new EditorView({
    state: EditorState.create({ doc: '', extensions: glslExtensions }),
    parent: wrapGlsl,
  });

  const readOnlyExtras = [EditorState.readOnly.of(true)];

  editorHlsl = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [...makeBaseExtensions(), ...readOnlyExtras],
    }),
    parent: wrapHlsl,
  });

  editorSlang = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [...makeBaseExtensions(), ...readOnlyExtras],
    }),
    parent: wrapSlang,
  });
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function showTab(lang) {
  activeTab = lang;

  // Toggle editor pane visibility
  const wrap = $('se-editor-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('.se-cm-editor').forEach(el => {
    el.style.display = el.dataset.lang === lang ? 'block' : 'none';
  });

  // Toggle tab button active state
  document.querySelectorAll('.se-tab[data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

function updateTranslations(glslSource, challenge) {
  // Prefer per-challenge hand-authored translations
  const xlat = challenge && challenge.translations;

  const hlslCode  = (xlat && xlat.hlsl  && xlat.hlsl.code)  || ShaderTranslator.translate(glslSource, 'hlsl');
  const slangCode = (xlat && xlat.slang && xlat.slang.code) || ShaderTranslator.translate(glslSource, 'slang');

  if (editorHlsl)  setEditorContent(editorHlsl,  hlslCode);
  if (editorSlang) setEditorContent(editorSlang, slangCode);
}

// ---------------------------------------------------------------------------
// Compilation + match
// ---------------------------------------------------------------------------

function compile(source) {
  if (!renderer) return { ok: false, error: 'Renderer not initialised' };
  return renderer.compileUser(source);
}

function showError(msg) {
  const bar = $('se-error-bar');
  if (!bar) return;
  if (msg) {
    // Trim verbose WebGL prefix noise
    const clean = msg.replace(/^ERROR:\s*\d+:\d+:\s*/gm, '').trim();
    bar.textContent = clean;
    bar.style.display = 'block';
  } else {
    bar.textContent = '';
    bar.style.display = 'none';
  }
}

function updateMatch(pct) {
  const el = $('se-match');
  if (!el) return;
  if (pct === null) {
    el.textContent = 'Match: —';
    el.className   = 'se-match';
  } else {
    const rounded = Math.round(pct);
    el.textContent = 'Match: ' + rounded + '%';
    el.className   = 'se-match' + (rounded >= 85 ? ' se-match--pass' : '');
  }
}

// ---------------------------------------------------------------------------
// Challenge UI rendering
// ---------------------------------------------------------------------------

function renderDots() {
  const dotsEl = $('se-dots');
  if (!dotsEl) return;

  const lesson = window._shaderEditorLesson;
  if (!lesson || !lesson.challenges) { dotsEl.innerHTML = ''; return; }

  const count  = lesson.challenges.length;
  const curIdx = ShaderChallenges.index();
  dotsEl.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const c   = lesson.challenges[i];
    const dot = document.createElement('span');
    let cls   = 'se-dot';
    if (i === curIdx)                           cls += ' se-dot--active';
    if (ShaderChallenges.isCompleted(c.id))     cls += ' se-dot--done';
    dot.className = cls;
    dot.title     = c.title || ('Challenge ' + (i + 1));
    dot.addEventListener('click', () => goToChallenge(i));
    dotsEl.appendChild(dot);
  }
}

function renderChallenge() {
  const challenge = ShaderChallenges.current();
  if (!challenge) return;

  const count = ShaderChallenges.count();
  const idx   = ShaderChallenges.index();

  // Header
  const numEl   = $('se-challenge-num');
  const titleEl = $('se-challenge-title');
  const descEl  = $('se-challenge-desc');
  if (numEl)   numEl.textContent   = 'Challenge ' + (idx + 1) + '/' + count;
  if (titleEl) titleEl.textContent = challenge.title || '';
  if (descEl)  descEl.textContent  = challenge.description || '';

  // Hints area — show already-revealed hints
  renderHints();

  // Primer
  const primerEl = $('se-primer');
  if (primerEl) {
    primerEl.textContent = challenge.primer || '';
    primerEl.style.display = 'none';
  }

  // Primer toggle visibility
  const primerToggle = $('se-primer-toggle');
  if (primerToggle) {
    primerToggle.style.display = challenge.primer ? 'flex' : 'none';
  }

  // Theory — hide until unlocked
  const theoryEl = $('se-theory');
  if (theoryEl) {
    theoryEl.style.display = 'none';
    theoryEl.textContent   = '';
  }

  // Show theory immediately if already completed
  if (ShaderChallenges.isCompleted(challenge.id)) {
    unlockTheory(challenge);
  }

  // Nav buttons
  const prevBtn = $('se-nav-prev');
  const nextBtn = $('se-nav-next');
  if (prevBtn) prevBtn.disabled = idx === 0;
  if (nextBtn) nextBtn.disabled = idx === count - 1;

  // Dots
  renderDots();

  // Load template into GLSL editor
  if (editorGlsl) {
    const code = challenge.template || '';
    setEditorContent(editorGlsl, code);
    // Trigger initial compile + translate
    onCodeChange(code, challenge);
  }

  // Show error bar hidden at challenge start
  showError('');
  updateMatch(null);
}

function renderHints() {
  const hintsEl = $('se-hints');
  if (!hintsEl) return;
  const visible = ShaderChallenges.getVisibleHints();
  if (visible.length === 0) {
    hintsEl.innerHTML = '';
    return;
  }
  hintsEl.innerHTML = visible.map((h, i) =>
    '<div class="se-hint"><span class="se-hint-num">Hint ' + (i + 1) + '</span> ' +
    escapeHtml(h) + '</div>'
  ).join('');
}

function unlockTheory(challenge) {
  const theoryEl = $('se-theory');
  if (!theoryEl) return;
  if (!challenge.unlocks_theory) return;
  theoryEl.textContent  = challenge.unlocks_theory;
  theoryEl.style.display = 'block';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------------------------------------------------------------------------
// On code change (debounced)
// ---------------------------------------------------------------------------

function onCodeChange(source, challenge) {
  const result = compile(source);

  if (!result.ok) {
    showError(result.error);
    updateMatch(null);
  } else {
    showError('');
    // Render one frame immediately to get a fresh match reading
    renderer.renderFrame();
    const pct = renderer.computeMatch();
    updateMatch(pct);
  }

  // Always update translations to reflect current code
  updateTranslations(source, challenge);
}

function scheduleCodeChange() {
  const challenge = ShaderChallenges.current();
  const source    = editorGlsl ? getEditorContent(editorGlsl) : '';
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => onCodeChange(source, challenge), 300);
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

function handleSubmit() {
  const challenge = ShaderChallenges.current();
  if (!challenge) return;

  const source = editorGlsl ? getEditorContent(editorGlsl) : '';

  // Ensure latest compile
  const result = compile(source);
  if (!result.ok) {
    showError(result.error || 'Shader did not compile.');
    return;
  }
  showError('');
  renderer.renderFrame();

  const validation = challenge.validation || 'pixel-match';

  let passed = false;

  if (validation === 'compiles') {
    passed = true;
  } else {
    // pixel-match: use animated average for fairness
    const pct = renderer.computeMatchAnimated();
    updateMatch(pct);
    passed = pct >= 85;
  }

  if (passed) {
    ShaderChallenges.markCompleted(challenge.id);
    unlockTheory(challenge);
    renderDots();

    // Visual feedback on submit button
    const btn = $('se-btn-submit');
    if (btn) {
      btn.textContent = 'Passed!';
      btn.classList.add('se-btn--passed');
      setTimeout(() => {
        btn.textContent = 'Submit';
        btn.classList.remove('se-btn--passed');
      }, 2000);
    }
  } else {
    // Nudge the user — reveal next hint automatically
    ShaderChallenges.revealNextHint();
    renderHints();

    const btn = $('se-btn-submit');
    if (btn) {
      btn.textContent = 'Not quite…';
      btn.classList.add('se-btn--fail');
      setTimeout(() => {
        btn.textContent = 'Submit';
        btn.classList.remove('se-btn--fail');
      }, 1500);
    }
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

function handleReset() {
  const challenge = ShaderChallenges.current();
  if (!challenge || !editorGlsl) return;
  setEditorContent(editorGlsl, challenge.template || '');
  showError('');
  updateMatch(null);
  onCodeChange(challenge.template || '', challenge);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function goToChallenge(idx) {
  ShaderChallenges.goTo(idx);
  renderChallenge();
}

function handlePrev() {
  ShaderChallenges.prev();
  renderChallenge();
}

function handleNext() {
  ShaderChallenges.next();
  renderChallenge();
}

// ---------------------------------------------------------------------------
// Back
// ---------------------------------------------------------------------------

function handleBack() {
  if (renderer) {
    renderer.stopLoop();
  }
  showScreen('courseBrowser');
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

let _listenersAttached = false;

function attachEventListeners() {
  if (_listenersAttached) return;
  _listenersAttached = true;

  // Tab buttons
  document.querySelectorAll('.se-tab[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.lang));
  });

  // Submit / Reset / Back
  const submitBtn = $('se-btn-submit');
  const resetBtn  = $('se-btn-reset');
  const backBtn   = $('se-btn-back');
  if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
  if (resetBtn)  resetBtn.addEventListener('click',  handleReset);
  if (backBtn)   backBtn.addEventListener('click',   handleBack);

  // Nav
  const prevBtn = $('se-nav-prev');
  const nextBtn = $('se-nav-next');
  if (prevBtn) prevBtn.addEventListener('click', handlePrev);
  if (nextBtn) nextBtn.addEventListener('click', handleNext);

  // Primer toggle
  const primerToggle = $('se-primer-toggle');
  const primerEl     = $('se-primer');
  const arrow        = primerToggle && primerToggle.querySelector('.se-primer-arrow');
  if (primerToggle && primerEl) {
    primerToggle.addEventListener('click', () => {
      const open = primerEl.style.display !== 'none';
      primerEl.style.display = open ? 'none' : 'block';
      if (arrow) arrow.textContent = open ? '\u25B6' : '\u25BC';
    });
  }
}

// ---------------------------------------------------------------------------
// CodeMirror update listener (wired per session)
// ---------------------------------------------------------------------------

function makeUpdateListener() {
  return EditorView.updateListener.of(update => {
    if (update.docChanged) scheduleCodeChange();
  });
}

// ---------------------------------------------------------------------------
// Public: load(lessonData)
// ---------------------------------------------------------------------------

function load(lessonData) {
  // Stop previous renderer if any
  if (renderer) {
    renderer.stopLoop();
    renderer = null;
  }

  // Store lesson reference for dot rendering
  window._shaderEditorLesson = lessonData;

  // Load challenges
  ShaderChallenges.load(lessonData);

  // Set up renderer
  const canvasUser   = $('se-canvas-user');
  const canvasTarget = $('se-canvas-target');
  if (!canvasUser || !canvasTarget) {
    console.error('[ShaderEditor] Canvas elements not found');
    return;
  }

  try {
    renderer = new ShaderRenderer(canvasUser, canvasTarget);
  } catch (e) {
    console.error('[ShaderEditor] Failed to create renderer:', e);
    return;
  }

  // Configure geometry if specified at lesson level
  if (lessonData.geometry) {
    renderer.setGeometry(lessonData.geometry);
  }

  // Configure uniform defaults if specified
  // uniforms is a flat string array, uniform_defaults is a separate object
  if (lessonData.uniforms) {
    renderer.setUniforms(
      lessonData.uniforms,
      lessonData.uniform_defaults || {}
    );
  }

  // Build / rebuild editors (GLSL gets the update listener on first build)
  const wrap = $('se-editor-wrap');
  if (!wrap) {
    console.error('[ShaderEditor] #se-editor-wrap not found');
    return;
  }

  buildEditors(wrap, true /* includeUpdateListener */);

  // Wire DOM events (idempotent after first call)
  attachEventListeners();

  // Show GLSL tab by default
  showTab('glsl');

  // Compile the target shader immediately so the right canvas is ready
  const firstChallenge = ShaderChallenges.current();
  if (firstChallenge && firstChallenge.solution) {
    renderer.compileTarget(firstChallenge.solution);
  }

  // Load first challenge into UI
  renderChallenge();

  // Start render loop
  renderer.startLoop();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

window.ShaderEditor = { load };
