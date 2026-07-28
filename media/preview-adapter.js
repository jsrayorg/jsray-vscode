/* =========================================================
   JSRay · VS Code Markdown preview adapter
   Re-renders fenced code blocks with JSRay Core and keeps the
   data-theme attribute in sync with the editor's light/dark UI.
   Loaded via the markdown.previewScripts contribution point.
   ========================================================= */
(function (window, document) {
  'use strict';

  function isDarkUI() {
    const cls = document.body.classList;
    return cls.contains('vscode-dark') || cls.contains('vscode-high-contrast');
  }

  function syncTheme() {
    document.body.dataset.theme = isDarkUI() ? 'dark' : 'light';
  }

  function rerender(scope) {
    if (!window.JSRay) return;
    syncTheme();
    const root = scope && scope.querySelectorAll ? scope : document;
    root.querySelectorAll('pre code').forEach(function (el) {
      // The built-in previewer may have pre-tokenized the block; JSRay reads
      // textContent, so stale spans are simply replaced. Re-render when the
      // text changed (live editing) or the block is untouched.
      const text = el.textContent || '';
      if (el.dataset.jsrayLang && el.dataset.jsraySource === text) return;
      el.dataset.jsraySource = text;
      delete el.dataset.jsrayLang;
      window.JSRay.highlightElement(el);
    });
  }

  function observe() {
    if (!window.MutationObserver || !document.body) return;
    const observer = new MutationObserver(function (records) {
      let dirty = false;
      for (const record of records) {
        if (record.type === 'attributes' && record.target === document.body) {
          dirty = true; // light/dark UI switch
          continue;
        }
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) dirty = true;
        }
      }
      if (dirty) rerender(document);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      rerender(document);
      observe();
    });
  } else {
    rerender(document);
    observe();
  }
})(window, document);
