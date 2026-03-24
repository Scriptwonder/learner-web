const courseList = document.getElementById('course-list');

const COURSE_IDS = ['math-for-cg', 'advanced-cg-math'];

// Store manifests keyed by course id
const courseManifests = {};

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
    manifests.forEach(manifest => {
      manifest.lessonCount = manifest.modules.reduce((sum, m) => sum + m.lessons.length, 0);
      courseManifests[manifest.id] = manifest;
      renderCourseCard(manifest);
    });
  } catch (err) {
    courseList.innerHTML = '<div class="empty-state">Failed to load courses: ' + err.message + '</div>';
  }
}

function renderCourseCard(course) {
  const progress = getLessonProgress(course.id);
  const completedCount = progress.completed.length;
  const totalCount = course.lessonCount;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const card = document.createElement('div');
  card.className = 'course-card';

  card.innerHTML =
    '<div class="course-card-header">' +
      '<div class="course-card-title">' + escapeHtml(course.title) + '</div>' +
      '<div class="course-card-meta">' + totalCount + ' lessons</div>' +
    '</div>' +
    '<div class="course-card-desc">' + escapeHtml(course.description) + '</div>' +
    '<div class="course-progress">' +
      '<div class="course-progress-bar"><div class="course-progress-fill" style="width: ' + pct + '%"></div></div>' +
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
    const resp = await fetch('courses/' + courseId + '/lessons/' + lessonId + '.md');
    if (!resp.ok) throw new Error('Lesson not found');
    const content = await resp.text();

    // Use the cached manifest for the specific course
    const manifest = courseManifests[courseId];
    appState.courseManifest = manifest;
    const allLessons = manifest.modules.flatMap(m => m.lessons);
    const idx = allLessons.indexOf(lessonId);

    appState.currentContent = content;
    appState.courseId = courseId;
    appState.lessonId = lessonId;
    appState.prevLesson = idx > 0 ? allLessons[idx - 1] : null;
    appState.nextLesson = idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

    renderStudyContent(content, false);
    updateStudyForCourseMode();
    showScreen('study');
    // Scroll to top
    document.getElementById('study-content').scrollTop = 0;
    // Load 3D visualization
    if (window.Visualizer) Visualizer.load(lessonId);
  } catch (err) {
    alert('Failed to load lesson: ' + err.message);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
