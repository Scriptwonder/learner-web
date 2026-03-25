(function () {
  'use strict';

  let lesson = null;
  let challengeIdx = 0;
  let hintsRevealed = 0;
  let completed = new Set();

  function load(lessonData) {
    lesson = lessonData;
    challengeIdx = 0;
    hintsRevealed = 0;
    completed = new Set();
    const progress = loadLessonProgress();
    if (progress) progress.forEach(id => completed.add(id));
  }

  function current() {
    if (!lesson || !lesson.challenges) return null;
    return lesson.challenges[challengeIdx] || null;
  }

  function count() { return lesson ? lesson.challenges.length : 0; }
  function index() { return challengeIdx; }

  function goTo(idx) {
    if (idx >= 0 && idx < count()) { challengeIdx = idx; hintsRevealed = 0; }
  }

  function next() { if (challengeIdx < count() - 1) { challengeIdx++; hintsRevealed = 0; } }
  function prev() { if (challengeIdx > 0) { challengeIdx--; hintsRevealed = 0; } }

  function revealNextHint() {
    const c = current();
    if (!c) return null;
    if (hintsRevealed < c.hints.length) hintsRevealed++;
    return getVisibleHints();
  }

  function getVisibleHints() {
    const c = current();
    if (!c) return [];
    return c.hints.slice(0, hintsRevealed);
  }

  function getHintsRevealed() { return hintsRevealed; }

  function markCompleted(challengeId) {
    completed.add(challengeId);
    saveChallengeProgress();
  }

  function isCompleted(challengeId) { return completed.has(challengeId); }

  function isLessonComplete() {
    if (!lesson) return false;
    return lesson.challenges.every(c => completed.has(c.id));
  }

  // Progress persistence
  function loadLessonProgress() {
    try {
      const all = JSON.parse(localStorage.getItem('learner:shader-progress')) || {};
      return all[lesson.id] || [];
    } catch { return []; }
  }

  function saveChallengeProgress() {
    try {
      const all = JSON.parse(localStorage.getItem('learner:shader-progress')) || {};
      all[lesson.id] = Array.from(completed);
      localStorage.setItem('learner:shader-progress', JSON.stringify(all));
    } catch { /* private browsing */ }
    // Mark lesson completed in main progress if all challenges done
    if (isLessonComplete() && typeof saveProgress === 'function') {
      saveProgress(appState.courseId, lesson.id, completed.size, count());
    }
  }

  window.ShaderChallenges = {
    load, current, count, index,
    goTo, next, prev,
    revealNextHint, getVisibleHints, getHintsRevealed,
    markCompleted, isCompleted, isLessonComplete,
  };
})();
