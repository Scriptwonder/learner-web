const studyContent = document.getElementById('study-content');
const tocList = document.getElementById('toc-list');
const btnQuizFromStudy = document.getElementById('btn-quiz-from-study');

let renderDebounce = null;

function renderStudyContent(markdown, isStreaming) {
  if (isStreaming) {
    if (renderDebounce) clearTimeout(renderDebounce);
    renderDebounce = setTimeout(() => {
      studyContent.innerHTML = renderMarkdown(markdown);
      postRender(studyContent);
      buildToc();
    }, 100);
  } else {
    if (renderDebounce) clearTimeout(renderDebounce);
    studyContent.innerHTML = renderMarkdown(markdown);
    postRender(studyContent);
    buildToc();
  }
}

function buildToc() {
  const headings = studyContent.querySelectorAll('h1, h2, h3');
  tocList.innerHTML = '';
  headings.forEach((h, i) => {
    const id = 'heading-' + i;
    h.id = id;
    const depth = parseInt(h.tagName[1]);
    const item = document.createElement('a');
    item.className = 'toc-item' + (depth >= 3 ? ' depth-2' : '');
    item.textContent = h.textContent;
    item.href = '#';
    item.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth' });
    });
    tocList.appendChild(item);
  });
}

function updateStudyForCourseMode() {
  // Remove old course nav elements
  const oldBackBtn = document.getElementById('btn-back-to-course');
  if (oldBackBtn) oldBackBtn.remove();
  const oldLessonNav = document.getElementById('lesson-nav');
  if (oldLessonNav) oldLessonNav.remove();

  // Always show "Back to Course" (web version is always course mode)
  const backBtn = document.createElement('button');
  backBtn.id = 'btn-back-to-course';
  backBtn.className = 'btn-secondary btn-new-topic';
  backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back to Course';
  backBtn.classList.add('btn-icon');
  backBtn.addEventListener('click', () => {
    resetState();
    studyContent.innerHTML = '';
    tocList.innerHTML = '';
    if (window.Visualizer) Visualizer.hide();
    updateHash(null, null);
    showScreen('courseBrowser');
    loadCourseList();
  });
  const sidebar = document.querySelector('.study-sidebar');
  sidebar.insertBefore(backBtn, sidebar.firstChild);

  // Prev/next lesson nav at bottom of content
  const nav = document.createElement('div');
  nav.id = 'lesson-nav';
  nav.className = 'lesson-nav';

  if (appState.prevLesson) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn-secondary lesson-nav-btn';
    prevBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> ' + formatLessonName(appState.prevLesson);
    prevBtn.classList.add('btn-icon');
    prevBtn.addEventListener('click', () => openLesson(appState.courseId, appState.prevLesson));
    nav.appendChild(prevBtn);
  } else {
    nav.appendChild(document.createElement('span'));
  }

  if (appState.nextLesson) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-study lesson-nav-btn';
    nextBtn.innerHTML = formatLessonName(appState.nextLesson) + ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    nextBtn.classList.add('btn-icon');
    nextBtn.addEventListener('click', () => openLesson(appState.courseId, appState.nextLesson));
    nav.appendChild(nextBtn);
  }

  studyContent.appendChild(nav);
}

// Quiz from study — load pool and show setup screen
btnQuizFromStudy.addEventListener('click', async () => {
  if (!appState.lessonId) return;
  try {
    const questions = await loadQuestions(appState.courseId, appState.lessonId);
    if (!questions || questions.length === 0) throw new Error('No questions found');
    showQuizSetup(questions);
  } catch (err) {
    alert('Could not load quiz: ' + err.message);
  }
});
