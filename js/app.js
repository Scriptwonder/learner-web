const screens = {
  courseBrowser: document.getElementById('course-browser-screen'),
  study: document.getElementById('study-screen'),
  quiz: document.getElementById('quiz-screen'),
  learnAnything: document.getElementById('learn-anything-screen'),
  shaderEditor: document.getElementById('shader-editor-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

const appState = {
  currentContent: null,
  questions: null,
  currentQuestionIndex: 0,
  answers: [],
  courseId: null,
  lessonId: null,
  prevLesson: null,
  nextLesson: null,
  courseManifest: null,
};

function resetState() {
  appState.currentContent = null;
  appState.questions = null;
  appState.currentQuestionIndex = 0;
  appState.answers = [];
  appState.courseId = null;
  appState.lessonId = null;
  appState.prevLesson = null;
  appState.nextLesson = null;
}

function isInCourseMode() {
  return appState.courseId !== null && appState.lessonId !== null;
}

const PROGRESS_KEY = 'learner:course-progress';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch { return {}; }
}

function saveProgress(courseId, lessonId, score, total) {
  const progress = loadProgress();
  if (!progress[courseId]) progress[courseId] = { completed: [], quizScores: {} };
  if (!progress[courseId].completed.includes(lessonId)) {
    progress[courseId].completed.push(lessonId);
  }
  progress[courseId].quizScores[lessonId] = {
    score, total, date: new Date().toISOString().slice(0, 10)
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function getLessonProgress(courseId) {
  const progress = loadProgress();
  return progress[courseId] || { completed: [], quizScores: {} };
}

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

// === URL HASH ROUTING ===

function updateHash(courseId, lessonId) {
  if (courseId && lessonId) {
    history.replaceState(null, '', '#' + courseId + '/' + lessonId);
  } else {
    history.replaceState(null, '', window.location.pathname);
  }
}

function readHash() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return null;
  const parts = hash.split('/');
  if (parts.length === 2) return { courseId: parts[0], lessonId: parts[1] };
  return null;
}

// Restore from URL on load (called after courses are loaded)
function restoreFromHash() {
  const route = readHash();
  if (route && route.courseId && route.lessonId) {
    // Wait for manifests to be loaded, then open lesson
    const check = setInterval(() => {
      if (typeof courseManifests !== 'undefined' && courseManifests[route.courseId]) {
        clearInterval(check);
        openLesson(route.courseId, route.lessonId);
      }
    }, 100);
    // Timeout after 3s
    setTimeout(() => clearInterval(check), 3000);
  }
}

window.addEventListener('hashchange', () => {
  const route = readHash();
  if (route && route.courseId && route.lessonId) {
    if (appState.courseId !== route.courseId || appState.lessonId !== route.lessonId) {
      openLesson(route.courseId, route.lessonId);
    }
  }
});
