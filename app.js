'use strict';
(() => {
  const content = window.LEVERMAKE_CONTENT;
  // Treat all copy as text, not executable HTML. Restrict configurable links.
  const safeHref = value => {
    if (typeof value !== 'string') return null;
    if (/^#[a-z][a-z0-9_-]*$/i.test(value)) return value;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
  };
  if (content) {
    document.querySelectorAll('[data-copy]').forEach(node => {
      const value = content[node.dataset.copy];
      if (typeof value === 'string') node.textContent = value;
    });
    if (typeof content.title === 'string') document.title = content.title;
    if (typeof content.description === 'string') document.querySelector('meta[name="description"]').content = content.description;
    const fragment = document.createDocumentFragment();
    (Array.isArray(content.navigation) ? content.navigation : []).forEach(item => {
      const href = safeHref(item?.href);
      if (!href || typeof item.label !== 'string') return;
      const link = document.createElement('a');
      link.textContent = item.label; link.href = href; link.rel = 'noopener noreferrer'; fragment.append(link);
    });
    if (fragment.childNodes.length) document.querySelector('#navigation').replaceChildren(fragment);
    const footerHref = safeHref(content.footerLink?.href);
    if (footerHref && typeof content.footerLink.label === 'string') {
      const link = document.querySelector('#footer-link'); link.href = footerHref; link.textContent = content.footerLink.label;
    }
  }
  const root = document.documentElement, cursor = document.querySelector('.cursor');
  const atmosphere = document.querySelector('.atmosphere'), toggle = document.querySelector('#motion-toggle');
  const label = document.querySelector('#motion-label');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(pointer: fine)');
  let paused = reduced.matches, frame = 0, x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  // Keep the native cursor for precise clicking. Ease a decorative ring behind
  // the pointer and shift the whole light field by at most 12px. No layout reads.
  function draw() {
    frame = 0;
    if (paused || reduced.matches || document.hidden || !fine.matches) return;
    x += (tx - x) * .16; y += (ty - y) * .16;
    cursor.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
    atmosphere.style.transform = 'translate(' + ((x / innerWidth - .5) * 12) + 'px,' + ((y / innerHeight - .5) * 12) + 'px) scale(1.035)';
    if (Math.abs(tx-x) + Math.abs(ty-y) > .2) frame = requestAnimationFrame(draw);
  }
  function syncMotion() {
    cancelAnimationFrame(frame); frame = 0;
    root.classList.toggle('motion-paused', paused || reduced.matches);
    toggle.hidden = reduced.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    label.textContent = paused ? 'Resume motion' : 'Pause motion';
    toggle.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
    if (paused || reduced.matches) { atmosphere.style.transform = ''; root.classList.remove('pointer-visible'); }
  }
  toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; syncMotion(); });
  fine.addEventListener('change', () => { root.classList.remove('pointer-visible'); syncMotion(); });
  addEventListener('pointermove', event => {
    if (paused || reduced.matches || !fine.matches || event.pointerType === 'touch') return;
    tx = event.clientX; ty = event.clientY;
    root.classList.add('pointer-visible'); root.classList.toggle('pointer-link', !!event.target.closest('a,button'));
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('pointer-visible'));
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('tab-hidden', document.hidden);
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
  });
  syncMotion();
})();
