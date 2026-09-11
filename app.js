/* =========================================================
   LEVERMAKE — shared site script
   Included on every page. Handles three independent jobs:
     1. custom cursor + cursor-driven fresco reveal
     2. simple single-field editable text (nav, headings, footer)
     3. generic editable "collections" — ordered lists of rows
        (links / projects / blog posts) where BOTH the label text
        and the destination URL are click-to-edit, with add/remove.
   Everything persists to sessionStorage only: it lives for as
   long as this browser tab is open, per Levermake's request that
   nothing needs a server or a database to be editable.
========================================================= */

(function () {
  'use strict';

  const PREFIX = 'levermake:';

  /* =========================================================
     1) CUSTOM CURSOR + BACKGROUND-REVEAL TRACKING
     ---------------------------------------------------------
     One mousemove listener drives the visible cursor graphics
     AND the --mx/--my CSS variables the fresco mask reads. The
     expensive part (writing the vars, which repaints the mask)
     is throttled to once per animation frame.
  ========================================================= */
  function initCursorAndFresco() {
    const root = document.documentElement;
    const cursorDot = document.getElementById('cursorDot');
    const cursorRing = document.getElementById('cursorRing');
    if (!cursorDot || !cursorRing) return; // page has no fresco/cursor markup

    let latestX = window.innerWidth / 2;
    let latestY = window.innerHeight / 2;
    let ticking = false;

    function paint() {
      const xPct = (latestX / window.innerWidth) * 100;
      const yPct = (latestY / window.innerHeight) * 100;
      root.style.setProperty('--mx', xPct + '%');
      root.style.setProperty('--my', yPct + '%');
      cursorDot.style.transform = `translate(${latestX}px, ${latestY}px) translate(-50%, -50%)`;
      cursorRing.style.transform = `translate(${latestX}px, ${latestY}px) translate(-50%, -50%)`;
      ticking = false;
    }

    window.addEventListener('mousemove', (e) => {
      latestX = e.clientX;
      latestY = e.clientY;
      if (!ticking) {
        requestAnimationFrame(paint);
        ticking = true;
      }
    }, { passive: true });

    paint();

    const instructions = document.getElementById('instructions');
    if (instructions) setTimeout(() => instructions.classList.add('fade'), 400);

    // Widen the cursor ring over any editable node — a lightweight
    // hint that doesn't need a tooltip. Exposed globally so rows
    // built later by initCollection() can opt in too.
    function bindHoverRing(el) {
      el.addEventListener('mouseenter', () => document.body.classList.add('hover-editable'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('hover-editable'));
    }
    document.querySelectorAll('[contenteditable="true"]').forEach(bindHoverRing);
    window.__levermakeBindHoverRing = bindHoverRing;
  }

  /* =========================================================
     2) SIMPLE SINGLE-FIELD EDITABLE TEXT
     ---------------------------------------------------------
     Any element marked data-simple-editable + data-key gets its
     text saved to sessionStorage on edit and restored on load.
     Used for nav labels, page headings, intros, footer text —
     fields that exist exactly once on the page.
  ========================================================= */
  function initSimpleEditableFields() {
    const nodes = document.querySelectorAll('[data-simple-editable][data-key]');
    nodes.forEach((el) => {
      const key = PREFIX + el.dataset.key;
      const saved = sessionStorage.getItem(key);
      if (saved !== null) el.innerText = saved;

      let timer;
      const save = () => {
        clearTimeout(timer);
        timer = setTimeout(() => sessionStorage.setItem(key, el.innerText), 200);
      };
      el.addEventListener('input', save);
      el.addEventListener('blur', save);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && el.tagName !== 'P') {
          e.preventDefault();
          el.blur();
        }
      });
    });
  }

  /* =========================================================
     3) URL NORMALIZATION
     ---------------------------------------------------------
     Lets people type "github.com/levermake" instead of a full
     https:// URL and still get a working link.
  ========================================================= */
  function normalizeUrl(raw) {
    const text = (raw || '').trim();
    if (!text) return '#';
    if (/^(https?:|mailto:|tel:)/i.test(text)) return text;
    if (text.startsWith('/') || text.endsWith('.html')) return text; // internal page
    return 'https://' + text;
  }

  /* =========================================================
     4) GENERIC EDITABLE COLLECTION
     ---------------------------------------------------------
     Renders an ordered array of items into a container using a
     supplied renderItem() row-builder, keeps the whole array in
     sessionStorage as one JSON blob (so add/remove/reorder is
     trivial), and re-renders on any change.
  ========================================================= */
  function initCollection(opts) {
    const { container, storageKey, defaults, renderItem, addButtonLabel, newItem } = opts;
    if (!container) return;

    let items;
    try {
      const raw = sessionStorage.getItem(PREFIX + storageKey);
      items = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(defaults));
    } catch (e) {
      items = JSON.parse(JSON.stringify(defaults));
    }

    function persist() {
      sessionStorage.setItem(PREFIX + storageKey, JSON.stringify(items));
    }

    function render(focusNewest) {
      container.innerHTML = '';
      items.forEach((item, idx) => {
        const el = renderItem(item, {
          onChange(patch) { Object.assign(item, patch); persist(); },
          onDelete() { items.splice(idx, 1); persist(); render(); },
        });
        el.querySelectorAll('[contenteditable="true"]').forEach((node) => {
          if (window.__levermakeBindHoverRing) window.__levermakeBindHoverRing(node);
        });
        container.appendChild(el);
      });

      if (addButtonLabel) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-item-btn';
        addBtn.textContent = addButtonLabel;
        addBtn.addEventListener('click', () => {
          items.push(newItem());
          persist();
          render(true);
        });
        container.appendChild(addBtn);
      }

      if (focusNewest) {
        const rows = container.children;
        const lastRow = rows[items.length - 1];
        if (lastRow) {
          const firstField = lastRow.querySelector('[contenteditable="true"]');
          if (firstField) {
            firstField.focus();
            // place caret at the end of the placeholder text
            const range = document.createRange();
            range.selectNodeContents(firstField);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    }

    render();
  }

  /* =========================================================
     5) ROW BUILDERS — one per collection type
     ---------------------------------------------------------
     Each row has editable text field(s) AND an editable URL
     field. A separate real <a> ("row-visit") stays in sync with
     the URL field and is what actually navigates, so editing
     text never accidentally triggers a page jump.
  ========================================================= */

  function buildLinkRow(item, { onChange, onDelete }) {
    const row = document.createElement('div');
    row.className = 'link-item';
    row.innerHTML = `
      <div class="link-text">
        <div class="link-title" contenteditable="true" spellcheck="false"></div>
        <div class="link-url" contenteditable="true" spellcheck="false"></div>
      </div>
      <a class="row-visit" target="_blank" rel="noopener" aria-label="Open link">Visit ↗</a>
      <button class="row-remove" type="button" aria-label="Remove link">×</button>
    `;
    const titleEl = row.querySelector('.link-title');
    const urlEl = row.querySelector('.link-url');
    const visitEl = row.querySelector('.row-visit');
    const removeBtn = row.querySelector('.row-remove');

    titleEl.innerText = item.title || '';
    urlEl.innerText = item.url || '';
    visitEl.href = normalizeUrl(item.url);

    titleEl.addEventListener('input', () => onChange({ title: titleEl.innerText }));
    titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); urlEl.focus(); } });
    urlEl.addEventListener('input', () => {
      visitEl.href = normalizeUrl(urlEl.innerText);
      onChange({ url: urlEl.innerText });
    });
    urlEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); urlEl.blur(); } });
    removeBtn.addEventListener('click', onDelete);

    return row;
  }

  function buildProjectRow(item, { onChange, onDelete }) {
    const row = document.createElement('div');
    row.className = 'project-item';
    row.innerHTML = `
      <div class="project-title" contenteditable="true" spellcheck="false"></div>
      <div class="project-desc" contenteditable="true" spellcheck="false"></div>
      <div class="project-foot">
        <div class="project-url" contenteditable="true" spellcheck="false"></div>
        <a class="row-visit" target="_blank" rel="noopener" aria-label="Open project">View ↗</a>
      </div>
      <button class="row-remove" type="button" aria-label="Remove project">×</button>
    `;
    const titleEl = row.querySelector('.project-title');
    const descEl = row.querySelector('.project-desc');
    const urlEl = row.querySelector('.project-url');
    const visitEl = row.querySelector('.row-visit');
    const removeBtn = row.querySelector('.row-remove');

    titleEl.innerText = item.title || '';
    descEl.innerText = item.desc || '';
    urlEl.innerText = item.url || '';
    visitEl.href = normalizeUrl(item.url);

    titleEl.addEventListener('input', () => onChange({ title: titleEl.innerText }));
    descEl.addEventListener('input', () => onChange({ desc: descEl.innerText }));
    urlEl.addEventListener('input', () => {
      visitEl.href = normalizeUrl(urlEl.innerText);
      onChange({ url: urlEl.innerText });
    });
    removeBtn.addEventListener('click', onDelete);

    return row;
  }

  function buildBlogRow(item, { onChange, onDelete }) {
    const row = document.createElement('div');
    row.className = 'blog-item';
    row.innerHTML = `
      <div class="blog-date" contenteditable="true" spellcheck="false"></div>
      <div class="blog-title" contenteditable="true" spellcheck="false"></div>
      <div class="blog-excerpt" contenteditable="true" spellcheck="false"></div>
      <div class="blog-foot">
        <div class="blog-url" contenteditable="true" spellcheck="false"></div>
        <a class="row-visit" target="_blank" rel="noopener" aria-label="Read post">Read ↗</a>
      </div>
      <button class="row-remove" type="button" aria-label="Remove post">×</button>
    `;
    const dateEl = row.querySelector('.blog-date');
    const titleEl = row.querySelector('.blog-title');
    const excerptEl = row.querySelector('.blog-excerpt');
    const urlEl = row.querySelector('.blog-url');
    const visitEl = row.querySelector('.row-visit');
    const removeBtn = row.querySelector('.row-remove');

    dateEl.innerText = item.date || '';
    titleEl.innerText = item.title || '';
    excerptEl.innerText = item.excerpt || '';
    urlEl.innerText = item.url || '';
    visitEl.href = normalizeUrl(item.url);

    dateEl.addEventListener('input', () => onChange({ date: dateEl.innerText }));
    titleEl.addEventListener('input', () => onChange({ title: titleEl.innerText }));
    excerptEl.addEventListener('input', () => onChange({ excerpt: excerptEl.innerText }));
    urlEl.addEventListener('input', () => {
      visitEl.href = normalizeUrl(urlEl.innerText);
      onChange({ url: urlEl.innerText });
    });
    removeBtn.addEventListener('click', onDelete);

    return row;
  }

  /* ---------- public API used by each page's small bootstrap script ---------- */
  window.Levermake = {
    initCollection,
    buildLinkRow,
    buildProjectRow,
    buildBlogRow,
    normalizeUrl,
  };

  document.addEventListener('DOMContentLoaded', () => {
    initCursorAndFresco();
    initSimpleEditableFields();
  });
})();
