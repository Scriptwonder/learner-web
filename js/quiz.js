// === Quiz Engine v2 ===
// Supports: question pools, random selection, difficulty tiers,
// hints, spaced review, and module assessments.

const quizSetup = document.getElementById('quiz-setup');
const quizActive = document.getElementById('quiz-active');
const quizSetupLesson = document.getElementById('quiz-setup-lesson');
const quizModeSelector = document.getElementById('quiz-mode-selector');
const quizCountSelector = document.getElementById('quiz-count-selector');
const includeReviewCheckbox = document.getElementById('include-review');
const btnStartQuiz = document.getElementById('btn-start-quiz');

const quizCurrent = document.getElementById('quiz-current');
const quizTotal = document.getElementById('quiz-total');
const quizProgressBar = document.getElementById('quiz-progress-bar');
const quizTypeLabel = document.getElementById('quiz-type-label');
const quizDifficultyBadge = document.getElementById('quiz-difficulty-badge');
const quizReviewBadge = document.getElementById('quiz-review-badge');
const quizQuestion = document.getElementById('quiz-question');
const quizAnswerArea = document.getElementById('quiz-answer-area');
const quizActionRow = document.getElementById('quiz-action-row');
const btnHint = document.getElementById('btn-hint');
const btnSubmitAnswer = document.getElementById('btn-submit-answer');
const quizHintArea = document.getElementById('quiz-hint-area');
const quizFeedback = document.getElementById('quiz-feedback');
const quizNextRow = document.getElementById('quiz-next-row');
const btnNextQuestion = document.getElementById('btn-next-question');
const btnViewStudy = document.getElementById('btn-view-study');

// Quiz config state
const quizConfig = {
  mode: 'practice',   // practice | test | challenge
  count: 10,
  includeReview: true,
};

// Quiz session state
const quizSession = {
  allPoolQuestions: [],  // full question bank for current lesson
  questions: [],         // selected questions for this session
  currentIndex: 0,
  answers: [],
  hintUsed: [],
};

// === SETUP PHASE ===

// Mode selector
quizModeSelector.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  quizModeSelector.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  quizConfig.mode = btn.dataset.mode;

  // Hide hint toggle in test/challenge
  const hintNote = quizConfig.mode === 'practice' ? '' : ' (no hints)';
  btnHint.style.display = 'none';
});

// Count selector
quizCountSelector.addEventListener('click', (e) => {
  const btn = e.target.closest('.count-btn');
  if (!btn) return;
  quizCountSelector.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  quizConfig.count = btn.dataset.count === 'all' ? Infinity : parseInt(btn.dataset.count);
});

// Review toggle
includeReviewCheckbox.addEventListener('change', () => {
  quizConfig.includeReview = includeReviewCheckbox.checked;
});

// Start quiz
btnStartQuiz.addEventListener('click', async () => {
  await buildQuizSession();
  if (quizSession.questions.length === 0) {
    alert('No questions available.');
    return;
  }
  quizSetup.style.display = 'none';
  quizActive.style.display = 'flex';
  quizSession.currentIndex = 0;
  quizSession.answers = [];
  quizSession.hintUsed = [];
  renderQuestion();
});

// === QUESTION SELECTION ===

async function buildQuizSession() {
  // Load main lesson questions
  const mainQuestions = await loadQuestions(appState.courseId, appState.lessonId);
  quizSession.allPoolQuestions = mainQuestions;

  // Tag each with source
  mainQuestions.forEach(q => {
    q._source = 'current';
    q._lessonId = appState.lessonId;
  });

  // Filter by difficulty based on mode
  let filtered;
  if (quizConfig.mode === 'challenge') {
    filtered = mainQuestions.filter(q => q.difficulty === 'hard');
    // If not enough hard questions, include medium
    if (filtered.length < 3) {
      filtered = mainQuestions.filter(q => q.difficulty === 'hard' || q.difficulty === 'medium');
    }
  } else if (quizConfig.mode === 'test') {
    filtered = [...mainQuestions]; // all difficulties
  } else {
    // Practice: mostly easy + medium, sprinkle hard
    const easyMed = mainQuestions.filter(q => q.difficulty !== 'hard');
    const hard = mainQuestions.filter(q => q.difficulty === 'hard');
    filtered = [...easyMed, ...hard.slice(0, 2)];
  }

  // Determine question count
  let targetCount = Math.min(quizConfig.count, filtered.length);

  // Shuffle and pick
  shuffle(filtered);
  let selected = filtered.slice(0, targetCount);

  // Add review questions if enabled
  if (quizConfig.includeReview && quizConfig.mode !== 'challenge') {
    const reviewQuestions = await getReviewQuestions(2);
    selected = [...selected, ...reviewQuestions];
  }

  // Final shuffle
  shuffle(selected);
  quizSession.questions = selected;
}

async function loadQuestions(courseId, lessonId) {
  if (courseId === '__learn-anything__' && appState.laQuizOverride) {
    const raw = appState.laQuizOverride;
    appState.laQuizOverride = null;
    return raw.map((q, i) => ({
      ...q,
      id: q.id || i + 1,
      type: typeof q.type === 'string' ? q.type : 'short_answer',
      difficulty: q.difficulty || 'medium',
      hint: q.hint || null,
      answer_key: q.answer_key || '',
    }));
  }

  try {
    const resp = await fetch('courses/' + courseId + '/quizzes/' + lessonId + '.json');
    if (!resp.ok) return [];
    const data = await resp.json();
    // Normalize: ensure difficulty field exists
    return data.map((q, i) => ({
      ...q,
      id: q.id || i + 1,
      difficulty: q.difficulty || 'medium',
      hint: q.hint || null,
    }));
  } catch { return []; }
}

async function getReviewQuestions(count) {
  const progress = loadProgress();
  const courseProgress = progress[appState.courseId];
  if (!courseProgress || courseProgress.completed.length === 0) return [];

  // Pick from completed lessons (not the current one)
  const completedLessons = courseProgress.completed.filter(id => id !== appState.lessonId);
  if (completedLessons.length === 0) return [];

  // Shuffle completed lessons and try to pull 1 question from each
  shuffle(completedLessons);
  const reviewPool = [];

  for (const lessonId of completedLessons.slice(0, count * 2)) {
    const questions = await loadQuestions(appState.courseId, lessonId);
    if (questions.length > 0) {
      const q = questions[Math.floor(Math.random() * questions.length)];
      q._source = 'review';
      q._lessonId = lessonId;
      // Prefer easy/medium for review
      if (q.difficulty !== 'hard' || reviewPool.length < count) {
        reviewPool.push(q);
      }
    }
    if (reviewPool.length >= count) break;
  }

  return reviewPool.slice(0, count);
}

// === RENDERING ===

function renderQuestion() {
  const q = quizSession.questions[quizSession.currentIndex];
  if (!q) return;

  quizCurrent.textContent = quizSession.currentIndex + 1;
  quizTotal.textContent = quizSession.questions.length;

  // Progress bar
  quizProgressBar.innerHTML = '';
  quizSession.questions.forEach((_, i) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    if (quizSession.answers[i]) {
      bar.classList.add(quizSession.answers[i].correct ? 'correct' : 'incorrect');
    } else if (i === quizSession.currentIndex) {
      bar.classList.add('current');
    }
    quizProgressBar.appendChild(bar);
  });

  // Type label
  const typeLabels = {
    multiple_choice: 'Multiple Choice',
    short_answer: 'Short Answer',
    free_response: 'Free Response',
    multi_step: 'Multi-Step',
  };
  quizTypeLabel.textContent = typeLabels[q.type] || q.type;

  // Difficulty badge
  const diffColors = { easy: 'badge-easy', medium: 'badge-medium', hard: 'badge-hard' };
  quizDifficultyBadge.className = 'quiz-difficulty-badge ' + (diffColors[q.difficulty] || '');
  quizDifficultyBadge.textContent = (q.difficulty || 'medium').charAt(0).toUpperCase() + (q.difficulty || 'medium').slice(1);

  // Review badge
  quizReviewBadge.style.display = q._source === 'review' ? 'inline-block' : 'none';

  // Question text
  quizQuestion.innerHTML = renderMarkdown(q.question);
  postRender(quizQuestion);

  // Answer area
  quizAnswerArea.innerHTML = '';
  if (q.type === 'multiple_choice' && q.options) {
    renderMCOptions(q);
  } else if (q.type === 'multi_step' && q.steps) {
    renderMultiStep(q);
  } else {
    renderTextInput(q);
  }

  // Hint button
  quizHintArea.style.display = 'none';
  quizHintArea.innerHTML = '';
  if (q.hint && quizConfig.mode === 'practice') {
    btnHint.style.display = 'inline-flex';
    btnHint.disabled = false;
    btnHint.textContent = 'Show Hint';
  } else {
    btnHint.style.display = 'none';
  }

  // Action row
  quizActionRow.style.display = 'flex';
  btnSubmitAnswer.disabled = false;
  quizFeedback.innerHTML = '';
  quizNextRow.style.display = 'none';
}

function renderMCOptions(q) {
  const optionsDiv = document.createElement('div');
  optionsDiv.className = 'mc-options';
  q.options.forEach((opt) => {
    const optionDiv = document.createElement('label');
    optionDiv.className = 'mc-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'mc-answer';
    radio.value = opt;
    const text = document.createElement('span');
    text.innerHTML = renderMarkdown(opt);
    optionDiv.appendChild(radio);
    optionDiv.appendChild(text);
    postRender(text);
    optionDiv.addEventListener('click', () => {
      document.querySelectorAll('.mc-option').forEach(o => o.classList.remove('selected'));
      optionDiv.classList.add('selected');
    });
    optionsDiv.appendChild(optionDiv);
  });
  quizAnswerArea.appendChild(optionsDiv);
}

function renderTextInput(q) {
  const textarea = document.createElement('textarea');
  textarea.className = 'quiz-answer-input';
  textarea.placeholder = q.type === 'short_answer'
    ? 'Type your answer...'
    : 'Write your response...';
  if (q.type === 'free_response') textarea.style.minHeight = '120px';
  quizAnswerArea.appendChild(textarea);
}

function renderMultiStep(q) {
  const container = document.createElement('div');
  container.className = 'multi-step-container';

  q.steps.forEach((step, i) => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'multi-step-item';
    stepDiv.dataset.stepIndex = i;

    const stepLabel = document.createElement('div');
    stepLabel.className = 'multi-step-label';
    stepLabel.innerHTML = '<span class="step-number">Step ' + (i + 1) + '</span>';

    const stepPrompt = document.createElement('div');
    stepPrompt.className = 'multi-step-prompt';
    stepPrompt.innerHTML = renderMarkdown(step.prompt);

    const stepInput = document.createElement('input');
    stepInput.type = 'text';
    stepInput.className = 'multi-step-input';
    stepInput.placeholder = 'Your answer...';
    stepInput.dataset.stepIndex = i;

    const stepFeedback = document.createElement('div');
    stepFeedback.className = 'multi-step-feedback';

    stepDiv.appendChild(stepLabel);
    stepDiv.appendChild(stepPrompt);
    stepDiv.appendChild(stepInput);
    stepDiv.appendChild(stepFeedback);
    container.appendChild(stepDiv);
  });

  quizAnswerArea.appendChild(container);

  // Post-render math in step prompts
  container.querySelectorAll('.multi-step-prompt').forEach(el => postRender(el));
}

// === HINT ===

btnHint.addEventListener('click', () => {
  const q = quizSession.questions[quizSession.currentIndex];
  if (!q || !q.hint) return;

  quizHintArea.style.display = 'block';
  quizHintArea.innerHTML = '<div class="hint-card"><span class="hint-icon">&#128161;</span> ' + q.hint + '</div>';
  postRender(quizHintArea);
  quizSession.hintUsed[quizSession.currentIndex] = true;
  btnHint.disabled = true;
  btnHint.textContent = 'Hint shown';
});

// === GRADING ===

function getUserAnswer() {
  const q = quizSession.questions[quizSession.currentIndex];
  if (q.type === 'multiple_choice') {
    const selected = document.querySelector('input[name="mc-answer"]:checked');
    return selected ? selected.value : '';
  }
  if (q.type === 'multi_step') {
    const inputs = quizAnswerArea.querySelectorAll('.multi-step-input');
    return Array.from(inputs).map(inp => inp.value.trim());
  }
  const textarea = quizAnswerArea.querySelector('textarea');
  return textarea ? textarea.value.trim() : '';
}

function gradeAnswer(question, userAnswer) {
  const q = question;

  if (q.type === 'multi_step' && q.steps) {
    return gradeMultiStep(q, userAnswer);
  }

  const key = (q.answer_key || '').trim();
  const answer = (typeof userAnswer === 'string' ? userAnswer : '').trim();

  if (q.type === 'multiple_choice') {
    const userLetter = answer.charAt(0).toUpperCase();
    const keyLetter = key.charAt(0).toUpperCase();
    return {
      correct: userLetter === keyLetter,
      explanation: q.explanation || ''
    };
  }

  if (q.type === 'short_answer') {
    const normUser = answer.toLowerCase().replace(/\s+/g, ' ');
    const normKey = key.toLowerCase().replace(/\s+/g, ' ');

    if (normUser === normKey) return { correct: true, explanation: q.explanation || '' };
    if (normUser.includes(normKey)) return { correct: true, explanation: q.explanation || '' };

    const numUser = parseFloat(normUser);
    const numKey = parseFloat(normKey);
    if (!isNaN(numUser) && !isNaN(numKey) && Math.abs(numUser - numKey) < 0.01) {
      return { correct: true, explanation: q.explanation || '' };
    }

    return { correct: false, explanation: q.explanation || '' };
  }

  // Free response — always show explanation
  return { correct: true, explanation: q.explanation || 'See the model answer above.' };
}

function gradeMultiStep(q, answers) {
  if (!Array.isArray(answers)) return { correct: false, explanation: q.explanation || '', stepResults: [] };

  const stepResults = q.steps.map((step, i) => {
    const userAns = (answers[i] || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const key = (step.answer_key || '').trim().toLowerCase().replace(/\s+/g, ' ');

    let correct = userAns === key || userAns.includes(key);
    if (!correct) {
      const numUser = parseFloat(userAns);
      const numKey = parseFloat(key);
      if (!isNaN(numUser) && !isNaN(numKey) && Math.abs(numUser - numKey) < 0.01) {
        correct = true;
      }
    }
    return { correct, explanation: step.explanation || '' };
  });

  const allCorrect = stepResults.every(r => r.correct);
  return {
    correct: allCorrect,
    explanation: q.explanation || '',
    stepResults
  };
}

// === SUBMIT ===

btnSubmitAnswer.addEventListener('click', () => {
  const answer = getUserAnswer();
  const q = quizSession.questions[quizSession.currentIndex];

  // Validate non-empty
  if (q.type === 'multi_step') {
    if (!answer.some(a => a.length > 0)) return;
  } else {
    if (!answer) return;
  }

  btnSubmitAnswer.disabled = true;
  btnHint.style.display = 'none';

  const result = gradeAnswer(q, answer);
  quizSession.answers[quizSession.currentIndex] = result;

  // Show multi-step per-step feedback
  if (q.type === 'multi_step' && result.stepResults) {
    result.stepResults.forEach((sr, i) => {
      const stepDiv = quizAnswerArea.querySelector('[data-step-index="' + i + '"].multi-step-item');
      if (!stepDiv) return;
      const fb = stepDiv.querySelector('.multi-step-feedback');
      fb.innerHTML = sr.correct
        ? '<span class="step-correct">&#10003; Correct</span>'
        : '<span class="step-incorrect">&#10007; ' + sr.explanation + '</span>';
      const input = stepDiv.querySelector('.multi-step-input');
      input.classList.add(sr.correct ? 'step-input-correct' : 'step-input-incorrect');
    });
  }

  // Feedback card
  const card = document.createElement('div');
  card.className = 'feedback-card ' + (result.correct ? 'correct' : 'incorrect');

  const verdict = document.createElement('div');
  verdict.className = 'feedback-verdict ' + (result.correct ? 'correct' : 'incorrect');
  verdict.innerHTML = result.correct
    ? '<span style="font-size:18px">&#10003;</span> Correct'
    : '<span style="font-size:18px">&#10007;</span> Incorrect';

  // Show hint penalty note in practice mode
  if (result.correct && quizSession.hintUsed[quizSession.currentIndex] && quizConfig.mode === 'practice') {
    verdict.innerHTML += ' <span class="hint-penalty">(hint used)</span>';
  }

  const explanation = document.createElement('div');
  explanation.className = 'feedback-explanation';
  explanation.innerHTML = renderMarkdown(result.explanation);
  postRender(explanation);

  card.appendChild(verdict);
  card.appendChild(explanation);
  quizFeedback.innerHTML = '';
  quizFeedback.appendChild(card);

  renderProgressBar();

  quizActionRow.style.display = 'none';
  quizNextRow.style.display = 'flex';

  if (quizSession.currentIndex >= quizSession.questions.length - 1) {
    btnNextQuestion.textContent = 'See Results';
  } else {
    btnNextQuestion.textContent = 'Next';
  }
});

function renderProgressBar() {
  const bars = quizProgressBar.querySelectorAll('.bar');
  bars.forEach((bar, i) => {
    bar.className = 'bar';
    if (quizSession.answers[i]) {
      bar.classList.add(quizSession.answers[i].correct ? 'correct' : 'incorrect');
    } else if (i === quizSession.currentIndex) {
      bar.classList.add('current');
    }
  });
}

// === NAVIGATION ===

btnNextQuestion.addEventListener('click', () => {
  if (quizSession.currentIndex >= quizSession.questions.length - 1) {
    showQuizComplete();
  } else {
    quizSession.currentIndex++;
    renderQuestion();
  }
});

// === COMPLETE ===

function showQuizComplete() {
  const correct = quizSession.answers.filter(a => a && a.correct).length;
  const total = quizSession.questions.length;
  const hintsUsed = quizSession.hintUsed.filter(Boolean).length;

  // Save progress
  if (isInCourseMode()) {
    saveProgress(appState.courseId, appState.lessonId, correct, total);
  }

  // Save wrong answers for future review weighting
  saveWrongAnswers();

  quizActive.style.display = 'none';

  const complete = document.createElement('div');
  complete.className = 'quiz-complete';
  complete.id = 'quiz-complete-overlay';

  const pct = Math.round((correct / total) * 100);
  let verdict = '';
  if (pct === 100) verdict = 'Perfect score!';
  else if (pct >= 80) verdict = 'Great work!';
  else if (pct >= 60) verdict = 'Good effort — review the missed topics.';
  else verdict = 'Keep studying — you\'ll get there.';

  complete.innerHTML =
    '<h2>Quiz Complete</h2>' +
    '<div class="quiz-score">' + correct + '/' + total + '</div>' +
    '<div class="quiz-score-label">' + verdict + '</div>' +
    (hintsUsed > 0 ? '<div class="quiz-hints-used">' + hintsUsed + ' hint' + (hintsUsed > 1 ? 's' : '') + ' used</div>' : '') +
    '<div class="quiz-mode-tag">' + quizConfig.mode.charAt(0).toUpperCase() + quizConfig.mode.slice(1) + ' mode</div>';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:28px;';

  const btnRetry = document.createElement('button');
  btnRetry.className = 'btn-secondary';
  btnRetry.textContent = 'Try Again';
  btnRetry.addEventListener('click', () => {
    complete.remove();
    resetQuizUI();
    quizSetup.style.display = 'flex';
  });

  const btnViewStudyComplete = document.createElement('button');
  btnViewStudyComplete.className = 'btn-secondary';
  btnViewStudyComplete.textContent = 'Study Material';
  btnViewStudyComplete.addEventListener('click', () => {
    complete.remove();
    resetQuizUI();
    if (appState.currentContent) {
      renderStudyContent(appState.currentContent, false);
      updateStudyForCourseMode();
      showScreen('study');
    }
  });

  const isLA = appState.courseId === '__learn-anything__';
  const btnBackToCourse = document.createElement('button');
  btnBackToCourse.className = 'btn-study';
  btnBackToCourse.textContent = isLA ? 'Back to Document' : 'Back to Course';
  btnBackToCourse.addEventListener('click', () => {
    complete.remove();
    resetQuizUI();
    if (isLA) {
      resetState();
      showScreen('learnAnything');
    } else {
      resetState();
      showScreen('courseBrowser');
      loadCourseList();
    }
  });

  btnRow.appendChild(btnRetry);
  btnRow.appendChild(btnViewStudyComplete);
  btnRow.appendChild(btnBackToCourse);
  complete.appendChild(btnRow);
  document.getElementById('quiz-screen').appendChild(complete);
}

function saveWrongAnswers() {
  const WRONG_KEY = 'learner:wrong-answers';
  let wrong = {};
  try { wrong = JSON.parse(localStorage.getItem(WRONG_KEY)) || {}; } catch {}

  const courseId = appState.courseId;
  const lessonId = appState.lessonId;
  if (!wrong[courseId]) wrong[courseId] = {};

  quizSession.questions.forEach((q, i) => {
    if (quizSession.answers[i] && !quizSession.answers[i].correct && q._source === 'current') {
      if (!wrong[courseId][lessonId]) wrong[courseId][lessonId] = [];
      if (!wrong[courseId][lessonId].includes(q.id)) {
        wrong[courseId][lessonId].push(q.id);
      }
    }
  });

  localStorage.setItem(WRONG_KEY, JSON.stringify(wrong));
}

// === UI RESET ===

function resetQuizUI() {
  const overlay = document.getElementById('quiz-complete-overlay');
  if (overlay) overlay.remove();
  quizActive.style.display = 'none';
  quizSetup.style.display = 'flex';
  quizFeedback.innerHTML = '';
  quizHintArea.style.display = 'none';
  quizHintArea.innerHTML = '';
  quizNextRow.style.display = 'none';
}

// === ENTRY POINT (from study.js) ===
// This replaces the old direct quiz start. Now we show setup first.

function showQuizSetup(questions) {
  quizSession.allPoolQuestions = questions;
  quizSetupLesson.textContent = formatLessonName(appState.lessonId);

  // Update count buttons based on pool size
  const poolSize = questions.length;
  quizCountSelector.querySelectorAll('.count-btn').forEach(btn => {
    const count = btn.dataset.count === 'all' ? Infinity : parseInt(btn.dataset.count);
    btn.style.display = count > poolSize && count !== Infinity ? 'none' : '';
  });

  resetQuizUI();
  quizSetup.style.display = 'flex';
  quizActive.style.display = 'none';
  showScreen('quiz');
}

// === VIEW STUDY from quiz ===
btnViewStudy.addEventListener('click', () => {
  if (appState.currentContent) {
    renderStudyContent(appState.currentContent, false);
    updateStudyForCourseMode();
    showScreen('study');
  }
});

// === UTILITY ===

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
