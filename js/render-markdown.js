function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';

  const renderer = new marked.Renderer();

  renderer.code = function(codeArg) {
    // Handle both marked v12 object arg and older positional args
    const text = typeof codeArg === 'object' ? codeArg.text : codeArg;
    const lang = typeof codeArg === 'object' ? codeArg.lang : arguments[1];
    if (!text) return '<pre><code></code></pre>';

    if (lang === 'mermaid') {
      return `<div class="mermaid">${text}</div>`;
    }
    try {
      const highlighted = lang && hljs.getLanguage(lang)
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs language-${lang || 'plaintext'}">${highlighted}</code></pre>`;
    } catch (e) {
      return `<pre><code>${text}</code></pre>`;
    }
  };

  marked.setOptions({ renderer, breaks: false, gfm: true });
  try {
    return marked.parse(markdown);
  } catch (e) {
    console.warn('Markdown parse error:', e);
    return `<pre>${markdown}</pre>`;
  }
}

async function postRender(container) {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });

    // KaTeX doesn't process inside <details> since marked treats it as raw HTML.
    // Run a second pass on each <details> element's content.
    container.querySelectorAll('details').forEach(det => {
      renderMathInElement(det, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
      });
    });
  }

  // Intercept internal lesson links (e.g. ../lessons/02-foo.md) and route
  // them through the app's openLesson() instead of navigating to the raw file.
  container.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    const match = href && href.match(/(?:\.\.\/)?lessons\/([^/.]+)\.md$/);
    if (match && typeof openLesson === 'function' && appState && appState.courseId) {
      a.addEventListener('click', e => {
        e.preventDefault();
        openLesson(appState.courseId, match[1]);
      });
    }
  });

  const mermaidEls = container.querySelectorAll('.mermaid');
  if (mermaidEls.length > 0) {
    try {
      await mermaid.run({ nodes: mermaidEls });
    } catch (e) {
      console.warn('Mermaid rendering error:', e);
    }
  }
}
