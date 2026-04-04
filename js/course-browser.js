const courseList = document.getElementById('course-list');

const COURSE_IDS = ['math-for-cg', 'advanced-cg-math', 'applied-cg-math', 'hci-principles', 'shader-academy'];

const COURSE_ICONS = {
  'math-for-cg': {
    gradient: ['#4ecdc4', '#2ea89f'],
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'
  },
  'advanced-cg-math': {
    gradient: ['#8264ff', '#6244dd'],
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><line x1="2" y1="12" x2="22" y2="12"/></svg>'
  },
  'applied-cg-math': {
    gradient: ['#ff9632', '#e07818'],
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  },
  'hci-principles': {
    gradient: ['#e85d5d', '#c84040'],
    svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>'
  }
};

// Store manifests keyed by course id
const courseManifests = {};

const LEARN_ANYTHING_ICON = {
  gradient: ['#10b981', '#059669'],
  svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080b14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
};

// Load course list on page load
loadCourseList();

async function loadCourseList() {
  courseList.innerHTML = '<div class="loading-text">Loading courses...</div>';
  try {
    const results = await Promise.all(
      COURSE_IDS.map(id =>
        fetch('courses/' + id + '/course.json')
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    const manifests = results.filter(Boolean);
    if (manifests.length === 0) {
      courseList.innerHTML = '<div class="empty-state">No courses found.</div>';
      return;
    }

    courseList.innerHTML = '';

    // Learn Anything card at the top
    renderLearnAnythingCard();

    manifests.forEach(manifest => {
      manifest.lessonCount = manifest.modules.reduce((sum, m) => sum + m.lessons.length, 0);
      courseManifests[manifest.id] = manifest;
      renderCourseCard(manifest);
    });

    // Restore lesson from URL hash if present
    restoreFromHash();
  } catch (err) {
    courseList.innerHTML = '<div class="empty-state">Failed to load courses: ' + err.message + '</div>';
  }
}

function renderLearnAnythingCard() {
  const card = document.createElement('div');
  card.className = 'course-card la-card';

  let docs = [];
  try {
    const storedDocs = localStorage.getItem('learner:la-documents');
    docs = storedDocs ? JSON.parse(storedDocs) : [];
    if (!Array.isArray(docs)) docs = [];
  } catch (_) {
    docs = [];
  }
  const docCount = docs.length;
  const hasKey = !!localStorage.getItem('learner:openai-key');

  card.innerHTML =
    '<div class="course-card-header">' +
      '<div class="course-card-icon" style="background: linear-gradient(135deg, ' + LEARN_ANYTHING_ICON.gradient[0] + ', ' + LEARN_ANYTHING_ICON.gradient[1] + '); box-shadow: 0 2px 8px ' + LEARN_ANYTHING_ICON.gradient[0] + '33;">' + LEARN_ANYTHING_ICON.svg + '</div>' +
      '<div class="course-card-header-text">' +
        '<div class="course-card-title">Learn Anything</div>' +
        '<div class="course-card-meta">' + (hasKey ? 'OpenAI connected' : 'bring your own API key') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="course-card-desc">Upload any PDF, article, or text — get AI-generated lessons, quizzes, and interactive teaching sessions powered by your OpenAI API key.</div>' +
    (docCount > 0 ? '<div class="course-progress"><div class="course-progress-text">' + docCount + ' document' + (docCount !== 1 ? 's' : '') + ' studied</div></div>' : '');

  card.addEventListener('click', () => {
    if (typeof LearnAnything !== 'undefined') LearnAnything.show();
  });

  courseList.appendChild(card);
}

function renderCourseCard(course) {
  const progress = getLessonProgress(course.id);
  const completedCount = progress.completed.length;
  const totalCount = course.lessonCount;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const icon = COURSE_ICONS[course.id];

  const card = document.createElement('div');
  card.className = 'course-card';

  card.innerHTML =
    '<div class="course-card-header">' +
      (icon ? '<div class="course-card-icon" style="background: linear-gradient(135deg, ' + icon.gradient[0] + ', ' + icon.gradient[1] + '); box-shadow: 0 2px 8px ' + icon.gradient[0] + '33;">' + icon.svg + '</div>' : '') +
      '<div class="course-card-header-text">' +
        '<div class="course-card-title">' + escapeHtml(course.title) + '</div>' +
        '<div class="course-card-meta">' + totalCount + ' lessons</div>' +
      '</div>' +
    '</div>' +
    '<div class="course-card-desc">' + escapeHtml(course.description) + '</div>' +
    '<div class="course-progress">' +
      '<div class="course-progress-bar"><div class="course-progress-fill" style="width: ' + pct + '%; background: ' + (icon ? 'linear-gradient(90deg, ' + icon.gradient[0] + ', ' + icon.gradient[1] + ')' : 'linear-gradient(90deg, var(--accent), var(--accent-bright))') + '"></div></div>' +
      '<div class="course-progress-text">' + completedCount + '/' + totalCount + ' completed</div>' +
    '</div>' +
    '<div class="course-modules" style="display:none;"></div>';

  const header = card.querySelector('.course-card-header');
  const modulesDiv = card.querySelector('.course-modules');

  header.addEventListener('click', () => {
    const isExpanded = modulesDiv.style.display !== 'none';
    modulesDiv.style.display = isExpanded ? 'none' : 'block';
    card.classList.toggle('expanded', !isExpanded);
    if (!isExpanded && modulesDiv.children.length === 0) {
      renderModuleTree(modulesDiv, course, progress);
    }
  });

  courseList.appendChild(card);
}

function renderModuleTree(container, course, progress) {
  course.modules.forEach(mod => {
    const modDiv = document.createElement('div');
    modDiv.className = 'course-module';

    const modTitle = document.createElement('div');
    modTitle.className = 'course-module-title';
    modTitle.textContent = mod.title;
    modDiv.appendChild(modTitle);

    mod.lessons.forEach(lessonId => {
      const isComplete = progress.completed.includes(lessonId);
      const score = progress.quizScores[lessonId];

      const lessonDiv = document.createElement('div');
      lessonDiv.className = 'course-lesson' + (isComplete ? ' completed' : '');

      const dot = document.createElement('span');
      dot.className = 'lesson-dot' + (isComplete ? ' completed' : '');
      lessonDiv.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'lesson-name';
      name.textContent = formatLessonName(lessonId);
      lessonDiv.appendChild(name);

      if (score) {
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'lesson-score';
        scoreSpan.textContent = score.score + '/' + score.total;
        lessonDiv.appendChild(scoreSpan);
      }

      lessonDiv.addEventListener('click', () => openLesson(course.id, lessonId));
      modDiv.appendChild(lessonDiv);
    });

    container.appendChild(modDiv);
  });
}

function formatLessonName(lessonId) {
  return lessonId
    .replace(/^\d+-/, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function openLesson(courseId, lessonId) {
  try {
    const manifest = courseManifests[courseId];
    appState.courseManifest = manifest;
    const allLessons = manifest.modules.flatMap(m => m.lessons);
    const idx = allLessons.indexOf(lessonId);

    appState.courseId = courseId;
    appState.lessonId = lessonId;
    appState.prevLesson = idx > 0 ? allLessons[idx - 1] : null;
    appState.nextLesson = idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

    if (manifest.type === 'shader') {
      const resp = await fetch('courses/' + courseId + '/lessons/' + lessonId + '.json');
      if (!resp.ok) throw new Error('Lesson not found');
      const lessonData = await resp.json();
      appState.currentContent = lessonData;
      updateHash(courseId, lessonId);
      if (window.ShaderEditor) ShaderEditor.load(lessonData);
      showScreen('shaderEditor');
    } else {
      const resp = await fetch('courses/' + courseId + '/lessons/' + lessonId + '.md');
      if (!resp.ok) throw new Error('Lesson not found');
      const content = await resp.text();
      appState.currentContent = content;
      renderStudyContent(content, false);
      updateStudyForCourseMode();
      showScreen('study');
      document.getElementById('study-content').scrollTop = 0;
      updateHash(courseId, lessonId);
      if (window.Visualizer) Visualizer.load(lessonId, courseId);
    }
  } catch (err) {
    alert('Failed to load lesson: ' + err.message);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
