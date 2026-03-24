// === Theme Toggle ===
// Detects system preference, persists choice, animated transition.

(function() {
  const STORAGE_KEY = 'learner:theme';
  const toggle = document.getElementById('theme-toggle');

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function getStoredTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  function applyTheme(theme, animate) {
    if (animate) {
      toggle.classList.add('animating');
      setTimeout(() => {
        document.documentElement.setAttribute('data-theme', theme);
        setTimeout(() => toggle.classList.remove('animating'), 50);
      }, 200);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }

  // Initialize
  const stored = getStoredTheme();
  const initial = stored || getSystemTheme();
  applyTheme(initial, false);

  // Toggle click
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    saveTheme(next);
  });

  // Listen for system theme changes (if no manual override)
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!getStoredTheme()) {
      applyTheme(e.matches ? 'light' : 'dark', true);
    }
  });
})();
