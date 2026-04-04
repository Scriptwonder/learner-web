// === Learn Anything ===
// Upload any document, get AI-generated lessons, quizzes, and interactive teaching.
// Uses OpenAI API with user-provided key.

const LearnAnything = (function () {
  const backBtn = document.getElementById('la-back-btn');
  const settingsBtn = document.getElementById('la-settings-btn');
  const settingsPanel = document.getElementById('la-settings-panel');
  const apiKeyInput = document.getElementById('la-api-key');
  const saveKeyBtn = document.getElementById('la-save-key');
  const modelSelect = document.getElementById('la-model-select');
  const dropZone = document.getElementById('la-drop-zone');
  const fileInput = document.getElementById('la-file-input');
  const btnUpload = document.getElementById('la-btn-upload');
  const pasteText = document.getElementById('la-paste-text');
  const btnPaste = document.getElementById('la-btn-paste');
  const uploadArea = document.getElementById('la-upload-area');
  const chatArea = document.getElementById('la-chat-area');
  const messagesEl = document.getElementById('la-messages');
  const chatInput = document.getElementById('la-chat-input');
  const sendBtn = document.getElementById('la-send-btn');
  const docTitle = document.getElementById('la-doc-title');
  const docSubtitle = document.getElementById('la-doc-subtitle');
  const contentPlaceholder = document.getElementById('la-content-placeholder');
  const contentEl = document.getElementById('la-content');
  const btnGenerateLesson = document.getElementById('la-btn-generate-lesson');
  const btnGenerateQuiz = document.getElementById('la-btn-generate-quiz');
  const btnTeachMe = document.getElementById('la-btn-teach-me');
  const btnNewDoc = document.getElementById('la-btn-new-doc');

  const STORAGE_KEY = 'learner:openai-key';
  const MODEL_KEY = 'learner:openai-model';
  const DOCS_KEY = 'learner:la-documents';
  const MAX_CHAT_HISTORY = 50;

  let documentText = '';
  let documentName = '';
  let chatHistory = [];
  let isGenerating = false;
  let currentAbort = null;
  let streamUpdateTimer = null;

  function init() {
    const savedKey = localStorage.getItem(STORAGE_KEY);
    if (savedKey) apiKeyInput.value = savedKey;

    const savedModel = localStorage.getItem(MODEL_KEY);
    if (savedModel) modelSelect.value = savedModel;

    backBtn.addEventListener('click', goBack);
    settingsBtn.addEventListener('click', toggleSettings);
    saveKeyBtn.addEventListener('click', saveApiKey);
    modelSelect.addEventListener('change', () => localStorage.setItem(MODEL_KEY, modelSelect.value));
    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    btnPaste.addEventListener('click', handlePaste);
    sendBtn.addEventListener('click', sendMessage);
    btnGenerateLesson.addEventListener('click', generateLesson);
    btnGenerateQuiz.addEventListener('click', generateQuiz);
    btnTeachMe.addEventListener('click', startTeaching);
    btnNewDoc.addEventListener('click', resetDocument);

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', handleDrop);
  }

  function goBack() {
    if (currentAbort) currentAbort.abort();
    showScreen('courseBrowser');
  }

  function show() {
    showScreen('learnAnything');
    if (!localStorage.getItem(STORAGE_KEY)) {
      settingsPanel.style.display = 'block';
    }
  }

  function toggleSettings() {
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
  }

  function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) return;
    localStorage.setItem(STORAGE_KEY, key);
    saveKeyBtn.textContent = 'Saved!';
    setTimeout(() => { saveKeyBtn.textContent = 'Save'; }, 1500);
    settingsPanel.style.display = 'none';
  }

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function getModel() {
    return localStorage.getItem(MODEL_KEY) || 'gpt-4o-mini';
  }

  // --- File handling ---

  function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect() {
    const file = fileInput.files[0];
    if (file) processFile(file);
  }

  async function processFile(file) {
    documentName = file.name;
    docSubtitle.textContent = 'Loading ' + file.name + '...';

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        documentText = await extractPdfText(file);
      } else {
        documentText = await file.text();
      }

      if (!documentText.trim()) {
        docSubtitle.textContent = 'Could not extract text from file.';
        return;
      }

      onDocumentLoaded();
    } catch (err) {
      docSubtitle.textContent = 'Error reading file: ' + err.message;
    }
  }

  async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();

    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF.js not loaded. Please refresh and try again.');
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pages.push(pageText);
    }

    return pages.join('\n\n');
  }

  function handlePaste() {
    const text = pasteText.value.trim();
    if (!text) return;
    documentText = text;
    documentName = 'Pasted Text';
    const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim();
    if (firstLine.length > 0 && firstLine.length < 100) {
      documentName = firstLine;
    }
    onDocumentLoaded();
  }

  function onDocumentLoaded() {
    const wordCount = documentText.split(/\s+/).length;

    docTitle.textContent = documentName;
    docSubtitle.textContent = wordCount.toLocaleString() + ' words · ' +
      Math.ceil(wordCount / 250) + ' min read';

    uploadArea.style.display = 'none';
    chatArea.style.display = 'flex';

    chatHistory = [];
    addMessage('system', 'Document loaded: **' + escapeHtml(documentName) + '** (' +
      wordCount.toLocaleString() + ' words).\n\n' +
      'You can now:\n' +
      '- **Generate Lesson** — Create a structured lesson from this document\n' +
      '- **Generate Quiz** — Create quiz questions to test your understanding\n' +
      '- **Teach Me** — Start an interactive teaching session\n' +
      '- Or just **ask questions** about the content below');

    saveDocumentRef(wordCount);
  }

  function saveDocumentRef(wordCount) {
    try {
      const docs = JSON.parse(localStorage.getItem(DOCS_KEY) || '[]');
      docs.unshift({
        name: documentName,
        wordCount: wordCount,
        date: new Date().toISOString().slice(0, 10),
        preview: documentText.slice(0, 200)
      });
      localStorage.setItem(DOCS_KEY, JSON.stringify(docs.slice(0, 20)));
    } catch (err) {
      console.warn('Failed to save document ref:', err);
    }
  }

  function resetDocument() {
    documentText = '';
    documentName = '';
    chatHistory = [];
    messagesEl.innerHTML = '';
    contentEl.innerHTML = '';
    contentEl.style.display = 'none';
    contentPlaceholder.style.display = 'flex';
    uploadArea.style.display = 'block';
    chatArea.style.display = 'none';
    docTitle.textContent = 'Learn Anything';
    docSubtitle.textContent = 'Upload a document to start learning';
    pasteText.value = '';
    fileInput.value = '';
  }

  // --- Chat ---

  function addMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'la-msg la-msg-' + role;

    const roleLabel = document.createElement('div');
    roleLabel.className = 'la-msg-role';
    roleLabel.textContent = role === 'user' ? 'You' :
                            role === 'system' ? 'System' : 'AI Tutor';

    const body = document.createElement('div');
    body.className = 'la-msg-body';
    body.innerHTML = renderMarkdown(content);
    postRender(body);

    msgDiv.appendChild(roleLabel);
    msgDiv.appendChild(body);
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    return body;
  }

  // Light update during streaming — plain text only, no expensive post-processing
  function updateMessageStreaming(bodyEl, content) {
    bodyEl.textContent = content;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Full render with markdown + KaTeX — used once at end of streaming
  function updateMessageFinal(bodyEl, content) {
    bodyEl.innerHTML = renderMarkdown(content);
    postRender(bodyEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isGenerating) return;

    addMessage('user', text);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    chatHistory.push({ role: 'user', content: text });

    await callOpenAI(chatHistory);
  }

  // --- Content panel helper ---

  function showContent(html) {
    contentPlaceholder.style.display = 'none';
    contentEl.style.display = 'block';
    contentEl.innerHTML = html;
    postRender(contentEl);
    contentEl.scrollTop = 0;
  }

  // --- OpenAI API ---

  async function callOpenAI(messages) {
    const apiKey = getApiKey();
    if (!apiKey) {
      addMessage('system', 'Please set your OpenAI API key in settings (gear icon).');
      settingsPanel.style.display = 'block';
      return null;
    }

    isGenerating = true;
    sendBtn.disabled = true;

    const bodyEl = addMessage('assistant', '...');

    const systemPrompt = buildSystemPrompt();
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system')
    ];

    // Trim document for context window
    const maxDocChars = 80000;
    const docForContext = documentText.length > maxDocChars
      ? documentText.slice(0, maxDocChars) + '\n\n[Document truncated at ' + maxDocChars + ' characters]'
      : documentText;

    // Inject document context once at the start of the message list
    if (!apiMessages.some(m => m.content && m.content.includes('[DOCUMENT START]'))) {
      apiMessages.splice(1, 0, {
        role: 'user',
        content: '[DOCUMENT START]\n' + docForContext + '\n[DOCUMENT END]\n\nI have loaded this document. Please help me learn from it.'
      });
    }

    currentAbort = new AbortController();
    let fullResponse = '';

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: getModel(),
          messages: apiMessages,
          stream: true,
          max_tokens: 4096
        }),
        signal: currentAbort.signal
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.error?.message || ('API error: ' + resp.status);
        updateMessageFinal(bodyEl, 'Error: ' + errMsg);
        isGenerating = false;
        sendBtn.disabled = false;
        return null;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Debounced UI updates during streaming
      let pendingUpdate = false;
      const scheduleStreamUpdate = () => {
        if (pendingUpdate) return;
        pendingUpdate = true;
        streamUpdateTimer = setTimeout(() => {
          pendingUpdate = false;
          updateMessageStreaming(bodyEl, fullResponse);
        }, 80);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              scheduleStreamUpdate();
            }
          } catch {}
        }
      }

      // Clear any pending timer and do final render with full markdown + KaTeX
      clearTimeout(streamUpdateTimer);

      chatHistory.push({ role: 'assistant', content: fullResponse });
      if (chatHistory.length > MAX_CHAT_HISTORY) {
        chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
      }
      updateMessageFinal(bodyEl, fullResponse);

    } catch (err) {
      if (err.name !== 'AbortError') {
        updateMessageFinal(bodyEl, 'Error: ' + err.message);
      }
    }

    isGenerating = false;
    sendBtn.disabled = false;
    currentAbort = null;
    return fullResponse;
  }

  function buildSystemPrompt() {
    return `You are an expert tutor helping a student learn from a document they've uploaded. Your role is to:

1. Explain concepts clearly, building from fundamentals
2. Use analogies and examples to make abstract ideas concrete
3. When writing math, use LaTeX notation with $ for inline and $$ for display math
4. Use markdown formatting for clear structure
5. When asked to generate a lesson, create a well-structured lesson with headings, examples, and key takeaways
6. When asked to generate a quiz, output ONLY a valid JSON array (no markdown code fence) of question objects with this exact format:
   [{"id":1,"type":"multiple_choice","difficulty":"easy","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer_key":"B","hint":"...","explanation":"..."},...]
   Include a mix of multiple_choice and short_answer types, and easy/medium/hard difficulties.
7. When in teaching mode, use the Socratic method: ask questions, guide the student to discover answers, and build understanding incrementally
8. Always ground your responses in the actual document content
9. Be concise but thorough. Prioritize understanding over coverage.`;
  }

  // --- Generate Lesson ---

  async function generateLesson() {
    if (isGenerating || !documentText) return;

    const prompt = 'Please generate a comprehensive, well-structured lesson from this document. Include:\n' +
      '- A clear title and overview\n' +
      '- Key concepts broken into sections with ## headings\n' +
      '- Important definitions and formulas (use LaTeX for math)\n' +
      '- Examples where helpful\n' +
      '- A "Key Takeaways" section at the end\n\n' +
      'Make it engaging and easy to follow.';

    chatHistory.push({ role: 'user', content: prompt });
    addMessage('user', 'Generate a structured lesson from this document');

    const response = await callOpenAI(chatHistory);
    if (response) {
      showContent(renderMarkdown(response));
    }
  }

  // --- Generate Quiz ---

  async function generateQuiz() {
    if (isGenerating || !documentText) return;

    const prompt = 'Generate 10 quiz questions based on this document. Output ONLY a valid JSON array (no markdown code fence, no extra text). Each question object must have: id, type (multiple_choice or short_answer), difficulty (easy/medium/hard), question, hint, explanation, answer_key. For multiple_choice also include options array with "A) ...", "B) ...", etc format.';

    chatHistory.push({ role: 'user', content: prompt });
    addMessage('user', 'Generate quiz questions');

    const response = await callOpenAI(chatHistory);

    if (response) {
      try {
        let jsonStr = response.trim();
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const questions = JSON.parse(jsonStr);
        if (Array.isArray(questions) && questions.length > 0) {
          const normalized = questions.map((q, i) => ({
            ...q,
            id: q.id || i + 1,
            difficulty: q.difficulty || 'medium',
            hint: q.hint || null,
            _source: 'learn-anything'
          }));

          showContent(
            '<div class="la-quiz-ready">' +
            '<h2>Quiz Ready!</h2>' +
            '<p>' + normalized.length + ' questions generated from your document.</p>' +
            '<div class="la-quiz-preview">' +
            normalized.map((q, i) =>
              '<div class="la-quiz-item">' +
              '<span class="la-qi-num">' + (i + 1) + '.</span> ' +
              '<span class="la-qi-diff badge-' + escapeHtml(q.difficulty) + '">' + escapeHtml(q.difficulty) + '</span> ' +
              '<span class="la-qi-type">' + escapeHtml(q.type.replace('_', ' ')) + '</span>' +
              '</div>'
            ).join('') +
            '</div>' +
            '<button class="la-btn la-btn-start-quiz" id="la-btn-start-quiz">Start Quiz</button>' +
            '</div>'
          );

          document.getElementById('la-btn-start-quiz').onclick = () => launchQuiz(normalized);
        }
      } catch (e) {
        showContent(renderMarkdown(response));
      }
    }
  }

  function launchQuiz(questions) {
    appState.courseId = '__learn-anything__';
    appState.lessonId = '__generated__';
    appState.currentContent = documentText;
    appState.laQuizOverride = questions;

    showQuizSetup(questions);
  }

  // --- Teach Me (Socratic Mode) ---

  async function startTeaching() {
    if (isGenerating || !documentText) return;

    const prompt = 'Let\'s start an interactive teaching session. Begin by:\n' +
      '1. Briefly summarize what this document is about (2-3 sentences)\n' +
      '2. Identify the 3-5 most important concepts\n' +
      '3. Start teaching me the first concept using the Socratic method — ask me a question to gauge my understanding before explaining\n\n' +
      'Keep your initial response concise. We\'ll go through concepts one at a time.';

    chatHistory.push({ role: 'user', content: prompt });
    addMessage('user', 'Start an interactive teaching session');

    await callOpenAI(chatHistory);
  }

  init();

  return { show };
})();
